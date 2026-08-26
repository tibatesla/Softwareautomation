// src/services/lead-qualification.service.ts
//
// The WhatsApp qualification bot. On first inbound message, auto-creates a
// lead from phone + the contact's WhatsApp profile name (no manual agent
// entry required, and no separate "what's your name" question -- the
// WhatsApp profile name already gives us that). The opening message's own
// text is taken as the property interest and best-effort matched against
// existing listings.
//
// From there the script branches on visit preference (client's revised
// script, tap-button version): a button question decides in-person vs
// virtual, then a second button question classifies the branch-specific
// detail (how they'd fund it / their timeline) with no AI parsing needed --
// the tapped button's id IS the answer. A client who types instead of
// tapping falls back to an AI classifier in
// lead-answer-extraction.service.ts. A third, free-text follow-up then
// asks the one thing that still needs an open answer (budget amount, or
// the diaspora proxy-visit check) -- this state machine only decides WHICH
// stage a lead is at and what to send/store at each one.
//
// Once qualified, if the opening message matched a real listing, the bot
// offers to book a visit right there in the chat -- either by tapping a
// slot in the WhatsApp message list, or via a web booking link sent right
// after it (same slots, same booking-scheduling.service.ts logic either
// way). A free-text reply instead of a tap is parsed as a date/time. If no
// listing was matched, or the date/time can't be understood, the flow
// hands off to a human consultant instead of guessing.
import { randomBytes } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { withSystemContext } from '../config/database';
import { Prisma } from '../../generated/prisma';
import { LeadTrackingService } from './tracking.service';
import {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppSlotList,
  WhatsAppButtonOption,
  WhatsAppSlotOption,
} from './whatsapp-cloud-api.service';
import { generateBotReply } from './lead-ai-assistant.service';
import { EAT_OFFSET_HOURS, pickAgentForBooking, generateAvailableSlots, confirmLeadBooking } from './booking-scheduling.service';
import {
  classifyVisitPreference,
  classifyTransactionType,
  classifyTimeline,
  extractBudgetAnswer,
  extractProxyVisitAnswer,
  parseScheduledDateTime,
} from './lead-answer-extraction.service';
import { dispatchQualifiedLeadEvent } from './meta-capi.service';
import { attributeQualifiedLead } from './ad-attribution.service';
import { NormalizedInboundMessage } from '../schemas/whatsapp.schema';

const tracking = new LeadTrackingService();

const QUESTION_VISIT_PREFERENCE =
  "Welcome to Chestone Properties. We're thrilled you reached out, and we'd love to help you secure the right space.\n\nTo make sure you get a true feel for this property and its potential, how would you prefer to explore it?";

const VISIT_PREFERENCE_BUTTONS: WhatsAppButtonOption[] = [
  { id: 'site_visit', title: 'Site Visit' },
  { id: 'virtual_tour', title: 'Virtual Tour' },
];

const QUESTION_CAPITAL_READINESS =
  "Wonderful. We want to ensure every property we show you perfectly aligns with your vision -- and we never want to waste your time on options that don't fit your strategy.\n\nTo help our Account Executives curate the right portfolio for you, how are you planning to structure the initial investment?";

const CAPITAL_READINESS_BUTTONS: WhatsAppButtonOption[] = [
  { id: 'cash', title: 'Cash / Liquid' },
  { id: 'off_plan', title: 'Off-Plan' },
  { id: 'mortgage', title: 'Mortgage' },
];

// Stored in leads.transaction_type verbatim (a free string column, no DB
// enum) -- keyed by the same ids the buttons/AI fallback use, so both paths
// land on one readable label rather than a raw slug like "off_plan".
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  cash: 'Cash / Liquid Funds',
  off_plan: 'Off-Plan Installments',
  mortgage: 'Mortgage Financing',
};

const QUESTION_BUDGET_FOLLOWUP =
  'Excellent choice. And roughly what budget are you working with, so we can tailor the shortlist precisely to your goals?';

const QUESTION_TIMELINE_CHECK =
  "We completely understand that securing a property from afar requires a massive amount of trust. We've guided many investors through this, and we'll arrange a detailed, high-resolution virtual walkthrough for you.\n\nTo help us align with developer availability and ensure you don't miss out on current pricing, when are you hoping to finalize your decision?";

const TIMELINE_BUTTONS: WhatsAppButtonOption[] = [
  { id: '1_14_days', title: '1-14 Days' },
  { id: '30_60_days', title: '30-60 Days' },
  { id: 'researching', title: 'Just Researching' },
];

