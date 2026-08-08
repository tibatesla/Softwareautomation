import { PropertyForm } from "@/components/properties/property-form";
import { BackButton } from "@/components/back-button";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-2xl font-semibold">New Property</h1>
      <PropertyForm />
    </div>
  );
}
