"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDE_MS = 6000;
const FADE_MS = 1800;

/**
 * Full-bleed background slideshow for the homepage hero -- cross-fades
 * through a handful of real property photos (picked server-side in
 * page.tsx) rather than sliding/scrolling them, so text overlaid on top
 * never has to compete with motion. Renders first in the hero section's DOM
 * so later siblings (the decorative gold blur glows, the actual hero
 * copy) stack on top of it without needing an explicit z-index.
 */
export function HeroBackgroundSlider({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
  }, []);

  useEffect(() => {
    if (images.length <= 1 || reducedMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [images.length, reducedMotion]);

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className="object-cover"
          style={{ opacity: i === index ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}
        />
      ))}
      {/* Same dark tone as the hero's original solid bg-onyx, so the existing
          ivory text/gold accents keep exactly the contrast they were built for. */}
      <div className="absolute inset-0 bg-gradient-to-b from-onyx/85 via-onyx/75 to-onyx/90" />
    </div>
  );
}
