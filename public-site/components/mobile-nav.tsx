"use client";

import Link from "next/link";
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
  const [open, setOpen] = useState(false);

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
