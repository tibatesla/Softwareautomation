"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { GalleryLightbox } from "./gallery-lightbox";

export function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Tracks which slide is centered as the user swipes, so the dot
  // indicators stay in sync with native scroll-snap (no drag/swipe JS
  // needed -- the browser handles the gesture, this just observes it).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame: number;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const index = Math.round(track.scrollLeft / track.clientWidth);
        setActive(index);
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  const extraCount = images.length - 5;

  return (
    <>
      {/* Mobile: swipeable slider, tap a photo to open the full-screen viewer */}
      <div className="mt-8 md:hidden">
        <div ref={trackRef} className="scroll-pills flex snap-x snap-mandatory overflow-x-auto rounded-md">
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              aria-label={`View photo ${i + 1} full screen`}
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-stone/10"
            >
              <Image
                src={url}
                alt={`${title} photo ${i + 1}`}
                fill
                sizes="100vw"
                className="object-cover"
                priority={i === 0}
              />
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-gold" : "w-2 bg-navy/20"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: static grid, click any tile to browse the full set in the viewer */}
      <div className="mt-8 hidden gap-3 md:grid md:h-[520px] md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          aria-label="View photo 1 full screen"
          onClick={() => setLightboxIndex(0)}
          className="group relative overflow-hidden rounded-md bg-stone/10 md:col-span-2 md:row-span-2 md:h-full"
        >
          <Image
            src={images[0]}
            alt={title}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority
          />
        </button>
        {images.slice(1, 5).map((url, i) => {
          const index = i + 1;
          const isLastTile = index === 4;
          return (
            <button
              key={url}
              type="button"
              aria-label={`View photo ${index + 1} full screen`}
              onClick={() => setLightboxIndex(index)}
              className="group relative overflow-hidden rounded-md bg-stone/10 md:h-full"
            >
              <Image
                src={url}
                alt={`${title} photo ${index + 1}`}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {isLastTile && extraCount > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-dark/60 text-lg font-semibold text-white">
                  +{extraCount} more
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          title={title}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
