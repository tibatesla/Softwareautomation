export type DisplayCurrency = "KES" | "USD";

export const CURRENCY_STORAGE_KEY = "chestone-display-currency";

// Used only if the live rate fetch below fails -- a reasonable stand-in so
// USD prices are never simply broken, just possibly a little stale.
export const FALLBACK_KES_PER_USD = 129;

/** Server-side only -- fetched once per revalidation window and passed down
 * to CurrencyProvider, so every price on the site converts using the same
 * rate rather than each component fetching (and possibly disagreeing)
 * independently. */
export async function fetchKesPerUsd(): Promise<number> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 21600 }, // 6h -- exchange rates don't need to be second-fresh
    });
    if (!response.ok) return FALLBACK_KES_PER_USD;
    const data = await response.json();
    const rate = data?.rates?.KES;
    return typeof rate === "number" && rate > 0 ? rate : FALLBACK_KES_PER_USD;
  } catch {
    return FALLBACK_KES_PER_USD;
  }
}

/** Converts a raw amount from its stored currency to the visitor's chosen
 * display currency. Only KES<->USD is meaningful here -- Chestone listings
 * are priced in KES, so `from` is realistically always "KES"; any other
 * stored currency is shown unconverted rather than guessed at. */
export function convertAmount(amount: number, from: string, to: DisplayCurrency, kesPerUsd: number): number {
  if (from === to) return amount;
  if (from === "KES" && to === "USD") return amount / kesPerUsd;
  if (from === "USD" && to === "KES") return amount * kesPerUsd;
  return amount;
}

export function formatAmount(amount: number, currency: DisplayCurrency): string {
  if (!amount) return "Price on request";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
