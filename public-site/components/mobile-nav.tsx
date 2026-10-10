"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CurrencyToggle } from "./currency-toggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/#areas", label: "Areas" },
  { href: "/faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
];

export function MobileNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = () => {
    const q = query.trim();
    router.push(q ? `/properties?q=${encodeURIComponent(q)}` : "/properties");
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ivory"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="glass-bar fixed inset-x-0 top-20 z-40 border-b border-white/40 shadow-lg">
          <nav className="container-page flex flex-col gap-1 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
              className="mb-2 flex items-center gap-2 px-2"
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, area, or reference..."
                className="w-full rounded-xl border border-black/10 bg-onyx-light px-3 py-2.5 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="btn-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ivory"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-2 py-3 text-base font-medium text-stone transition-colors hover:bg-black/5 hover:text-ivory"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between px-2">
              <span className="text-sm font-medium text-stone">Currency</span>
              <CurrencyToggle />
            </div>
            <Link
              href="/properties"
              onClick={() => setOpen(false)}
              className="btn-gold mt-2 rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider text-ivory"
            >
              View Listings
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
