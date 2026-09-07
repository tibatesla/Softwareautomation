"use client";

import { useCurrency } from "./currency-provider";

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-onyx-light p-1 ring-1 ring-black/10" role="group" aria-label="Display currency">
      {(["KES", "USD"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setCurrency(option)}
          aria-pressed={currency === option}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            currency === option ? "bg-gold text-ivory" : "text-stone hover:text-ivory"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
