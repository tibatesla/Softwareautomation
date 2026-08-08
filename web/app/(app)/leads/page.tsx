"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Contact, CircleCheck, UserPlus, Trophy } from "lucide-react";
import { useClaimLead, useLeads } from "@/lib/queries/leads";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { LEAD_QUALIFICATION_COLOR } from "@/lib/status-colors";

export default function LeadsPage() {
  const router = useRouter();
  const user = useAuthUser();
  const { data: leads, isLoading, error } = useLeads();
  const claimLead = useClaimLead();
  const canCreate = hasRole(user, ["owner", "admin"]);

  const handleClaim = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await claimLead.mutateAsync(id);
      toast.success("Lead claimed");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to claim lead";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        {canCreate && (
          <Button render={<Link href="/leads/new" />} nativeButton={false}>
            New Lead
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading leads...</p>}
      {error && <p className="text-destructive">Failed to load leads.</p>}

      {leads && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={leads.length} icon={Contact} color="primary" />
          <StatCard
            label="Qualified"
            value={leads.filter((l) => l.qualificationStatus === "qualified").length}
            icon={CircleCheck}
            color="info"
          />
          <StatCard
            label="Unclaimed"
            value={leads.filter((l) => !l.claimedByAgentId).length}
            icon={UserPlus}
            color="warning"
          />
          <StatCard
            label="Converted"
            value={leads.filter((l) => l.qualificationStatus === "converted").length}
            icon={Trophy}
            color="success"
          />
        </div>
      )}

      {leads && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Deal stage</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const isUnclaimed = !lead.claimedByAgentId;
                return (
                  <TableRow key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="cursor-pointer">
                    <TableCell className="font-medium">{lead.fullName ?? "Unnamed"}</TableCell>
                    <TableCell>{lead.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant={LEAD_QUALIFICATION_COLOR[lead.qualificationStatus]}>
                        {lead.qualificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.dealStage.replace(/_/g, " ")}</TableCell>
                    <TableCell>{lead.targetSegment ?? "—"}</TableCell>
                    <TableCell>
                      {user?.role === "agent" && isUnclaimed && (
                        <Button size="sm" onClick={(e) => handleClaim(e, lead.id)} disabled={claimLead.isPending}>
                          Claim
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No leads yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
