// src/services/lead-answer-extraction.service.ts
//
// Structured extraction for the WhatsApp qualification bot's branching
// script (lead-qualification.service.ts). Distinct from
// lead-ai-assistant.service.ts, which ONLY decides what text gets SAID
// back to a lead -- this layer decides what gets STORED, turning a single
// free-text reply that answers two things at once (e.g. "around 15M,
// thinking financing") into separate structured fields.
//
// Every function here returns null (or a null-valued field) on any
// failure -- a bad/empty AI response, a network error, unparseable JSON --
// rather than throwing. Callers fall back to a human-handoff message when
// extraction fails; the qualification flow must never get stuck waiting
// on an AI call that didn't come back cleanly.
import { generateChatCompletion } from './ai-provider.service';

const extractJson = async <T>(systemPrompt: string, userMessage: string): Promise<T | null> => {
  try {
    const raw = await generateChatCompletion({
      systemPrompt,
      userMessage,
      temperature: 0.1,
      // Generous headroom: the configured Groq model is a reasoning model
      // that spends tokens on an internal "reasoning" field before the
      // actual JSON answer -- too low a budget here gets the response
      // truncated to nothing (verified live: 150 was consumed entirely by
      // reasoning on even a trivial single-field extraction).
      maxTokens: 300,
      useOllamaFallback: false,
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch (error) {
    console.error('[Lead Answer Extraction] Failed:', (error as Error).message);
    return null;
  }
};

export const classifyVisitPreference = async (userMessage: string): Promise<'in_person' | 'virtual' | null> => {
  const result = await extractJson<{ preference: string }>(
    `Classify whether the person's message expresses a preference for an in-person property visit or a virtual/remote guided tour. Respond with ONLY a JSON object, nothing else: {"preference": "in_person"} or {"preference": "virtual"}.`,
    userMessage,
  );
  if (result?.preference === 'virtual' || result?.preference === 'in_person') return result.preference;
  return null;
};

export interface BudgetAnswer {
  budgetRange: string | null;
  transactionType: string | null;
}

export const extractBudgetAnswer = async (userMessage: string): Promise<BudgetAnswer> => {
  const result = await extractJson<BudgetAnswer>(
    `Extract two things from this person's reply about buying property: (1) the rough budget range they stated, as a short string in their own terms (or null if not mentioned), (2) whether they lean toward "cash" or "financing" (or null if not mentioned). Respond with ONLY JSON, nothing else: {"budgetRange": string|null, "transactionType": "cash"|"financing"|null}.`,
    userMessage,
  );
  return { budgetRange: result?.budgetRange ?? null, transactionType: result?.transactionType ?? null };
};

export interface TimelineAnswer {
  purchaseTimeline: string | null;
  requiresProxyVisit: boolean | null;
}

export const extractTimelineAnswer = async (userMessage: string): Promise<TimelineAnswer> => {
  const result = await extractJson<TimelineAnswer>(
    `Extract two things from this person's reply about a virtual property tour: (1) their purchase timeline as they stated it, as a short string (or null if not mentioned), (2) whether they have a trusted representative who can view the property in person on their behalf -- true, false, or null if not mentioned. Respond with ONLY JSON, nothing else: {"purchaseTimeline": string|null, "requiresProxyVisit": boolean|null}.`,
    userMessage,
  );
  return { purchaseTimeline: result?.purchaseTimeline ?? null, requiresProxyVisit: result?.requiresProxyVisit ?? null };
};

/**
 * Parses a free-text reply (e.g. "Saturday at 10am", "next Tuesday
 * afternoon") into an absolute future datetime, resolving relative terms
 * against `nowNairobi`. Kenya is fixed UTC+3 year-round (no DST), same
 * assumption agent-sla.service.ts already makes elsewhere. Returns null
 * for anything that isn't a clear, resolvable, future date/time -- the
 * caller hands off to a human rather than booking something ambiguous.
 */
export const parseScheduledDateTime = async (userMessage: string, nowNairobi: Date): Promise<Date | null> => {
  const todayLabel = nowNairobi.toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC', // nowNairobi is already shifted to EAT wall-clock below
  });

  const result = await extractJson<{ datetime: string | null }>(
    `Today is ${todayLabel} (Nairobi time). The person is replying with a preferred date and time for a property visit. Resolve any relative terms (e.g. "tomorrow", "next Tuesday") against today's date, and extract a specific future date and time as a local Nairobi datetime string in the exact format YYYY-MM-DDTHH:mm (24-hour). If the message doesn't clearly state a specific future date and time, respond {"datetime": null}. Respond with ONLY JSON, nothing else: {"datetime": string|null}.`,
    userMessage,
  );
  if (!result?.datetime) return null;

  const parsed = new Date(`${result.datetime}:00+03:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return null;
  return parsed;
};
