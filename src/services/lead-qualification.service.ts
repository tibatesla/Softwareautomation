// src/services/lead-qualification.service.ts
//
// The WhatsApp qualification bot. On first inbound message, auto-creates a
// lead from phone + the contact's WhatsApp profile name (no manual agent
// entry required, and no separate "what's your name" question -- the
// WhatsApp profile name already gives us that). The opening message's own
// text is taken as the property interest and best-effort matched against
// existing listings.
//
// From there the script branches on visit preference (CRM Handoff, revised
// script): one question decides in-person vs virtual, then a second,
// branch-specific question that asks two things in a single message (e.g.
// budget + cash-or-financing). A single free-text reply answering two
// things at once is parsed into separate structured fields by
// lead-answer-extraction.service.ts, not by this state machine directly --
// this file only decides WHICH stage a lead is at and what to do with the
// (already-extracted) answer.
//
// Once qualified, if the opening message matched a real listing, the bot
// offers to book a visit right there in the chat -- the client's reply is
// parsed as a date/time and turned into a real bookings row (same
// dealStage-advancing side effect as a booking made in the CRM UI). If no
// listing was matched, or the date/time can't be understood, the flow
// hands off to a human consultant instead of guessing.
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { withSystemContext } from '../config/database';
import { Prisma } from '../../generated/prisma';
import { LeadTrackingService } from './tracking.service';
import { sendWhatsAppText, sendWhatsAppSlotList, WhatsAppSlotOption } from './whatsapp-cloud-api.service';
import { generateBotReply } from './lead-ai-assistant.service';
import {
  classifyVisitPreference,
  extractBudgetAnswer,
  extractTimelineAnswer,
  parseScheduledDateTime,
} from './lead-answer-extraction.service';
import { dispatchQualifiedLeadEvent } from './meta-capi.service';
import { attributeQualifiedLead } from './ad-attribution.service';
import { NormalizedInboundMessage } from '../schemas/whatsapp.schema';

const tracking = new LeadTrackingService();

const QUESTION_VISIT_PREFERENCE =
  'Thank you so much for reaching out! We would love to help you find the perfect space. To let you truly experience what this property has to offer, would you prefer to walk through it in person this week, or would a premium guided virtual tour suit you better?';

const QUESTION_IN_PERSON_DETAILS =
  'Wonderful. We want to ensure every property we show you perfectly aligns with your vision and respects your time. Could you share a rough budget you are comfortable with, and whether you are leaning toward a cash purchase or financing?';

const QUESTION_VIRTUAL_DETAILS =
  'We completely understand that securing a property from afar requires a lot of trust. We will set up a detailed virtual walkthrough for you. To help us prepare, are you hoping to find the right property in the next 30-60 days, and do you have a trusted representative here to view it alongside you?';

// Sent as the body of the tappable slot-list message, once qualification
// completes AND the opening message matched a real listing with at least
// one open slot -- lets the client pick an exact time instead of typing
// one freehand, fully native (no external calendar link, no WhatsApp Flows
// encryption/publishing overhead -- see sendWhatsAppSlotList).
const CLOSING_WITH_BOOKING_OFFER =
  "Perfect, thank you for sharing that with us! Let's get you one step closer to your new property. Pick a time below that works best for you and we'll get your visit booked in right away. If you'd prefer, one of our property consultants can reach out shortly to coordinate your schedule personally instead.";

// Sent once qualification completes but there's nothing to offer a slot
// list against -- no listing was matched, no agent is available to assign
// it to, or that agent has no open slots in the next two weeks. Goes
// straight to human handoff (the same fallback the original script
// offered as an alternative); deliberately generic since it covers all
// three of those reasons, not just "no property matched".
const CLOSING_HUMAN_HANDOFF =
  "Perfect, thank you for sharing that with us! Let's get you one step closer to your new property. One of our property consultants will reach out to you shortly to coordinate a viewing that works for you.";

const BOOKING_CONFIRMED = (whenLabel: string) =>
  `You're all set! Your visit is booked for ${whenLabel}. We look forward to seeing you then -- if anything changes, just let us know.`;

const BOOKING_UNPARSEABLE =
  "Thanks! We couldn't quite catch a specific date and time there -- no worries though, one of our property consultants will reach out shortly to coordinate your visit personally.";

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

