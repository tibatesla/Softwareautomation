"use client";

import { useCurrency } from "./currency-provider";
import { convertAmount, formatAmount, formatAmountCompact } from "@/lib/currency";

/** Renders a single price, converted to whatever currency the visitor has
 * selected (see CurrencyProvider). Client component so it can react
 * instantly to a currency switch without a page reload, even when the
 * surrounding page (property detail, development hub) is a server
 * component fetching everything else. */
export function PriceDisplay({
  value,
  currency,
  compact = false,
}: {
  value: string;
  currency: string;
  compact?: boolean;
}) {
  const { currency: display, kesPerUsd } = useCurrency();
  const amount = Number(value);
  if (!amount) return <>Price on request</>;
  const converted = convertAmount(amount, currency, display, kesPerUsd);
  return <>{compact ? formatAmountCompact(converted, display) : formatAmount(converted, display)}</>;
}

/** Same idea as PriceDisplay, but for a min/max range -- mirrors the
 * min/max/single fallback logic formatPriceRange used to handle, just with
 * live currency conversion added. */
export function PriceRangeDisplay({
  min,
  max,
  single,
  currency,
  compact = false,
}: {
  min: string | null;
  max: string | null;
  single: string;
  currency: string;
  compact?: boolean;
}) {
  const { currency: display, kesPerUsd } = useCurrency();
  const format = compact ? formatAmountCompact : formatAmount;

  if (min && max) {
    const a = convertAmount(Number(min), currency, display, kesPerUsd);
    const b = convertAmount(Number(max), currency, display, kesPerUsd);
    return (
      <>
        {format(a, display)} – {format(b, display)}
      </>
    );
  }
  if (min || max) {
    const a = convertAmount(Number(min || max), currency, display, kesPerUsd);
    return <>{format(a, display)}</>;
  }
  return <PriceDisplay value={single} currency={currency} compact={compact} />;
}
