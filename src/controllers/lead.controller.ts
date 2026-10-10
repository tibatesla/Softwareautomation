// src/controllers/lead.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext, withSystemContext, AppRole } from '../config/database';
import { Prisma } from '../../generated/prisma';
import { createLeadSchema, updateLeadSchema, sendLeadMessageSchema, bulkDeleteSchema, assignLeadSchema } from '../schemas/lead.schema';
import { sendWhatsAppText, WhatsAppSendError, WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE } from '../services/whatsapp-cloud-api.service';

interface UnreadRow {
  lead_id: string;
  unread_count: number;
}

export const listLeads = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const [leads, unreadRows] = await withRLSContext(id, role, (tx) =>
    Promise.all([
      tx.lead.findMany({ orderBy: { createdAt: 'desc' } }),
      // Unread = inbound messages (from the lead) newer than this caller's
      // own read marker for that lead -- deliberately per-user, and never
      // advanced by the bot's automated outbound replies (see migration
      // 030). Raw SQL because Postgres FILTER-aggregate is the clean way
      // to express "count inbound messages newer than a per-lead cutoff"
      // in one pass instead of N+1 queries.
      tx.$queryRaw<UnreadRow[]>`
        SELECT l.id AS lead_id,
               COUNT(lm.id) FILTER (
                 WHERE lm.direction = 'inbound'
                   AND lm.created_at > COALESCE(lr.last_read_at, '-infinity'::timestamptz)
               )::int AS unread_count
        FROM leads l
        LEFT JOIN lead_messages lm ON lm.lead_id = l.id
        LEFT JOIN lead_reads lr ON lr.lead_id = l.id AND lr.user_id = ${id}::uuid
        GROUP BY l.id
      `,
    ]),
  );

  const unreadByLead = new Map(unreadRows.map((r) => [r.lead_id, r.unread_count]));
  const leadsWithUnread = leads.map((lead) => ({ ...lead, unreadCount: unreadByLead.get(lead.id) ?? 0 }));

  res.status(200).json(leadsWithUnread);
};

/**
 * Marks a lead's conversation as read by the caller (upserts their own
 * lead_reads row to now()). Called when a human opens the lead's message
 * thread -- not automatically by anything the bot does.
 */
export const markLeadRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const leadId = req.params.id;

  const lead = await withRLSContext(id, role, (tx) => tx.lead.findUnique({ where: { id: leadId }, select: { id: true } }));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  await withRLSContext(id, role, (tx) =>
    tx.leadRead.upsert({
      where: { userId_leadId: { userId: id, leadId } },
      create: { userId: id, leadId },
      update: { lastReadAt: new Date() },
    }),
  );

  res.status(204).send();
};

export const getLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const lead = await withRLSContext(id, role, (tx) =>
    tx.lead.findUnique({ where: { id: req.params.id } }),
  );

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  res.status(200).json(lead);
};

// RLS (lead_messages_owner_admin_select / lead_messages_agent_select_own)
// scopes this to leads the caller is actually allowed to see -- an agent
// querying another agent's lead gets an empty array, not a 403, same as
// getLead falling through to a plain lookup rather than a role check.
export const listLeadMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const messages = await withRLSContext(id, role, (tx) =>
    tx.leadMessage.findMany({ where: { leadId: req.params.id }, orderBy: { createdAt: 'asc' } }),
  );
  res.status(200).json(messages);
};

/**
 * Lets an Agent who has claimed this lead (or Owner/Admin) send a WhatsApp
 * reply from the CRM. The Cloud API call happens BEFORE the DB write so a
 * human never sees "sent" for a message that didn't actually go out; the
 * lead_messages_agent_insert_own / _owner_admin_insert RLS policies
 * (019_lead_messages_human_send.sql) are a second, defense-in-depth layer
 * behind the explicit claim check below, not the only guard.
 */
export const sendLeadMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = sendLeadMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed message payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const lead = await withRLSContext(id, role, (tx) => tx.lead.findUnique({ where: { id: req.params.id } }));

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  if (role === 'agent' && lead.claimedByAgentId !== id) {
    res.status(403).json({ error: 'You can only message leads you have claimed' });
    return;
  }

  const waId = lead.phoneNumber.replace(/^\+/, '');

  try {
    await sendWhatsAppText(waId, parseResult.data.body);
  } catch (error) {
    if (error instanceof WhatsAppSendError && error.code === WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE) {
      res.status(422).json({
        error: 'This contact has not messaged in the last 24 hours -- WhatsApp only allows free-form replies within that window.',
      });
      return;
    }
    console.error('[Lead Message] WhatsApp send failed:', error);
    res.status(502).json({ error: 'Failed to send WhatsApp message' });
    return;
  }

  try {
    const message = await withRLSContext(id, role, async (tx) => {
      const created = await tx.leadMessage.create({
        data: { leadId: lead.id, direction: 'outbound', senderType: 'human', body: parseResult.data.body },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { lastMessageAt: created.createdAt } });
      // Sending a reply means the sender has, by definition, seen the
      // conversation up to this point -- advance their own read marker too.
      await tx.leadRead.upsert({
        where: { userId_leadId: { userId: id, leadId: lead.id } },
        create: { userId: id, leadId: lead.id, lastReadAt: created.createdAt },
        update: { lastReadAt: created.createdAt },
      });
      return created;
    });
    res.status(201).json(message);
  } catch (error) {
    // Sent successfully but failed to persist -- don't report this as a
    // send failure (it wasn't one), but don't hide that history is now
    // out of sync either.
    console.error('[Lead Message] Sent but failed to save to history:', error);
    res.status(201).json({ warning: 'Message sent, but failed to save to conversation history' });
  }
};