// Same idea as TRANSACTION_TYPE_LABELS, for leads.purchase_timeline.
const TIMELINE_LABELS: Record<string, string> = {
  '1_14_days': 'Immediately (1-14 Days)',
  '30_60_days': 'Within 30-60 Days',
  researching: 'Just Researching For Now',
};

const QUESTION_PROXY_FOLLOWUP =
  'Noted. One last thing -- do you have a trusted representative here in Kenya who could join the viewing on your behalf?';

// Sent as the body of the tappable slot-list message, once qualification
// completes AND the opening message matched a real listing with at least
// one open slot -- lets the client pick an exact time instead of typing
// one freehand, fully native (no WhatsApp Flows encryption/publishing
// overhead -- see sendWhatsAppSlotList). The web booking link below is
// sent as a separate follow-up message right after this one, not fused
// into the same body -- an alternative for a client who'd rather browse
// on a bigger screen, never a replacement for the tap flow.
const CLOSING_WITH_BOOKING_OFFER =
  "Perfect, thank you for sharing that with us. Your preferences are securely logged.\n\nLet's get you one step closer to your new property. Pick a time below that works best for you and we'll get your visit booked in right away. If you'd prefer, one of our dedicated Account Executives will review your details and reach out shortly to coordinate personally instead.";

// Base URL of the public customer website -- falls back to the known
// production domain the same way public-site/lib/format.ts's WhatsApp
// links do, so a missing env var degrades to "still correct in prod"
// rather than a broken link.
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://chestoneproperties.com';

const BOOKING_LINK_FOLLOWUP = (link: string) =>
  `Prefer to browse and pick a time on a bigger screen? You can also book here: ${link}`;

