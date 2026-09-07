// Renders a property/development's amenities as pills, with any amenity
// the agent marked "Outstanding" in the CRM shown gold-highlighted and
// sorted first -- everything else keeps the plain ring-style pill.
export function AmenitiesList({ amenities, outstanding }: { amenities: string[]; outstanding: string[] }) {
  const outstandingSet = new Set(outstanding);
  const sorted = [...amenities].sort((a, b) => Number(outstandingSet.has(b)) - Number(outstandingSet.has(a)));

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((amenity) =>
        outstandingSet.has(amenity) ? (
          <span
            key={amenity}
            className="flex items-center gap-1 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ivory"
          >
            <span aria-hidden>★</span>
            {amenity}
          </span>
        ) : (
          <span
            key={amenity}
            className="rounded-full bg-onyx-light px-3.5 py-1.5 text-xs font-medium text-ivory ring-1 ring-black/10"
          >
            {amenity}
          </span>
        ),
      )}
    </div>
  );
}
