"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Its own horizontal carousel, separate from the photo gallery -- videos
 * need playback state (pausing an off-screen clip so it doesn't keep
 * playing audio after a swipe) and a fixed aspect-video frame, different
 * enough from photo cropping/lightbox browsing that sharing
 * PropertyGallery's logic would mean branching most of it by media type
 * anyway.
 */
export function PropertyVideos({ videos, title }: { videos: string[]; title: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);

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

  // Only the slide in view should ever be audible -- swiping away from a
  // playing clip pauses it rather than leaving it running off-screen.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (video && i !== active && !video.paused) video.pause();
    });
  }, [active]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  if (videos.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-semibold text-ivory">
        {videos.length === 1 ? "Property Video" : "Property Videos"}
      </h2>

      <div className="relative mt-4">
        <div ref={trackRef} className="scroll-pills flex snap-x snap-mandatory overflow-x-auto rounded-2xl">
          {videos.map((url, i) => (
            <div key={url} className="w-full shrink-0 snap-center">
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={url}
                controls
                playsInline
                preload="metadata"
                aria-label={`${title} video ${i + 1}`}
                className="aspect-video w-full bg-onyx-lighter object-cover"
              />
            </div>
          ))}
        </div>

        {videos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous video"
              onClick={() => goTo((active - 1 + videos.length) % videos.length)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-onyx/70 p-2 text-ivory transition-colors hover:bg-onyx md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 6 9 12 15 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next video"
              onClick={() => goTo((active + 1) % videos.length)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-onyx/70 p-2 text-ivory transition-colors hover:bg-onyx md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {videos.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {videos.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Go to video ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-gold" : "w-2 bg-black/15"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
