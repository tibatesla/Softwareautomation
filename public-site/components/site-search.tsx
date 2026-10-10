"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Free-text search, header-mounted. Submits to /properties?q=... rather
 * than a dedicated /search route -- that page already canonicalizes every
 * filter combination back to itself (see app/properties/page.tsx), so a
 * search result never becomes a separate indexed URL for the same reason
 * the area/type/price filters don't.
 */
export function SiteSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const q = query.trim();
    router.push(q ? `/properties?q=${encodeURIComponent(q)}` : "/properties");
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? "Close search" : "Search properties"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-stone transition-colors hover:bg-black/5 hover:text-ivory"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="card-shine absolute right-0 top-full mt-3 w-72 rounded-2xl border border-white/50 p-2 sm:w-80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, area, or reference..."
              className="w-full rounded-xl border border-black/10 bg-onyx-light px-3 py-2.5 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="btn-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivory"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
