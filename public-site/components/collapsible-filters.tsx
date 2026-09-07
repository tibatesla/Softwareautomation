"use client";

import { useState } from "react";

/**
 * Wraps the Type/Price/Size/Project filter rows -- stacking all four rows
 * plus Area and Sort/View made a visitor scroll (or, on desktop, just
 * stare) past a wall of pills before seeing a single listing. Collapsed
 * behind a "Filters" toggle on every screen size now -- this used to force
 * itself open on desktop, but the same clutter the client flagged on
 * mobile turned out to look just as busy on a wide screen with ~30
 * developments in the Project row.
 */
export function CollapsibleFilters({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="card-shine flex items-center gap-2 rounded-full border border-white/50 px-4 py-2 text-sm font-medium text-ivory"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="10" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-semibold text-ivory">
            {activeCount}
          </span>
        )}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`${expanded ? "flex" : "hidden"} mt-3 flex-col gap-3`}>{children}</div>
    </div>
  );
}
