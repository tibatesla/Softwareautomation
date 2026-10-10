"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Smartphone, Mail, Megaphone, Loader2 } from "lucide-react";
import { useLeads } from "@/lib/queries/leads";
import { useSendBroadcast, type BroadcastChannel, type BroadcastTarget, type BroadcastResponse } from "@/lib/queries/communications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api";

const CHANNELS: { value: BroadcastChannel; label: string; icon: typeof MessageCircle; available: boolean }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, available: true },
  { value: "sms", label: "SMS", icon: Smartphone, available: false },
  { value: "email", label: "Email", icon: Mail, available: false },
];

export default function CommunicationsPage() {
  const { data: leads } = useLeads();
  const sendBroadcast = useSendBroadcast();

  const [channel, setChannel] = useState<BroadcastChannel>("whatsapp");
  const [target, setTarget] = useState<BroadcastTarget>("single");
  const [leadId, setLeadId] = useState<string | undefined>(undefined);
  const [body, setBody] = useState("");
  const [result, setResult] = useState<BroadcastResponse | null>(null);

  const recipientCount = target === "all" ? leads?.length ?? 0 : leadId ? 1 : 0;
  const canSend = channel === "whatsapp" && body.trim().length > 0 && (target === "all" ? (leads?.length ?? 0) > 0 : Boolean(leadId));

  const handleSend = async () => {
    if (target === "all") {
      const ok = window.confirm(`Send this message to all ${leads?.length ?? 0} leads? This can't be undone.`);
      if (!ok) return;
    }
    setResult(null);
    try {
      const response = await sendBroadcast.mutateAsync({
        channel,
        target,
        leadId: target === "single" ? leadId : undefined,
        body: body.trim(),
      });
      setResult(response);
      toast.success(`Sent to ${response.sent} of ${response.total}`);
      if (response.failed === 0) setBody("");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to send broadcast";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Communications</h1>
        <p className="text-muted-foreground">Message a single lead or everyone at once.</p>
      </div>

      <div className="flex max-w-2xl flex-col gap-6 rounded-lg border p-6">
        <div className="flex flex-col gap-2">
          <Label>Channel</Label>
          <div className="flex gap-2">
            {CHANNELS.map((c) => (
              <Button
                key={c.value}
                type="button"
                variant={channel === c.value ? "default" : "outline"}
                onClick={() => c.available && setChannel(c.value)}
                disabled={!c.available}
                className="flex-1"
              >
                <c.icon className="size-4" />
                {c.label}
                {!c.available && (
                  <Badge variant="outline" className="ml-1">
                    Coming soon
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Send to</Label>
          <div className="flex gap-2">
            <Button type="button" variant={target === "single" ? "default" : "outline"} onClick={() => setTarget("single")} className="flex-1">
              Single lead
            </Button>
            <Button type="button" variant={target === "all" ? "default" : "outline"} onClick={() => setTarget("all")} className="flex-1">
              All leads
            </Button>
          </div>
        </div>

        {target === "single" ? (
          <div className="flex flex-col gap-2">
            <Label>Lead</Label>
            <Select
              value={leadId}
              onValueChange={(v) => setLeadId(v ?? undefined)}
              items={Object.fromEntries((leads ?? []).map((l) => [l.id, l.fullName ?? l.phoneNumber]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {(leads ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id} label={l.fullName ?? l.phoneNumber}>
                    {l.fullName ?? l.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This will message all <strong>{leads?.length ?? 0}</strong> leads currently in the CRM.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="broadcast-body">Message</Label>
          <Textarea id="broadcast-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message..." />
        </div>

        <Button onClick={handleSend} disabled={!canSend || sendBroadcast.isPending}>
          {sendBroadcast.isPending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
          {sendBroadcast.isPending ? "Sending..." : `Send to ${recipientCount} ${recipientCount === 1 ? "lead" : "leads"}`}
        </Button>
      </div>

      {result && (
        <div className="flex max-w-2xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="success">{result.sent} sent</Badge>
            {result.failed > 0 && <Badge variant="destructive">{result.failed} failed</Badge>}
            <span className="text-sm text-muted-foreground">of {result.total} total</span>
          </div>
          {result.failed > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results
                    .filter((r) => r.status === "failed")
                    .map((r) => (
                      <TableRow key={r.leadId}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
