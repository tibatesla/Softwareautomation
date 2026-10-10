"use client";

import { useState } from "react";

/**
 * Embeds externally-hosted 360/VR tours (e.g. vr.justeasy.cn) via iframe.
 * These are third-party pages we don't control, so the "Open in new tab"
 * link is a deliberate fallback -- if a provider ever sets
 * X-Frame-Options/CSP that blocks embedding, the iframe just shows a blank
 * box but the link still gets a visitor to the tour.
 */
export function PropertyVrTour({ urls, title }: { urls: string[]; title: string }) {
  const [active, setActive] = useState(0);

  if (urls.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-ivory">
          {urls.length === 1 ? "Virtual Tour" : "Virtual Tours"}
        </h2>
        <a
          href={urls[active]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold uppercase tracking-wider text-gold underline-offset-4 hover:underline"
        >
          Open Full Screen ↗
        </a>
      </div>

      {urls.length > 1 && (
        <div className="scroll-pills mt-4 flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === active ? "bg-gold text-ivory" : "bg-onyx-light text-stone ring-1 ring-black/10 hover:ring-gold/40"
              }`}
            >
              Tour {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl bg-onyx-lighter">
        <iframe
          key={urls[active]}
          src={urls[active]}
          title={`${title} virtual tour${urls.length > 1 ? ` ${active + 1}` : ""}`}
          allow="accelerometer; gyroscope; fullscreen"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      </div>
    </section>
  );
}
