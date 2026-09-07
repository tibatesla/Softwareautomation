import { notFound } from "next/navigation";
import { getBookingOptions } from "@/lib/api";
import { BookingSlotPicker } from "@/components/booking-slot-picker";

export const metadata = {
  title: "Book Your Visit | Chestone Properties Ltd",
};

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const options = await getBookingOptions(token).catch(() => null);

  if (!options) {
    notFound();
  }

  return (
    <div className="container-page max-w-2xl py-16 md:py-20">
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
        {options.isVirtual ? "Virtual Tour" : "Site Visit"}
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-ivory md:text-4xl">Pick a time that works for you</h1>
      <p className="mt-3 text-sm text-stone">
        {options.propertyTitle && <>For {options.propertyTitle}. </>}
        {options.agentName && <>You&apos;ll be meeting with {options.agentName}. </>}
        Choose one of the available times below and we&apos;ll confirm your visit right away.
      </p>

      <div className="gold-rule mt-8" />

      <div className="mt-8">
        {options.slots.length > 0 ? (
          <BookingSlotPicker token={token} slots={options.slots} currentName={options.currentName} />
        ) : (
          <p className="text-sm text-stone">
            No open times right now -- please message us on WhatsApp and we&apos;ll coordinate a time directly.
          </p>
        )}
      </div>
    </div>
  );
}
