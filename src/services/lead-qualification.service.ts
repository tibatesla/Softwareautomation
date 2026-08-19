// src/services/lead-qualification.service.ts
//
// The WhatsApp qualification bot (CRM Handoff, Section 4). On first inbound
// message, auto-creates a lead from phone + the contact's WhatsApp profile
// name (no manual agent entry required). Then asks one question at a time
// -- Meta's Cloud API supports interactive button/list messages, but this
// stays plain-text/sequential for now since that's the simpler MVP;
// upgrading specific questions to tappable options later doesn't change
// the state machine below, just how each question is sent. Runs until all
// four qualification fields the CRM doc asks for are filled, at which
// point the lead flips to 'qualified' and becomes visible to agents via
// the claim queue built in Module 2.
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { withSystemContext } from '../config/database';
import { Prisma } from '../../generated/prisma';
import { LeadTrackingService } from './tracking.service';
import { sendWhatsAppText } from './whatsapp-cloud-api.service';
import { generateBotReply } from './lead-ai-assistant.service';
import { dispatchQualifiedLeadEvent } from './meta-capi.service';
import { attributeQualifiedLead } from './ad-attribution.service';
import { NormalizedInboundMessage } from '../schemas/whatsapp.schema';

const tracking = new LeadTrackingService();

type QualificationField = 'fullName' | 'propertyInterestRaw' | 'investmentType' | 'budgetRange' | 'transactionType';

const QUALIFICATION_STEPS: Array<{ field: QualificationField; question: string }> = [
  { field: 'fullName', question: "Hi! Thanks for reaching out to Chestone Properties. Could I get your name?" },
  { field: 'propertyInterestRaw', question: 'Great, thanks! Which property or listing are you interested in?' },
  { field: 'investmentType', question: 'Is this for personal use, or as an investment?' },
  { field: 'budgetRange', question: 'What budget range are you working with?' },
  { field: 'transactionType', question: 'Will this be a cash purchase, financed, or an installment plan?' },
];

const COMPLETION_MESSAGE =
  "Perfect, thank you! One of our property consultants will reach out to you shortly with options that match what you're looking for.";

// Used for follow-up messages after qualification is already complete --
// only sent while no human consultant has replied within the handoff
// window (see HUMAN_HANDOFF_WINDOW_MINUTES below); once one has, the bot
// goes silent and leaves the thread to them.
const POST_QUALIFICATION_FALLBACK =
  "Thanks for your message! A Chestone Properties consultant will follow up with you shortly.";

// How long a human reply "protects" a thread from the bot stepping back
// in -- deliberately short. This exists only to stop the bot answering
// the exact same message a consultant is actively replying to right now,
// not to lock a lead out of bot help for any real length of time: a lead
// who messages again a few minutes later (let alone from a new ad click
// days later) should get the bot's help immediately if the consultant
// hasn't kept responding.
const HUMAN_HANDOFF_WINDOW_MINUTES = 5;

// Meta CAPI dedup guard (CRM spec): stops the same qualification from
// firing a second "Lead" conversion event if this handler somehow runs
// twice for the same lead (e.g. two webhook deliveries racing each other).
const CAPI_DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const firstMissingStep = (lead: Record<string, unknown>) =>
  QUALIFICATION_STEPS.find((step) => !lead[step.field]);

/**
 * Best-effort match of free-text property interest against existing
 * listings (case-insensitive substring against title or referenceId).
 * Only sets propertyId when exactly one match is found -- ambiguous or
 * zero matches just keep the raw text, which is still useful to an agent.
 */
