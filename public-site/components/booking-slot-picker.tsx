"use client";

import { useState } from "react";
import { confirmBooking, type BookingSlot } from "@/lib/api";

export function BookingSlotPicker({ token, slots }: { token: string; slots: BookingSlot[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [whenLabel, setWhenLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selected) return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await confirmBooking(token, selected);
      setWhenLabel(result.whenLabel);
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="rounded-md border border-white/10 bg-onyx-light p-8 text-center">
        <h2 className="font-serif text-xl font-semibold text-ivory">You&apos;re all set</h2>
        <p className="mt-2 text-sm text-stone">
          Your visit is booked for <span className="font-semibold text-gold">{whenLabel}</span>. We&apos;ve sent a
          confirmation on WhatsApp -- if anything changes, just let us know there.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => setSelected(slot.id)}
            className={`rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
              selected === slot.id
                ? "border-gold bg-gold text-onyx"
                : "border-white/10 bg-onyx-light text-ivory hover:border-gold/40"
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {errorMessage && <p className="mt-4 text-sm text-red-400">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selected || status === "submitting"}
        className="mt-6 w-full rounded-sm bg-gold px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-onyx transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Booking..." : "Confirm Visit"}
      </button>
    </div>
  );
}
