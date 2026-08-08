import { LeadForm } from "@/components/leads/lead-form";
import { BackButton } from "@/components/back-button";

export default function NewLeadPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-2xl font-semibold">New Lead</h1>
      <LeadForm />
    </div>
  );
}