const EAT_OFFSET_HOURS = 3; // Kenya is fixed UTC+3 year-round, no DST -- same assumption agent-sla.service.ts makes.

/**
 * Best-effort match of free-text property interest against existing
 * listings. rawText is now the client's whole opening message (e.g. "Hi,
 * am interested in purchasing this unit"), not a short dedicated answer
 * to "which property?" -- so this checks whether the message MENTIONS a
 * listing's title or referenceId as a substring, not the other way
 * around (a property's title is essentially never a substring of a full
 * sentence). Only sets propertyId when exactly one listing is mentioned --
 * ambiguous (multiple listings named in the same message) or zero matches
 * just keep the raw text, which is still useful to an agent.
 */
const tryMatchProperty = async (
  tx: Prisma.TransactionClient,
  rawText: string,
): Promise<string | undefined> => {
  const properties = await tx.property.findMany({ select: { id: true, title: true, referenceId: true } });
  const haystack = rawText.toLowerCase();

  const matches = properties.filter(
    (p) =>
      (p.title && haystack.includes(p.title.toLowerCase())) ||
      (p.referenceId && haystack.includes(p.referenceId.toLowerCase())),
  );

  return matches.length === 1 ? matches[0].id : undefined;
};

/**
 * Picks who a self-booked visit gets assigned to. If the lead is already
 * claimed, that agent keeps it -- a booking shouldn't silently reassign a
 * lead someone is actively working. Otherwise, round-robin among on-duty
 * agents (same ordering agent-sla.service.ts uses), falling back to any
 * active agent if none are on duty right now: WhatsApp runs 24/7, and a
 * visit request outside working hours still needs an owner, unlike the
 * SLA cron's own auto-assign which can just wait for the next tick.
 */
const pickAgentForBooking = async (
  tx: Prisma.TransactionClient,
  lead: { id: string; claimedByAgentId: string | null },
): Promise<string | undefined> => {
  if (lead.claimedByAgentId) return lead.claimedByAgentId;

  const onDutyAgent = await tx.user.findFirst({
    where: { role: 'agent', isActive: true, isOnDuty: true },
    orderBy: [{ lastLeadAssignedAt: { sort: 'asc', nulls: 'first' } }],
  });
  const chosen =
    onDutyAgent ??
    (await tx.user.findFirst({
      where: { role: 'agent', isActive: true },
      orderBy: [{ lastLeadAssignedAt: { sort: 'asc', nulls: 'first' } }],
    }));
  if (!chosen) return undefined;

  const now = new Date();
  await tx.lead.update({ where: { id: lead.id }, data: { claimedByAgentId: chosen.id, claimedAt: now } });
  await tx.user.update({ where: { id: chosen.id }, data: { lastLeadAssignedAt: now } });
  return chosen.id;
};

// Fixed viewing hours (Nairobi time) offered as slot options -- a simple,
// predictable schedule rather than trying to model each agent's actual
// working hours, which nothing else in this codebase tracks per-agent.
const VISIT_HOURS_EAT = [9, 11, 14, 16];

/**
 * Generates up to `count` open slots for `agentId` over the next two
 * weeks, skipping Sundays and anything the agent already has a booking
 * against (exact-timestamp match only -- bookings have no duration field
 * anywhere in this system to check real overlap against). All date math
 * is done in UTC-shifted-by-EAT_OFFSET_HOURS terms so it's correct
 * regardless of the server's own local timezone.
 */
