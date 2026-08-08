// src/services/ai-provider.service.ts
//
// Shared chat-completion layer for every AI-assisted feature in this
// platform (the WhatsApp bot's reply guardrail in lead-ai-assistant.service.ts,
// and the ad-performance advisor in ad-ai-advisor.service.ts). Groq is the
// primary provider (fast, capable, generous free tier); a self-hosted
// Ollama instance running a small model on this same VPS is the fallback,
// used only when Groq fails -- this is what satisfies the MSA's "no
// external AI API cost" requirement as a guaranteed-available baseline,
// without giving up Groq's quality/speed for normal operation.
//
// Deliberately NOT load-balanced or round-robin: Ollama only runs on
// demand (CPU-only inference on a 2 vCPU/3.8GB VPS shared with Postgres),
// so it's reserved for the rare case Groq is actually unavailable, not
// used routinely.
//
// Not every caller uses the Ollama fallback (see useOllamaFallback below)
// -- verified live that the only model this VPS can run quickly enough
// (llama3.2:1b) is reliable for simple single-instruction prompts (the ad
// advisor) but unreliably drops instructions under a longer multi-rule
// prompt (the WhatsApp bot's, which opts out and falls straight to its
// own canned-text fallback instead).
import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

export interface ChatCompletionParams {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  /** Overrides the Ollama fallback's request timeout (default 30s). Latency-sensitive callers (e.g. the WhatsApp bot, benchmarked at 10s inbound-to-reply) should pass a shorter value; background/async callers can leave the generous default. */
  ollamaTimeoutMs?: number;
  /**
   * Set false to skip the Ollama fallback entirely and let a Groq failure
   * throw straight through. Verified live against llama3.2:1b (the only
   * model this VPS can run within a few seconds -- llama3.2:3b timed out
   * at 30s on this 2 vCPU/3.8GB box): it reliably holds the topic
   * guardrail, but unreliably drops other instructions under a long,
   * multi-rule prompt (2 of 3 test cases omitted the required qualification
   * question entirely). Fine for simpler single-instruction tasks like the
   * ad advisor; not trustworthy yet for the WhatsApp bot's full rule set,
   * where a dropped instruction stalls the qualification flow. Defaults
   * true (fallback enabled) since most callers have a simpler prompt.
   */
  useOllamaFallback?: boolean;
}

const callGroq = async (params: ChatCompletionParams): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 200,
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 },
  );

  const text = response.data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq returned an empty response');
  return text;
};

const callOllama = async (params: ChatCompletionParams): Promise<string> => {
  const response = await axios.post(
    OLLAMA_API_URL,
    {
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      stream: false,
      options: {
        num_predict: params.maxTokens ?? 200,
        temperature: params.temperature ?? 0.4,
      },
    },
    // Generous default timeout -- CPU-only local inference (no GPU on
    // this VPS) is much slower than Groq, and this only runs when Groq
    // has already failed, so a slow-but-successful fallback beats a fast
    // failure for callers that can afford to wait.
    { timeout: params.ollamaTimeoutMs ?? 30000 },
  );

  const text = response.data.message?.content?.trim();
  if (!text) throw new Error('Ollama returned an empty response');
  return text;
};

/**
 * Tries Groq first, falls back to the local Ollama instance if Groq fails
 * for any reason (missing key, network error, rate limit, timeout).
 * Throws only if both fail -- callers should have their own final fallback
 * (a canned response) for that case, same as before this abstraction existed.
 */
export const generateChatCompletion = async (params: ChatCompletionParams): Promise<string> => {
  try {
    return await callGroq(params);
  } catch (groqError) {
    if (params.useOllamaFallback === false) {
      throw groqError;
    }
    console.warn('[AI Provider] Groq failed, falling back to local Ollama:', (groqError as Error).message);
    try {
      return await callOllama(params);
    } catch (ollamaError) {
      console.error('[AI Provider] Ollama fallback also failed:', (ollamaError as Error).message);
      throw new Error(
        `Both Groq and Ollama failed. Groq: ${(groqError as Error).message}. Ollama: ${(ollamaError as Error).message}`,
      );
    }
  }
};
