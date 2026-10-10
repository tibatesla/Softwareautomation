import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type BroadcastChannel = "whatsapp" | "sms" | "email";
export type BroadcastTarget = "single" | "all";

export interface BroadcastPayload {
  channel: BroadcastChannel;
  target: BroadcastTarget;
  leadId?: string;
  body: string;
}

export interface BroadcastResultRow {
  leadId: string;
  name: string;
  status: "sent" | "failed";
  reason?: string;
}

export interface BroadcastResponse {
  total: number;
  sent: number;
  failed: number;
  results: BroadcastResultRow[];
}

export function useSendBroadcast() {
  return useMutation({
    mutationFn: (payload: BroadcastPayload) =>
      apiFetch<BroadcastResponse>("/communications/broadcast", { method: "POST", body: JSON.stringify(payload) }),
  });
}