const tryMatchProperty = async (
  tx: Prisma.TransactionClient,
  rawText: string,
): Promise<string | undefined> => {
  const candidates = await tx.property.findMany({
    where: {
      OR: [
        { title: { contains: rawText, mode: 'insensitive' } },
        { referenceId: { contains: rawText, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 2,
  });

  return candidates.length === 1 ? candidates[0].id : undefined;
};

export const handleInboundWhatsAppMessage = async (message: NormalizedInboundMessage): Promise<void> => {
  if (message.messageType && message.messageType !== 'text') {
    return; // media-only message -- nothing to qualify on yet
  }

  const messageText = message.text.trim();
  if (!messageText) {
    return;
  }

  const rawWaId = message.waId; // e.g. "254712345678", digits only, no leading '+'
  const phoneNumber = tracking.normalizePhone(`+${rawWaId}`);
  if (!phoneNumber) {
    console.warn('[WhatsApp] Could not normalize inbound phone number, dropping message:', rawWaId);
    return;
  }

  const targetSegment = phoneNumber.startsWith('+254') ? 'domestic' : 'diaspora';
  const countryCallingCode = parsePhoneNumberFromString(phoneNumber)?.countryCallingCode;
  const countryCode = countryCallingCode ? `+${countryCallingCode}` : undefined;
  const displayName = message.senderName;
  const ctwaClid = message.ctwaClid;
  const adSourceId = message.adSourceId;
  const adSourcePlatform = message.adSourcePlatform;

  // The DB write and the outbound side effects (WhatsApp reply, Meta CAPI
  // dispatch) are deliberately NOT in the same transaction: withSystemContext
  // wraps its callback in a Prisma transaction, and if either external call
  // threw *inside* it, a failure (bad API token, provider outage, network
  // blip) would roll back the lead capture along with it. The transaction
  // below only reads and writes the database and returns what needs to
  // happen next; the actual external calls happen after it has committed.
  const outcome = await withSystemContext(async (tx) => {
    let lead = await tx.lead.findFirst({ where: { phoneNumber } });
    const isNewLead = !lead;

    if (!lead) {
      lead = await tx.lead.create({
        data: {
          phoneNumber,
          fullName: displayName,
          source: 'whatsapp',
          targetSegment,
          countryCode,
          ctwaClid,
          adSourceId,
          adSourcePlatform,
          qualificationStatus: 'qualifying',
        },
      });
    }

    const inboundMessage = await tx.leadMessage.create({
      data: {
        leadId: lead.id,
        direction: 'inbound',
        body: messageText,
        whatsappMessageId: message.whatsappMessageId,
      },
    });
    await tx.lead.update({ where: { id: lead.id }, data: { lastMessageAt: inboundMessage.createdAt } });

    // First-ever message just triggers lead creation + the opening
    // question; it isn't itself an answer to anything the bot has asked.
    if (isNewLead) {
      const nextStep = firstMissingStep(lead);
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: nextStep ? nextStep.question : null, justQualified: false };
    }

    // Otherwise, this message answers whichever field is still missing.
    const pendingStep = firstMissingStep(lead);
    if (!pendingStep) {
      // Already fully qualified -- keep helping with follow-up questions
      // via the AI layer as long as no consultant has replied recently.
      // Scoped to a rolling window (not "ever"), so a lead who comes back
      // days/weeks later with a fresh enquiry -- e.g. clicking another ad
      // -- gets the bot's help again instead of being permanently muted
      // by one old human reply. If a consultant IS actively engaged
      // (replied within the window), the bot still steps back and leaves
      // it to them.
      const humanReply = await tx.leadMessage.findFirst({
        where: {
          leadId: lead.id,
          direction: 'outbound',
          senderType: 'human',
          createdAt: { gte: new Date(Date.now() - HUMAN_HANDOFF_WINDOW_MINUTES * 60 * 1000) },
        },
        select: { id: true },
      });
      return {
        leadId: lead.id,
        leadName: lead.fullName ?? undefined,
        reply: humanReply ? null : POST_QUALIFICATION_FALLBACK,
        justQualified: false,
      };
    }

    const updateData: Record<string, unknown> = { [pendingStep.field]: messageText };

    if (pendingStep.field === 'propertyInterestRaw') {
      const matchedPropertyId = await tryMatchProperty(tx, messageText);
      if (matchedPropertyId) {
        updateData.propertyId = matchedPropertyId;
      }
    }

    const nextStep = QUALIFICATION_STEPS.find(
      (step) => step.field !== pendingStep.field && !(lead as Record<string, unknown>)[step.field],
    );

    const justQualified = !nextStep;
    if (justQualified) {
      updateData.qualificationStatus = 'qualified';
    }

    // Dedup guard: only meaningfully reachable via a race (e.g. two inbound
    // webhook deliveries for the same lead processed concurrently, both
    // seeing "not yet qualified" before either commits) since a lead can
    // otherwise only complete qualification once under this state machine
    // -- but that race is real, and firing the same CAPI conversion twice
    // would double-count it in Meta's own reporting.
    const capiRecentlyFired =
      justQualified && lead.lastCapiFiredAt ? Date.now() - lead.lastCapiFiredAt.getTime() < CAPI_DEDUP_WINDOW_MS : false;
    if (justQualified && !capiRecentlyFired) {
      updateData.lastCapiFiredAt = new Date();
    }

    await tx.lead.update({ where: { id: lead.id }, data: updateData });

    const leadName = pendingStep.field === 'fullName' ? messageText : lead.fullName ?? undefined;
    return {
      leadId: lead.id,
      leadName,
      reply: nextStep ? nextStep.question : COMPLETION_MESSAGE,
      justQualified,
      // Distinct from justQualified: attribution (our own dashboard) should
      // still count this lead even on the rare dedup-skipped race, since
      // that's unrelated to Meta's own conversion counting -- only the CAPI
      // dispatch itself needs to skip.
      shouldFireCapi: justQualified && !capiRecentlyFired,
      ctwaClid: lead.ctwaClid,
      adSourceId: lead.adSourceId,
      adSourcePlatform: lead.adSourcePlatform,
    };
  });

  if (outcome.reply) {
    try {
      const replyText = await generateBotReply({
        cannedReply: outcome.reply,
        userMessage: messageText,
        leadName: outcome.leadName,
      });
      await sendWhatsAppText(rawWaId, replyText);
      // Only recorded once the send actually succeeded -- the transcript
      // should reflect what was really delivered, not what was attempted.
      // lastMessageAt (sort order) is updated same as any message, but --
      // deliberately -- no lead_reads row is touched here: a bot reply is
      // not a human reviewing the conversation, so it must never clear the
      // unread state (see migration 030).
      await withSystemContext(async (tx) => {
        const botMessage = await tx.leadMessage.create({
          data: { leadId: outcome.leadId, direction: 'outbound', senderType: 'bot', body: replyText },
        });
        await tx.lead.update({ where: { id: outcome.leadId }, data: { lastMessageAt: botMessage.createdAt } });
      });
    } catch (error) {
      // Lead data is already safely committed above; a failed reply just
      // means the lead sits waiting for its next inbound message instead
      // of getting an immediate prompt. Log and move on.
      console.error('[WhatsApp] Reply send failed (lead data already saved):', error);
    }
  }

  if (outcome.justQualified) {
    if (outcome.shouldFireCapi) {
      await dispatchQualifiedLeadEvent({
        ctwaClid: outcome.ctwaClid || ctwaClid || '',
        eventId: `lead_qual_${outcome.leadId}`,
      });
    }
    await attributeQualifiedLead(outcome.adSourceId || adSourceId, outcome.adSourcePlatform || adSourcePlatform);
  }
};
