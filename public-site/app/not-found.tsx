import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center gap-4 py-32 text-center">
      <span className="font-serif text-6xl font-semibold text-gold">404</span>
      <h1 className="font-serif text-2xl font-semibold text-ivory">Page not found</h1>
      <p className="text-sm text-stone">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link
        href="/"
        className="btn-gold mt-4 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wider text-ivory"
      >
        Back to Home
      </Link>
    </div>
  );
}
