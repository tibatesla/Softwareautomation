import Image from "next/image";
import Link from "next/link";
import { PublicProperty } from "@/lib/types";
import { formatPrice, formatPriceRange } from "@/lib/format";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const priceLabel = formatPriceRange(property.priceMin, property.priceMax, property.currency) ??
    formatPrice(property.price, property.currency);

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone/10">
        {property.images[0] ? (
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone">No photo yet</div>
        )}
        {property.status === "reserved" && (
          <span className="absolute left-3 top-3 rounded-sm bg-navy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            Reserved
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-sm bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-navy-dark">
          {property.unitType || "Property"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-gold">{property.location}</span>
        <h3 className="font-serif text-lg font-semibold leading-snug text-navy">{property.title}</h3>
        {property.subLocation && <p className="text-xs text-stone">{property.subLocation}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-sm font-semibold text-ink">{priceLabel}</span>
          {property.houseSizeSqft && (
            <span className="text-xs text-stone">{Number(property.houseSizeSqft).toLocaleString()} sqft</span>
          )}
        </div>
      </div>
    </Link>
  );
}
