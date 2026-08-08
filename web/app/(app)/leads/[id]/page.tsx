"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useClaimLead, useLead, useLeadMessages, useSendLeadMessage } from "@/lib/queries/leads";
import { useProperties } from "@/lib/queries/properties";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { LEAD_QUALIFICATION_COLOR } from "@/lib/status-colors";
import { BackButton } from "@/components/back-button";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuthUser();
  const { data: lead, isLoading, error } = useLead(id);
  const { data: properties } = useProperties();
  const { data: messages } = useLeadMessages(id);
  const claimLead = useClaimLead();
  const sendMessage = useSendLeadMessage(id);
  const [reply, setReply] = useState("");

  if (isLoading) return <p className="text-muted-foreground">Loading lead...</p>;
  if (error || !lead) return <p className="text-destructive">Lead not found.</p>;

  const property = properties?.find((p) => p.id === lead.propertyId);
  const canManage = hasRole(user, ["owner", "admin"]);
  const isUnclaimed = !lead.claimedByAgentId;
  const canReply = canManage || (user?.role === "agent" && lead.claimedByAgentId === user.id);

  const handleClaim = async () => {
    try {
      await claimLead.mutateAsync(lead.id);
      toast.success("Lead claimed");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to claim lead";
      toast.error(message);
    }
  };

  const handleSendReply = async () => {
    const body = reply.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync(body);
      setReply("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to send message";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.fullName ?? "Unnamed lead"}</h1>
          <p className="text-muted-foreground">{lead.phoneNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={LEAD_QUALIFICATION_COLOR[lead.qualificationStatus]}>{lead.qualificationStatus}</Badge>
          {user?.role === "agent" && isUnclaimed && (
            <Button onClick={handleClaim} disabled={claimLead.isPending}>
              Claim
            </Button>
          )}
          {canManage && (
            <Button render={<Link href={`/leads/${lead.id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <Field label="Email" value={lead.email} />
        <Field label="Source" value={lead.source} />
        <Field label="Property" value={property?.title} />
        <Field label="Deal stage" value={lead.dealStage.replace(/_/g, " ")} />
        <Field label="Target segment" value={lead.targetSegment} />
        <Field label="Budget range" value={lead.budgetRange} />
        <Field label="Preferred unit" value={lead.preferredUnit} />
        <Field label="Purchase timeline" value={lead.purchaseTimeline} />
        <Field label="Investment type" value={lead.investmentType} />
        <Field label="Transaction type" value={lead.transactionType} />
        <Field label="Country code" value={lead.countryCode} />
        <Field label="Overnight diaspora" value={lead.isOvernightDiaspora ? "Yes" : "No"} />
        <Field label="Requires proxy visit" value={lead.requiresProxyVisit ? "Yes" : "No"} />
        <Field label="Proxy phone number" value={lead.proxyPhoneNumber} />
        <Field label="Claimed at" value={lead.claimedAt ? new Date(lead.claimedAt).toLocaleString() : null} />
      </section>

      {((messages && messages.length > 0) || canReply) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">WhatsApp conversation</h2>
          {messages && messages.length > 0 && (
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-lg border p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col gap-0.5 ${message.direction === "outbound" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.direction === "outbound"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.body}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {message.senderType === "bot" && "Bot · "}
                    {message.senderType === "human" && "Consultant · "}
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {canReply && (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={2}
                placeholder="Reply on WhatsApp..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={sendMessage.isPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSendReply}
                  disabled={sendMessage.isPending || !reply.trim()}
                >
                  {sendMessage.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                WhatsApp only allows replies within 24 hours of the contact&apos;s last message.
              </p>
            </div>
          )}
        </section>
      )}

      {lead.tags.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {lead.tags.map((tag) => (
              <Badge key={tag} variant="info">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