// Sent once qualification completes but there's nothing to offer a slot
// list against -- no listing was matched, no agent is available to assign
// it to, or that agent has no open slots in the next two weeks. Goes
// straight to human handoff (the same fallback the original script
// offered as an alternative); deliberately generic since it covers all
// three of those reasons, not just "no property matched".
const CLOSING_HUMAN_HANDOFF =
  "Perfect, thank you for sharing that with us. Your preferences are securely logged. One of our dedicated Account Executives will review your details and reach out to you shortly to coordinate a viewing that works for you.";

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
      return {
        leadId: lead.id,
        leadName: lead.fullName ?? undefined,
        buttonOffer: { bodyText: QUESTION_VISIT_PREFERENCE, buttons: VISIT_PREFERENCE_BUTTONS, transcriptBody: '[Sent: Site Visit / Virtual Tour buttons]' },
        justQualified: false,
      };
    }

    // Stage: awaiting a scheduling reply for a self-booked visit -- takes
    // priority over everything else, since this is a direct answer to the
    // bot's own most recent question, not a fresh qualification message.
    if (lead.awaitingBookingReply) {
      // The booking link (if the client uses it instead) clears both of
      // these itself -- see public-booking.controller.ts -- but a WhatsApp
      // reply arriving here needs to do the same on this path.
      await tx.lead.update({ where: { id: lead.id }, data: { awaitingBookingReply: false, bookingToken: null } });

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

      if (!scheduledAt) {
        return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_UNPARSEABLE, justQualified: false };
      }

      const confirmation = await confirmLeadBooking(tx, lead, scheduledAt, 'WhatsApp');
      if (!confirmation.ok) {
        return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_UNPARSEABLE, justQualified: false };
      }
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: BOOKING_CONFIRMED(confirmation.whenLabel), justQualified: false };
    }

    // Stage 1: visit preference not yet answered. The deterministic tap
    // path is tried first (message.interactiveReplyId matches one of
    // VISIT_PREFERENCE_BUTTONS' ids); classifyVisitPreference is only a
    // fallback for a client who typed a free-text reply instead.
    if (!lead.visitPreference) {
      const preference =
        message.interactiveReplyId === 'virtual_tour'
          ? 'virtual'
          : message.interactiveReplyId === 'site_visit'
            ? 'in_person'
            : ((await classifyVisitPreference(messageText)) ?? 'in_person');
      await tx.lead.update({ where: { id: lead.id }, data: { visitPreference: preference } });
      const buttonOffer =
        preference === 'virtual'
          ? { bodyText: QUESTION_TIMELINE_CHECK, buttons: TIMELINE_BUTTONS, transcriptBody: '[Sent: Timeline Check buttons]' }
          : { bodyText: QUESTION_CAPITAL_READINESS, buttons: CAPITAL_READINESS_BUTTONS, transcriptBody: '[Sent: Capital Readiness buttons]' };
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, buttonOffer, justQualified: false };
    }

    // Stage 2: branch-specific classification (transactionType / purchaseTimeline)
    // not yet answered -- same tap-first, AI-fallback pattern as Stage 1.
    const classificationMissing = lead.visitPreference === 'virtual' ? !lead.purchaseTimeline : !lead.transactionType;

    if (classificationMissing) {
      if (lead.visitPreference === 'virtual') {
        const timelineKey =
          message.interactiveReplyId && message.interactiveReplyId in TIMELINE_LABELS
            ? message.interactiveReplyId
            : ((await classifyTimeline(messageText)) ?? 'researching');
        await tx.lead.update({ where: { id: lead.id }, data: { purchaseTimeline: TIMELINE_LABELS[timelineKey] } });
      } else {
        const transactionKey =
          message.interactiveReplyId && message.interactiveReplyId in TRANSACTION_TYPE_LABELS
            ? message.interactiveReplyId
            : ((await classifyTransactionType(messageText)) ?? 'cash');
        await tx.lead.update({ where: { id: lead.id }, data: { transactionType: TRANSACTION_TYPE_LABELS[transactionKey] } });
      }
      const followUpQuestion = lead.visitPreference === 'virtual' ? QUESTION_PROXY_FOLLOWUP : QUESTION_BUDGET_FOLLOWUP;
      return { leadId: lead.id, leadName: lead.fullName ?? undefined, reply: followUpQuestion, justQualified: false };
    }

    // Stage 3: the branch-specific free-text follow-up kept alongside the
    // new button classification -- budget amount (site visit) or the
    // diaspora proxy-visit check (virtual tour), same fields the original
    // script captured, just asked as their own message now instead of
    // bundled into the classification question.
    const followUpMissing = lead.visitPreference === 'virtual' ? lead.requiresProxyVisit === null : !lead.budgetRange;

    if (followUpMissing) {
      const updateData: Record<string, unknown> = {};
      if (lead.visitPreference === 'virtual') {
        // Always resolved to a concrete boolean (never left null) so this
        // stage can't loop forever re-asking the same question if the AI
        // extraction can't tell -- absent a clear "yes", assume no proxy.
        updateData.requiresProxyVisit = (await extractProxyVisitAnswer(messageText)) ?? false;
      } else {
        const { budgetRange } = await extractBudgetAnswer(messageText);
        updateData.budgetRange = budgetRange ?? messageText;
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
      let bookingLink: string | null = null;
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
            // Sent alongside the tap buttons, not instead of them (see
            // CLOSING_WITH_BOOKING_OFFER) -- the same slots the buttons
            // offer are also bookable through this link.
            const token = randomBytes(24).toString('hex');
            updateData.bookingToken = token;
            bookingLink = `${PUBLIC_SITE_URL}/book/${token}`;
          }
        }
      }

      await tx.lead.update({ where: { id: lead.id }, data: updateData });

      return {
        leadId: lead.id,
        leadName: lead.fullName ?? undefined,
        reply: slotOffer ? null : CLOSING_HUMAN_HANDOFF,
        slotOffer,
        bookingLink,
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

    // Sent as its own follow-up message right after the slot list, not
    // fused into one message -- best-effort and independently failable:
    // the lead can still tap a slot above even if this one send fails.
    if (outcome.bookingLink) {
      try {
        const linkText = BOOKING_LINK_FOLLOWUP(outcome.bookingLink);
        await sendWhatsAppText(rawWaId, linkText);
        await withSystemContext(async (tx) => {
          const botMessage = await tx.leadMessage.create({
            data: { leadId: outcome.leadId, direction: 'outbound', senderType: 'bot', body: linkText },
          });
          await tx.lead.update({ where: { id: outcome.leadId }, data: { lastMessageAt: botMessage.createdAt } });
        });
      } catch (error) {
        console.error('[WhatsApp] Booking link send failed (slot list still sent):', error);
      }
    }
  } else if (outcome.buttonOffer) {
    // Not run through generateBotReply's AI rephrasing -- same reasoning
    // as the slot list above: the body text is written to sit alongside a
    // fixed set of buttons, and a rephrase could drift from referencing
    // them correctly.
    try {
      await sendWhatsAppButtons(rawWaId, outcome.buttonOffer.bodyText, outcome.buttonOffer.buttons);
      await withSystemContext(async (tx) => {
        const botMessage = await tx.leadMessage.create({
          data: { leadId: outcome.leadId, direction: 'outbound', senderType: 'bot', body: outcome.buttonOffer!.transcriptBody },
        });
        await tx.lead.update({ where: { id: outcome.leadId }, data: { lastMessageAt: botMessage.createdAt } });
      });
    } catch (error) {
      console.error('[WhatsApp] Button send failed (lead data already saved):', error);
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
