import { BookingForm } from "@/components/bookings/booking-form";
import { BackButton } from "@/components/back-button";

export default function NewBookingPage() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <BackButton />
      <h1 className="text-2xl font-semibold">New Booking</h1>
      <BookingForm />
    </div>
  );
}
