// src/controllers/lead.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';
import { createLeadSchema, updateLeadSchema, sendLeadMessageSchema } from '../schemas/lead.schema';
import { sendWhatsAppText, WhatsAppSendError, WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE } from '../services/whatsapp-cloud-api.service';

export const listLeads = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const leads = await withRLSContext(id, role, (tx) =>
    tx.lead.findMany({ orderBy: { createdAt: 'desc' } }),
  );
  res.status(200).json(leads);
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
    const message = await withRLSContext(id, role, (tx) =>
      tx.leadMessage.create({ data: { leadId: lead.id, direction: 'outbound', senderType: 'human', body: parseResult.data.body } }),
    );
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
