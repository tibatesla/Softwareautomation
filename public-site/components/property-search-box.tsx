"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Free-text search box embedded on the /properties page itself, so a
 * visitor who arrived via the header search (or a shared /properties?q=...
 * link) can see and refine their query alongside the other filters.
 * Receives the current filters as a plain serializable object (not a
 * function -- Server Components can't pass closures to Client Components)
 * and rebuilds the URL the same way app/properties/page.tsx's own
 * buildHref does.
 */
export function PropertySearchBox({ currentParams }: { currentParams: Record<string, string | undefined> }) {
  const router = useRouter();
  const [value, setValue] = useState(currentParams.q ?? "");

  const go = (q: string | undefined) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(currentParams)) {
      if (key !== "q" && val) params.set(key, val);
    }
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(qs ? `/properties?${qs}` : "/properties");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value.trim() || undefined);
      }}
      className="mt-6 flex max-w-md items-center gap-2"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name, area, or reference..."
        className="w-full rounded-full border border-black/10 bg-onyx-light px-4 py-2.5 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="btn-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ivory"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
        </svg>
      </button>
      {currentParams.q && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go(undefined);
          }}
          className="shrink-0 text-xs font-medium text-stone underline-offset-4 hover:text-gold hover:underline"
        >
          Clear
        </button>
      )}
    </form>
  );
}