export const createLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createLeadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed lead payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const lead = await withRLSContext(id, role, (tx) => tx.lead.create({ data: parseResult.data }));

  res.status(201).json(lead);
};

export const updateLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updateLeadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed lead payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const lead = await withRLSContext(id, role, (tx) =>
      tx.lead.update({ where: { id: req.params.id }, data: parseResult.data }),
    );
    res.status(200).json(lead);
  } catch {
    res.status(404).json({ error: 'Lead not found' });
  }
};

type DeleteLeadResult = { ok: true } | { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Shared by the single-item and bulk delete endpoints. Blocked if the lead
 * has real bookings or payments -- those are business records that must be
 * preserved. A lead's own WhatsApp conversation history isn't a separate
 * record another party owns, so it's deleted alongside the lead rather
 * than blocking; agent penalty rows referencing the lead keep their own
 * accountability history but have lead_id cleared instead of being
 * deleted or blocking the delete.
 */
const deleteLeadCore = async (userId: string, role: AppRole, leadId: string): Promise<DeleteLeadResult> => {
  try {
    const linked = await withRLSContext(userId, role, (tx) =>
      tx.lead.findUnique({
        where: { id: leadId },
        select: { _count: { select: { bookings: true, payments: true } } },
      }),
    );

    if (!linked) {
      return { ok: false, status: 404, error: 'Lead not found' };
    }

    const linkedCounts = Object.entries(linked._count).filter(([, count]) => count > 0);
    if (linkedCounts.length > 0) {
      const summary = linkedCounts.map(([name, count]) => `${count} ${name}`).join(', ');
      return {
        ok: false,
        status: 409,
        error: `Can't delete -- this lead has linked records (${summary}). Mark it as lost/unqualified instead to preserve that history.`,
      };
    }

    // Read-markers can belong to several different users, not just the
    // caller -- clearing them needs system privileges, not the caller's own
    // scoped RLS context (see 034_lead_reads_delete.sql).
    await withSystemContext((tx) => tx.leadRead.deleteMany({ where: { leadId } }));

    await withRLSContext(userId, role, async (tx) => {
      await tx.leadMessage.deleteMany({ where: { leadId } });
      await tx.agentPenalty.updateMany({ where: { leadId }, data: { leadId: null } });
      await tx.lead.delete({ where: { id: leadId } });
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { ok: false, status: 404, error: 'Lead not found' };
    }
    console.error('[Lead] Delete failed:', error);
    return { ok: false, status: 500, error: 'Failed to delete lead' };
  }
};

export const deleteLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const result = await deleteLeadCore(id, role, req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(204).send();
};

export const bulkDeleteLeads = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = bulkDeleteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed request', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const results = await Promise.all(
    parseResult.data.ids.map(async (leadId) => {
      const result = await deleteLeadCore(id, role, leadId);
      return result.ok ? { id: leadId, deleted: true as const } : { id: leadId, deleted: false as const, error: result.error };
    }),
  );

  res.status(200).json({
    deleted: results.filter((r) => r.deleted).map((r) => r.id),
    failed: results.filter((r): r is { id: string; deleted: false; error: string } => !r.deleted),
  });
};

/**
 * Agent claims an unclaimed, qualified lead. Relies entirely on the
 * leads_agent_claim RLS policy (011_leads_agent_claim_policies.sql) to
 * enforce that only unclaimed+qualified rows can be claimed, and only by
 * setting claimed_by_agent_id to the calling agent -- this handler does
 * not duplicate that logic, it just issues the update and reports whether
 * RLS let it through.
 */
export const claimLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;

  try {
    const lead = await withRLSContext(id, role, (tx) =>
      tx.lead.update({
        where: { id: req.params.id },
        data: { claimedByAgentId: id, claimedAt: new Date() },
      }),
    );
    res.status(200).json(lead);
  } catch {
    res.status(409).json({ error: 'Lead is not available to claim (already claimed, not qualified, or does not exist)' });
  }
};

/**
 * Owner/Admin manually assigns (or reassigns, if already claimed by someone
 * else) a lead to a specific agent -- unlike claimLead, there's no
 * qualification-status or unclaimed-only restriction here; the
 * leads_owner_admin_all RLS policy already grants owner/admin unrestricted
 * UPDATE on any lead, so this is deliberately a plain override.
 *
 * Also bumps the target agent's lastLeadAssignedAt, same as the SLA
 * cron's own auto-assign step (agent-sla.service.ts) -- otherwise a
 * manually-assigned agent would look stale in the round-robin queue and
 * get double-loaded by the next automatic pass.
 */
export const assignLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = assignLeadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed assignment payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const { agentId } = parseResult.data;

  const targetAgent = await withRLSContext(id, role, (tx) => tx.user.findUnique({ where: { id: agentId } }));
  if (!targetAgent || targetAgent.role !== 'agent' || !targetAgent.isActive) {
    res.status(400).json({ error: 'agentId must reference an active agent' });
    return;
  }

  try {
    const now = new Date();
    // Both updates run inside the single transaction withRLSContext already
    // opens -- no nested $transaction needed (Prisma.TransactionClient
    // doesn't support that), this is already atomic as written.
    const lead = await withRLSContext(id, role, async (tx) => {
      const updated = await tx.lead.update({ where: { id: req.params.id }, data: { claimedByAgentId: agentId, claimedAt: now } });
      await tx.user.update({ where: { id: agentId }, data: { lastLeadAssignedAt: now } });
      return updated;
    });
    res.status(200).json(lead);
  } catch {
    res.status(404).json({ error: 'Lead not found' });
  }
};
