"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PublicProperty } from "@/lib/types";
import { formatPrice, formatPriceRange, formatSizeRange } from "@/lib/format";

export function PropertyCard({ property, view = "grid" }: { property: PublicProperty; view?: "grid" | "list" }) {
  const [active, setActive] = useState(0);
  const priceLabel = formatPriceRange(property.priceMin, property.priceMax, property.currency) ??
    formatPrice(property.price, property.currency);
  const sizeLabel = formatSizeRange(property.houseSizeSqftMin, property.houseSizeSqftMax, property.houseSizeSqft);
  const images = property.images;

  // Hover-scrub: moving the cursor across the image cycles through photos
  // based on horizontal position, same trick most property portals use so
  // a visitor can preview the gallery without leaving the card. Only
  // wired up in grid view -- list view's thumbnail is too small for this
  // to be a meaningful preview.
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (view !== "grid" || images.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const index = Math.min(images.length - 1, Math.max(0, Math.floor(ratio * images.length)));
    setActive(index);
  };

  const image = (
    <div
      className={`relative overflow-hidden bg-onyx-lighter ${view === "grid" ? "aspect-[4/3] w-full" : "aspect-[4/3] w-40 shrink-0 sm:w-56"}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setActive(0)}
    >
      {images.length > 0 ? (
        <Image
          src={images[active]}
          alt={property.title}
          fill
          sizes={view === "grid" ? "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" : "224px"}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-stone">No photo yet</div>
      )}

      {view === "grid" && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-gold" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}

      {property.status === "reserved" && (
        <span className="absolute left-2 top-2 rounded-sm bg-onyx/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ivory">
          Reserved
        </span>
      )}
      <span className="absolute right-2 top-2 rounded-sm bg-gold px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-onyx">
        {property.unitType || "Property"}
      </span>
    </div>
  );

  const details = (
    <div className={`flex flex-1 flex-col gap-2 ${view === "grid" ? "p-5" : "p-4 sm:p-5"}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-gold">{property.location}</span>
      <h3 className="font-serif text-lg font-semibold leading-snug text-ivory">{property.title}</h3>
      {property.subLocation && <p className="text-xs text-stone">{property.subLocation}</p>}
      <div className={`flex items-center justify-between gap-3 border-white/10 ${view === "grid" ? "mt-auto border-t pt-3" : "mt-1"}`}>
        <span className="text-sm font-semibold text-ivory">{priceLabel}</span>
        {sizeLabel && <span className="text-xs text-stone">{sizeLabel}</span>}
      </div>
    </div>
  );

  if (view === "list") {
    return (
      <Link
        href={`/properties/${property.id}`}
        className="group flex overflow-hidden rounded-md border border-white/10 bg-onyx-light transition-all hover:border-gold/40 hover:shadow-xl hover:shadow-black/40"
      >
        {image}
        {details}
      </Link>
    );
  }

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-white/10 bg-onyx-light transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl hover:shadow-black/40"
    >
      {image}
      {details}
    </Link>
  );
}
