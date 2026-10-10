"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A plain price ceiling, not a loan affordability tool -- Chestone's
 * properties are fixed-price cash purchases, so there's no interest rate
 * or repayment period to reverse-solve from. The visitor just enters the
 * most they want to spend and we filter to it.
 */
export function BudgetCalculator({ minPrice, maxPrice }: { minPrice: number; maxPrice: number }) {
  const [budget, setBudget] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(budget.replace(/,/g, ""));
    if (!amount || amount <= 0) return;
    router.push(`/properties?maxPrice=${Math.round(amount)}`);
  };

  return (
    <div className="card-shine mx-auto max-w-xl rounded-3xl border border-white/50 p-8 text-center">
      <h3 className="font-serif text-2xl font-semibold text-ivory">Buy Within Your Budget</h3>
      <p className="mt-2 text-sm text-stone">
        Tell us your maximum budget and we&apos;ll show you what&apos;s available, from{" "}
        {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minPrice)}{" "}
        up to{" "}
        {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(maxPrice)}.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g. 15,000,000"
          aria-label="Maximum budget in KES"
          className="w-full rounded-full border border-black/10 bg-onyx-light px-5 py-3 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
        />
        <button
          type="submit"
          className="btn-gold shrink-0 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wider text-ivory"
        >
          Search Properties
        </button>
      </form>
    </div>
  );
}
