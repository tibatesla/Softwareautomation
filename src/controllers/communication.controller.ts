// src/controllers/communication.controller.ts
//
// Owner/Admin broadcast tool: send one message to a single lead or to every
// lead at once. WhatsApp is the only channel actually wired up -- sms and
// email are accepted by the schema (so the frontend can show them as
// "coming soon" rather than not existing at all) but rejected here until
// those providers are configured.
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';
import { broadcastSchema } from '../schemas/communication.schema';
import { sendWhatsAppText, WhatsAppSendError, WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE } from '../services/whatsapp-cloud-api.service';

interface BroadcastResult {
  leadId: string;
  name: string;
  status: 'sent' | 'failed';
  reason?: string;
}

export const sendBroadcast = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = broadcastSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed broadcast payload', details: parseResult.error.errors });
    return;
  }
  const { channel, target, leadId, body } = parseResult.data;

  if (channel !== 'whatsapp') {
    res.status(400).json({ error: `The ${channel} channel isn't connected yet -- WhatsApp is the only channel available right now.` });
    return;
  }

  const { id, role } = req.user!;

  const leads = await withRLSContext(id, role, (tx) =>
    target === 'single' ? tx.lead.findMany({ where: { id: leadId } }) : tx.lead.findMany(),
  );

  if (leads.length === 0) {
    res.status(404).json({ error: target === 'single' ? 'Lead not found' : 'No leads to message' });
    return;
  }

  // Run sequentially, not in parallel -- current lead volume (dozens, not
  // thousands) makes this finish in well under the request timeout without
  // needing a background job, and it avoids bursting the WhatsApp API with
  // a hundred simultaneous requests.
  const results: BroadcastResult[] = [];
  for (const lead of leads) {
    const waId = lead.phoneNumber.replace(/^\+/, '');
    const name = lead.fullName ?? lead.phoneNumber;

    try {
      await sendWhatsAppText(waId, body);
    } catch (error) {
      const reason =
        error instanceof WhatsAppSendError && error.code === WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE
          ? 'Outside the 24-hour re-engagement window'
          : 'Send failed';
      if (!(error instanceof WhatsAppSendError && error.code === WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE)) {
        console.error('[Broadcast] WhatsApp send failed:', lead.id, error);
      }
      results.push({ leadId: lead.id, name, status: 'failed', reason });
      continue;
    }

    try {
      await withRLSContext(id, role, async (tx) => {
        const created = await tx.leadMessage.create({
          data: { leadId: lead.id, direction: 'outbound', senderType: 'human', body },
        });
        await tx.lead.update({ where: { id: lead.id }, data: { lastMessageAt: created.createdAt } });
        // Same reasoning as the single-lead reply endpoint: sending a
        // message means the sender has seen the conversation up to now.
        await tx.leadRead.upsert({
          where: { userId_leadId: { userId: id, leadId: lead.id } },
          create: { userId: id, leadId: lead.id, lastReadAt: created.createdAt },
          update: { lastReadAt: created.createdAt },
        });
      });
      results.push({ leadId: lead.id, name, status: 'sent' });
    } catch (error) {
      console.error('[Broadcast] Sent but failed to save to history:', lead.id, error);
      results.push({ leadId: lead.id, name, status: 'sent', reason: 'Sent, but not saved to conversation history' });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  res.status(200).json({ total: results.length, sent, failed: results.length - sent, results });
};
