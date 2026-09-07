"use client";

import { useState } from "react";
import { confirmBooking, type BookingSlot } from "@/lib/api";

export function BookingSlotPicker({
  token,
  slots,
  currentName,
}: {
  token: string;
  slots: BookingSlot[];
  currentName: string | null;
}) {
  const [fullName, setFullName] = useState(currentName ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [whenLabel, setWhenLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canConfirm = fullName.trim().length > 0 && selected !== null;

  const handleConfirm = async () => {
    if (!canConfirm || !selected) return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await confirmBooking(token, selected, fullName.trim());
      setWhenLabel(result.whenLabel);
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="card-shine rounded-3xl border border-white/50 p-8 text-center">
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
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone">Your full name</span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Jane Wanjiru"
          className="rounded-2xl border border-black/10 bg-onyx-light px-4 py-3 text-sm text-ivory placeholder:text-stone/60 focus:border-gold/60 focus:outline-none"
        />
      </label>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => setSelected(slot.id)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              selected === slot.id
                ? "border-gold bg-gold text-ivory"
                : "border-black/10 bg-onyx-light text-ivory hover:border-gold/40"
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm || status === "submitting"}
        className="btn-gold mt-6 w-full rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-ivory disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Booking..." : "Confirm Visit"}
      </button>
    </div>
  );
}
