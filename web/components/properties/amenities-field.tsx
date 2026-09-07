"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTY_AMENITY_VALUES } from "@/lib/property-constants";

interface AmenitiesFieldProps {
  amenities: string[];
  outstanding: string[];
  onChange: (amenities: string[], outstanding: string[]) => void;
}

/**
 * Amenities are free text now, not a fixed checklist (client asked for a
 * way to add anything, not just what's on the preset list) -- this renders
 * the property's current amenities as removable chips, each with a star
 * toggle for "Outstanding" (the client's other ask: highlight key
 * amenities), plus one-click suggestions from the old preset list and a
 * free-text box for anything not on it.
 */
export function AmenitiesField({ amenities, outstanding, onChange }: AmenitiesFieldProps) {
  const [draft, setDraft] = useState("");

  const addAmenity = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || amenities.includes(trimmed)) return;
    onChange([...amenities, trimmed], outstanding);
    setDraft("");
  };

  const removeAmenity = (value: string) => {
    onChange(
      amenities.filter((a) => a !== value),
      outstanding.filter((a) => a !== value),
    );
  };

  const toggleOutstanding = (value: string) => {
    onChange(amenities, outstanding.includes(value) ? outstanding.filter((a) => a !== value) : [...outstanding, value]);
  };

  const suggestions = PROPERTY_AMENITY_VALUES.filter((a) => !amenities.includes(a));

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap gap-2">
        {amenities.length === 0 && <p className="text-sm text-muted-foreground">No amenities added yet.</p>}
        {amenities.map((amenity) => {
          const isOutstanding = outstanding.includes(amenity);
          return (
            <span
              key={amenity}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                isOutstanding ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300" : "bg-muted"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleOutstanding(amenity)}
                aria-label={isOutstanding ? `Unmark ${amenity} as outstanding` : `Mark ${amenity} as outstanding`}
                title="Highlight as an Outstanding amenity"
              >
                <Star className={`size-3.5 ${isOutstanding ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
              </button>
              {amenity}
              <button type="button" onClick={() => removeAmenity(amenity)} aria-label={`Remove ${amenity}`}>
                <X className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAmenity(draft);
              }
            }}
            placeholder="Add a custom amenity and press Enter"
          />
          <Button type="button" variant="outline" onClick={() => addAmenity(draft)}>
            Add
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((amenity) => (
              <button
                key={amenity}
                type="button"
                onClick={() => addAmenity(amenity)}
                className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
              >
                + {amenity}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
