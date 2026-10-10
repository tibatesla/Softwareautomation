"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Contact, CircleCheck, UserPlus, Trophy, Trash2, MessageCircle } from "lucide-react";
import { useBulkDeleteLeads, useClaimLead, useLeads } from "@/lib/queries/leads";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { ReportDownloadMenu } from "@/components/report-download-menu";
import { LeadAssignSelect } from "@/components/leads/lead-assign-select";
import { LEAD_QUALIFICATION_COLOR } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const router = useRouter();
  const user = useAuthUser();
  const { data: leads, isLoading, error } = useLeads();
  const claimLead = useClaimLead();
  const bulkDelete = useBulkDeleteLeads();
  const canCreate = hasRole(user, ["owner", "admin"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Most recently active conversation first, so new activity is what you
  // see without having to hunt for it -- falls back to creation date for
  // leads that have no messages yet.
  const sortedLeads = leads
    ? [...leads].sort(
        (a, b) => new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime(),
      )
    : leads;
  const totalUnread = leads?.reduce((sum, l) => sum + l.unreadCount, 0) ?? 0;

  const allSelected = Boolean(sortedLeads?.length) && sortedLeads!.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (!sortedLeads) return;
    setSelected(allSelected ? new Set() : new Set(sortedLeads.map((l) => l.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(`Delete ${count} lead${count === 1 ? "" : "s"}? This can't be undone.`)) return;
    try {
      const result = await bulkDelete.mutateAsync([...selected]);
      setSelected(new Set());
      if (result.failed.length === 0) {
        toast.success(`Deleted ${result.deleted.length} lead${result.deleted.length === 1 ? "" : "s"}`);
      } else {
        toast.error(
          `Deleted ${result.deleted.length}, couldn't delete ${result.failed.length}: ${result.failed
            .map((f) => f.error)
            .join(" ")}`,
        );
      }
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex items-center gap-2">
          <ReportDownloadMenu resource="leads" />
          {canCreate && (
            <Button render={<Link href="/leads/new" />} nativeButton={false}>
              New Lead
            </Button>
          )}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading leads...</p>}
      {error && <p className="text-destructive">Failed to load leads.</p>}

      {leads && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Total" value={leads.length} icon={Contact} color="primary" />
          <StatCard label="Unread" value={totalUnread} icon={MessageCircle} color="danger" />
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

      {canCreate && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {sortedLeads && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canCreate && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                )}
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Deal stage</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Last activity</TableHead>
                {canCreate && <TableHead>Agent</TableHead>}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.map((lead) => {
                const isUnclaimed = !lead.claimedByAgentId;
                const isUnread = lead.unreadCount > 0;
                return (
                  <TableRow key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="cursor-pointer">
                    {canCreate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={() => toggleOne(lead.id)}
                          aria-label={`Select ${lead.fullName ?? lead.phoneNumber}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className={cn("flex items-center gap-2", isUnread && "font-semibold")}>
                      {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                      {lead.fullName ?? "Unnamed"}
                      {isUnread && (
                        <Badge variant="destructive" className="ml-auto">
                          {lead.unreadCount}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{lead.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant={LEAD_QUALIFICATION_COLOR[lead.qualificationStatus]}>
                        {lead.qualificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.dealStage.replace(/_/g, " ")}</TableCell>
                    <TableCell>{lead.targetSegment ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleString() : "—"}
                    </TableCell>
                    {canCreate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <LeadAssignSelect lead={lead} />
                      </TableCell>
                    )}
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
              {sortedLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canCreate ? 9 : 7} className="text-center text-muted-foreground">
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
