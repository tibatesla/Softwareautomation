import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-onyx/90 backdrop-blur-md">
      <div className="container-page flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-mark.jpg"
            alt="Chestone Properties"
            width={44}
            height={44}
            className="rounded-md"
            priority
          />
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-semibold tracking-wide text-ivory">CHESTONE</span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-gold">Properties Ltd</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          <Link href="/" className="text-sm font-medium text-stone transition-colors hover:text-ivory">
            Home
          </Link>
          <Link href="/properties" className="text-sm font-medium text-stone transition-colors hover:text-ivory">
            Properties
          </Link>
          <Link href="/#areas" className="text-sm font-medium text-stone transition-colors hover:text-ivory">
            Areas
          </Link>
          <Link href="/faq" className="text-sm font-medium text-stone transition-colors hover:text-ivory">
            FAQ
          </Link>
          <Link href="/#contact" className="text-sm font-medium text-stone transition-colors hover:text-ivory">
            Contact
          </Link>
        </nav>

        <Link
          href="/properties"
          className="hidden rounded-sm bg-gold px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-onyx transition-colors hover:bg-gold-light md:inline-block"
        >
          View Listings
        </Link>

        <MobileNav />
      </div>
    </header>
  );
}
