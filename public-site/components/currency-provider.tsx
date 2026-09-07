"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCY_STORAGE_KEY, DisplayCurrency, FALLBACK_KES_PER_USD } from "@/lib/currency";

interface CurrencyContextValue {
  currency: DisplayCurrency;
  kesPerUsd: number;
  setCurrency: (currency: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "KES",
  kesPerUsd: FALLBACK_KES_PER_USD,
  setCurrency: () => {},
});

/** `kesPerUsd` comes from the server (see layout.tsx) so every price on the
 * site converts against the same rate. The chosen display currency itself
 * is a per-visitor preference, remembered in localStorage so it survives
 * navigating between pages and repeat visits. */
export function CurrencyProvider({ kesPerUsd, children }: { kesPerUsd: number; children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("KES");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (stored === "KES" || stored === "USD") setCurrencyState(stored);
    } catch {
      // Private browsing / storage blocked -- just stays on the KES default.
    }
  }, []);

  const setCurrency = (next: DisplayCurrency) => {
    setCurrencyState(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      // Nothing to do if storage isn't available -- the in-memory state still updates.
    }
  };

  return <CurrencyContext.Provider value={{ currency, kesPerUsd, setCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
