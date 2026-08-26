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

// Fallback for a client who types a free-text reply instead of tapping one
// of the Capital Readiness buttons (cash / off-plan / mortgage) -- the
// deterministic tap path (message.interactiveReplyId) is tried first by the
// caller, this is only reached when that's absent.
export const classifyTransactionType = async (userMessage: string): Promise<'cash' | 'off_plan' | 'mortgage' | null> => {
  const result = await extractJson<{ type: string }>(
    `Classify how this person plans to structure a property purchase: "cash" (cash or other liquid funds), "off_plan" (off-plan installment payments to the developer), or "mortgage" (bank mortgage financing). Respond with ONLY JSON, nothing else: {"type": "cash"|"off_plan"|"mortgage"}.`,
    userMessage,
  );
  if (result?.type === 'cash' || result?.type === 'off_plan' || result?.type === 'mortgage') return result.type;
  return null;
};

// Same fallback role as classifyTransactionType, for the Timeline Check
// buttons (1-14 days / 30-60 days / just researching).
export const classifyTimeline = async (userMessage: string): Promise<'1_14_days' | '30_60_days' | 'researching' | null> => {
  const result = await extractJson<{ timeline: string }>(
    `Classify this person's property purchase timeline: "1_14_days" (ready to move immediately, within about two weeks), "30_60_days" (planning to finalize within the next one to two months), or "researching" (just researching for now, no firm timeline). Respond with ONLY JSON, nothing else: {"timeline": "1_14_days"|"30_60_days"|"researching"}.`,
    userMessage,
  );
  if (result?.timeline === '1_14_days' || result?.timeline === '30_60_days' || result?.timeline === 'researching') return result.timeline;
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

export const extractProxyVisitAnswer = async (userMessage: string): Promise<boolean | null> => {
  const result = await extractJson<{ requiresProxyVisit: boolean | null }>(
    `Extract whether this person says they have a trusted representative who can view the property in person on their behalf -- true, false, or null if not clearly stated. Respond with ONLY JSON, nothing else: {"requiresProxyVisit": boolean|null}.`,
    userMessage,
  );
  return result?.requiresProxyVisit ?? null;
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
