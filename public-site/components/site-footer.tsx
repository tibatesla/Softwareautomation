import Image from "next/image";
import Link from "next/link";
import { FOCUS_AREAS } from "@/lib/types";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/chestoneproperties_ke?igsh=MWN4cmw3Ymlzc244cg==",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/1Lv4EMcTP2/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.3c0-.87.24-1.46 1.5-1.46H16.6V4.14C16.33 4.1 15.4 4 14.32 4c-2.24 0-3.77 1.37-3.77 3.88V10.5H8v3h2.55V21h2.95Z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@chestone2026?_r=1&_t=ZS-98DW1HJwXXI",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 3c.34 1.96 1.7 3.5 3.5 3.9v2.9c-1.32-.02-2.55-.42-3.5-1.08v6.53c0 3.2-2.6 5.75-5.75 5.75S5 18.45 5 15.25 7.6 9.5 10.75 9.5c.3 0 .6.02.88.07v3.02a2.75 2.75 0 1 0 1.95 2.63V3h2.92Z" />
      </svg>
    ),
  },
];

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-onyx-light text-white/80">
      <div className="container-page grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.jpg" alt="Chestone Properties" width={40} height={40} className="rounded-md" />
            <span className="font-serif text-lg font-semibold text-white">Chestone Properties Ltd</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Structured property solutions across Nairobi&apos;s most sought-after neighborhoods — curated
            listings, transparent pricing, and a dedicated consultant for every enquiry.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Areas We Serve</h3>
          <ul className="mt-4 flex flex-col gap-2">
            {FOCUS_AREAS.map((area) => (
              <li key={area}>
                <Link
                  href={`/properties?area=${encodeURIComponent(area)}`}
                  className="text-sm text-white/70 transition-colors hover:text-gold"
                >
                  {area}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Get in Touch</h3>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-white/70">
            <li>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254726111133"}`}
                className="transition-colors hover:text-gold"
              >
                WhatsApp: +254 726 111133
              </a>
            </li>
            <li>
              <a href="mailto:info@chestoneproperties.com" className="transition-colors hover:text-gold">
                info@chestoneproperties.com
              </a>
            </li>
            <li>Nairobi, Kenya</li>
            <li>
              <Link href="/properties" className="transition-colors hover:text-gold">
                Browse all listings →
              </Link>
            </li>
            <li>
              <Link href="/faq" className="transition-colors hover:text-gold">
                Frequently asked questions →
              </Link>
            </li>
          </ul>

          <div className="mt-5 flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-gold hover:text-onyx"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/40 md:flex-row">
          <span>© {new Date().getFullYear()} Chestone Properties Ltd. All rights reserved.</span>
          <span>Structured Property Solutions</span>
        </div>
      </div>
    </footer>
  );
}
