"use client";

import { useState } from "react";

/**
 * Gross rental yield only -- no mortgage/interest math. Chestone's
 * properties are cash/fixed-price purchases, not financed, so there's no
 * loan to model a monthly payment or amortization against; this just
 * answers "how does the rent compare to the price" from numbers the
 * visitor supplies themselves.
 */
export function PropertyCalculator({ startingPrice, currency }: { startingPrice: string; currency: string }) {
  const [monthlyRent, setMonthlyRent] = useState("");

  const price = Number(startingPrice) || 0;
  const rent = Number(monthlyRent) || 0;
  const annualRent = rent * 12;
  const grossYield = price > 0 && rent > 0 ? (annualRent / price) * 100 : null;
  const paybackYears = rent > 0 ? price / annualRent : null;

  return (
    <div className="card-shine rounded-3xl border border-white/50 p-6 md:p-8">
      <h3 className="font-serif text-xl font-semibold text-ivory">Rental Yield Calculator</h3>
      <p className="mt-1 text-sm text-stone">
        Estimate the gross rental yield on this property based on expected monthly rent.
      </p>

      <div className="mt-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-stone" htmlFor="monthly-rent">
          Expected Monthly Rent ({currency})
        </label>
        <input
          id="monthly-rent"
          type="number"
          min="0"
          inputMode="numeric"
          value={monthlyRent}
          onChange={(e) => setMonthlyRent(e.target.value)}
          placeholder="e.g. 80000"
          className="mt-2 w-full rounded-xl border border-black/10 bg-onyx-light px-4 py-3 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
        />
      </div>

      {grossYield !== null && (
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/10 pt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone">Gross Rental Yield</div>
            <div className="mt-1 font-serif text-2xl font-semibold text-gold">{grossYield.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone">Payback Period</div>
            <div className="mt-1 font-serif text-2xl font-semibold text-ivory">
              {paybackYears !== null ? `${paybackYears.toFixed(1)} yrs` : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