const generateAvailableSlots = async (
  tx: Prisma.TransactionClient,
  agentId: string,
  count: number,
): Promise<{ start: Date; label: string }[]> => {
  const nairobiNow = new Date(Date.now() + EAT_OFFSET_HOURS * 60 * 60 * 1000);
  const baseYear = nairobiNow.getUTCFullYear();
  const baseMonth = nairobiNow.getUTCMonth();
  const baseDate = nairobiNow.getUTCDate();
  const minLeadTimeMs = 60 * 60 * 1000; // don't offer anything less than 1h out

  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 14 && candidates.length < count * 3; dayOffset++) {
    const weekday = new Date(Date.UTC(baseYear, baseMonth, baseDate + dayOffset)).getUTCDay(); // 0 = Sunday
    if (weekday === 0) continue;

    for (const hour of VISIT_HOURS_EAT) {
      const slotUtc = new Date(Date.UTC(baseYear, baseMonth, baseDate + dayOffset, hour - EAT_OFFSET_HOURS, 0, 0));
      if (slotUtc.getTime() - Date.now() < minLeadTimeMs) continue;
      candidates.push(slotUtc);
    }
  }

  const existing = await tx.booking.findMany({
    where: { agentId, scheduledAt: { in: candidates } },
    select: { scheduledAt: true },
  });
  const busy = new Set(existing.map((b) => b.scheduledAt.getTime()));

  return candidates
    .filter((slot) => !busy.has(slot.getTime()))
    .slice(0, count)
    .map((start) => ({
      start,
      label: start.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi',
      }),
    }));
};

