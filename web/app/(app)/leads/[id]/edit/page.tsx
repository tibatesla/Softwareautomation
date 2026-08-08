"use client";

import { use } from "react";
import { useLead } from "@/lib/queries/leads";
import { LeadForm } from "@/components/leads/lead-form";
import { BackButton } from "@/components/back-button";

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: lead, isLoading, error } = useLead(id);

  if (isLoading) return <p className="text-muted-foreground">Loading lead...</p>;
  if (error || !lead) return <p className="text-destructive">Lead not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-2xl font-semibold">Edit Lead</h1>
      <LeadForm lead={lead} />
    </div>
  );
}
