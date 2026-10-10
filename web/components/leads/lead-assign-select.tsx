"use client";

import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssignLead } from "@/lib/queries/leads";
import { useUsers } from "@/lib/queries/users";
import { ApiError } from "@/lib/api";
import type { Lead } from "@/lib/types";

/**
 * Owner/Admin (re)assignment control -- distinct from the Agent-only
 * "Claim" button, which is self-service and restricted to unclaimed,
 * qualified leads. This can point a lead at any active agent at any time,
 * including overriding an existing claim.
 */
export function LeadAssignSelect({ lead }: { lead: Lead }) {
  const { data: users } = useUsers();
  const agents = (users ?? []).filter((u) => u.role === "agent" && u.isActive);
  const assignLead = useAssignLead();

  const handleChange = async (agentId: string | null) => {
    if (!agentId || agentId === lead.claimedByAgentId) return;
    try {
      await assignLead.mutateAsync({ id: lead.id, agentId });
      toast.success("Lead assigned");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to assign lead";
      toast.error(message);
    }
  };

  return (
    <Select
      value={lead.claimedByAgentId ?? undefined}
      onValueChange={handleChange}
      items={Object.fromEntries(agents.map((a) => [a.id, a.fullName]))}
      disabled={assignLead.isPending}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id} label={a.fullName}>
            {a.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