export const handleInboundWhatsAppMessage = async (message: NormalizedInboundMessage): Promise<void> => {
  if (message.messageType && message.messageType !== 'text' && message.messageType !== 'interactive') {
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
      const matchedPropertyId = await tryMatchProperty(tx, messageText);
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
          propertyInterestRaw: messageText,
          propertyId: matchedPropertyId,
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
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: QUESTION_VISIT_PREFERENCE, justQualified: false };
    }

    // Stage: awaiting a scheduling reply for a self-booked visit -- takes
    // priority over everything else, since this is a direct answer to the
    // bot's own most recent question, not a fresh qualification message.
    if (lead.awaitingBookingReply) {
      await tx.lead.update({ where: { id: lead.id }, data: { awaitingBookingReply: false } });

      // The tapped slot's row id IS its exact ISO datetime (see
      // generateAvailableSlots/sendWhatsAppSlotList) -- no parsing needed,
      // and this is the expected path now that a slot list is offered.
      // Free-text AI parsing is only a fallback for a client who typed a
      // reply instead of tapping (or whose WhatsApp client doesn't render
      // interactive messages).
      let scheduledAt: Date | null = null;
      if (message.interactiveReplyId) {
        const tapped = new Date(message.interactiveReplyId);
        if (!Number.isNaN(tapped.getTime()) && tapped.getTime() > Date.now()) {
          scheduledAt = tapped;
        }
      }
      if (!scheduledAt) {
        const nowNairobi = new Date(Date.now() + EAT_OFFSET_HOURS * 60 * 60 * 1000);
        scheduledAt = await parseScheduledDateTime(messageText, nowNairobi);
      }

      if (!scheduledAt || !lead.propertyId) {
        return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_UNPARSEABLE, justQualified: false };
      }

      const agentId = await pickAgentForBooking(tx, lead);
      if (!agentId) {
        return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_UNPARSEABLE, justQualified: false };
      }

      await tx.booking.create({
        data: {
          propertyId: lead.propertyId,
          leadId: lead.id,
          agentId,
          scheduledAt,
          isVirtual: lead.visitPreference === 'virtual',
          notes: 'Self-booked via WhatsApp',
        },
      });
      // Same dealStage-advancing side effect a booking made in the CRM UI
      // has (see createBooking in booking.controller.ts) -- only from the
      // initial stage, so this never regresses a deal further along.
      await tx.lead.updateMany({ where: { id: lead.id, dealStage: 'new' }, data: { dealStage: 'site_visit_scheduled' } });

      const whenLabel = scheduledAt.toLocaleString('en-KE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Africa/Nairobi',
      });
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_CONFIRMED(whenLabel), justQualified: false };
    }

    // Stage 1: visit preference not yet answered.
    if (!lead.visitPreference) {
      const preference = (await classifyVisitPreference(messageText)) ?? 'in_person';
      await tx.lead.update({ where: { id: lead.id }, data: { visitPreference: preference } });
      const nextQuestion = preference === 'virtual' ? QUESTION_VIRTUAL_DETAILS : QUESTION_IN_PERSON_DETAILS;
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: nextQuestion, justQualified: false };
    }

    // Stage 2: branch-specific details not yet answered. requiresProxyVisit
    // is a non-nullable column (defaults false), so purchaseTimeline is the
    // only reliable signal for whether the virtual branch's question has
    // been asked yet -- it always gets set (at minimum to the raw reply)
    // once answered, see below.
    const detailsMissing =
      lead.visitPreference === 'virtual'
        ? !lead.purchaseTimeline
        : !lead.budgetRange || !lead.transactionType;

    if (detailsMissing) {
      const updateData: Record<string, unknown> = {};
      if (lead.visitPreference === 'virtual') {
        const { purchaseTimeline, requiresProxyVisit } = await extractTimelineAnswer(messageText);
        updateData.purchaseTimeline = purchaseTimeline ?? messageText;
        if (requiresProxyVisit !== null) updateData.requiresProxyVisit = requiresProxyVisit;
      } else {
        const { budgetRange, transactionType } = await extractBudgetAnswer(messageText);
        updateData.budgetRange = budgetRange ?? messageText;
        if (transactionType) updateData.transactionType = transactionType;
      }

      updateData.qualificationStatus = 'qualified';

      const capiRecentlyFired = lead.lastCapiFiredAt ? Date.now() - lead.lastCapiFiredAt.getTime() < CAPI_DEDUP_WINDOW_MS : false;
      if (!capiRecentlyFired) {
        updateData.lastCapiFiredAt = new Date();
      }

      // Lock in the agent now (not when the client picks a slot) so the
      // slot list itself can be filtered against that specific agent's
      // calendar -- see pickAgentForBooking for why this doesn't disturb
      // an already-claimed lead.
      let slotOffer: { bodyText: string; slots: WhatsAppSlotOption[]; transcriptBody: string } | null = null;
      if (lead.propertyId) {
        const agentId = await pickAgentForBooking(tx, { id: lead.id, claimedByAgentId: lead.claimedByAgentId });
        if (agentId) {
          const isVirtual = lead.visitPreference === 'virtual';
          const slots = await generateAvailableSlots(tx, agentId, 8);
          if (slots.length > 0) {
            updateData.awaitingBookingReply = true;
            slotOffer = {
              bodyText: CLOSING_WITH_BOOKING_OFFER,
              slots: slots.map((slot) => ({
                id: slot.start.toISOString(),
                title: slot.label,
                description: isVirtual ? 'Virtual tour' : 'Physical visit',
              })),
              transcriptBody: `[Offered visit times: ${slots.map((slot) => slot.label).join(', ')}]`,
            };
          }
        }
      }

      await tx.lead.update({ where: { id: lead.id }, data: updateData });

      return {
        leadId: lead.id,
        leadName: lead.fullName ?? undefined,
        reply: slotOffer ? null : CLOSING_HUMAN_HANDOFF,
        slotOffer,
        justQualified: true,
        shouldFireCapi: !capiRecentlyFired,
        ctwaClid: lead.ctwaClid,
        adSourceId: lead.adSourceId,
        adSourcePlatform: lead.adSourcePlatform,
      };
    }

    // Already fully qualified (and not awaiting a booking reply) -- keep
    // helping with follow-up questions via the AI layer as long as no
    // consultant has replied recently. Scoped to a rolling window (not
    // "ever"), so a lead who comes back days/weeks later with a fresh
    // enquiry -- e.g. clicking another ad -- gets the bot's help again
    // instead of being permanently muted by one old human reply. If a
    // consultant IS actively engaged (replied within the window), the bot
    // still steps back and leaves it to them.
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
  });

  if (outcome.slotOffer) {
    try {
      await sendWhatsAppSlotList(rawWaId, outcome.slotOffer.bodyText, outcome.slotOffer.slots);
      await withSystemContext(async (tx) => {
        const botMessage = await tx.leadMessage.create({
          data: { leadId: outcome.leadId, direction: 'outbound', senderType: 'bot', body: outcome.slotOffer!.transcriptBody },
        });
        await tx.lead.update({ where: { id: outcome.leadId }, data: { lastMessageAt: botMessage.createdAt } });
      });
    } catch (error) {
      // Same non-fatal handling as the plain-text reply path below -- the
      // lead sits waiting for its next inbound message instead of getting
      // the slot list, rather than this failing the whole handler.
      console.error('[WhatsApp] Slot list send failed (lead data already saved):', error);
    }
  } else if (outcome.reply) {
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
