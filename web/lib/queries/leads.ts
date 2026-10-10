import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Lead, LeadMessage } from "@/lib/types";

export type LeadPayload = Partial<Omit<Lead, "id" | "createdAt" | "updatedAt" | "claimedAt" | "claimedByAgentId" | "lastCapiFiredAt" | "ctwaClid">> & {
  phoneNumber?: string;
};

const leadsKey = ["leads"] as const;
const leadKey = (id: string) => ["leads", id] as const;

// Polled (not fetch-once) so new inbound WhatsApp messages -- and the
// unread counts/notifications derived from them -- show up without a
// manual refresh. Keeps polling in background tabs too, since the whole
// point of a "new message" notification is surfacing it even when the
// CRM tab isn't focused.
const LEADS_POLL_INTERVAL_MS = 20_000;

export function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: () => apiFetch<Lead[]>("/leads"),
    refetchInterval: LEADS_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKey(id),
    queryFn: () => apiFetch<Lead>(`/leads/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeadPayload) => apiFetch<Lead>("/leads", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leadsKey }),
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeadPayload) =>
      apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(id) });
    },
  });
}

export function useLeadMessages(id: string) {
  return useQuery({
    queryKey: ["leads", id, "messages"] as const,
    queryFn: () => apiFetch<LeadMessage[]>(`/leads/${id}/messages`),
    enabled: Boolean(id),
  });
}

export function useSendLeadMessage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<LeadMessage>(`/leads/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads", id, "messages"] }),
  });
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: { id: string; error: string }[];
}

export function useBulkDeleteLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<BulkDeleteResult>("/leads/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leadsKey }),
  });
}

// Marks the lead's conversation as read by the caller -- called when a
// human actually opens the message thread, never automatically by
// anything the bot does (see markLeadRead in lead.controller.ts).
export function useMarkLeadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/leads/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leadsKey }),
  });
}

export function useClaimLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Lead>(`/leads/${id}/claim`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(id) });
    },
  });
}

// Owner/Admin manual (re)assignment to a specific agent -- distinct from
// claim, which is an agent taking an unclaimed lead for themselves.
export function useAssignLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string }) =>
      apiFetch<Lead>(`/leads/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId }) }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: leadsKey });
      queryClient.invalidateQueries({ queryKey: leadKey(id) });
    },
  });
}
