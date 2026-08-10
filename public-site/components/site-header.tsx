import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-ivory/90 backdrop-blur-md">
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
            <span className="font-serif text-lg font-semibold tracking-wide text-navy">CHESTONE</span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-gold">Properties Ltd</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          <Link href="/" className="text-sm font-medium text-ink transition-colors hover:text-navy">
            Home
          </Link>
          <Link href="/properties" className="text-sm font-medium text-ink transition-colors hover:text-navy">
            Properties
          </Link>
          <Link href="/#areas" className="text-sm font-medium text-ink transition-colors hover:text-navy">
            Areas
          </Link>
          <Link href="/#contact" className="text-sm font-medium text-ink transition-colors hover:text-navy">
            Contact
          </Link>
        </nav>

        <Link
          href="/properties"
          className="hidden rounded-sm bg-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light md:inline-block"
        >
          View Listings
        </Link>

        <MobileNav />
      </div>
    </header>
  );
}
