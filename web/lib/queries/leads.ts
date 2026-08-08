import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Lead, LeadMessage } from "@/lib/types";

export type LeadPayload = Partial<Omit<Lead, "id" | "createdAt" | "updatedAt" | "claimedAt" | "claimedByAgentId" | "lastCapiFiredAt" | "ctwaClid">> & {
  phoneNumber?: string;
};

const leadsKey = ["leads"] as const;
const leadKey = (id: string) => ["leads", id] as const;

export function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: () => apiFetch<Lead[]>("/leads"),
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
