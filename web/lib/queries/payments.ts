import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Payment } from "@/lib/types";

export interface CreatePaymentPayload {
  propertyId: string;
  leadId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
}

export interface UpdatePaymentPayload {
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
}

const paymentsKey = ["payments"] as const;

export function usePayments() {
  return useQuery({
    queryKey: paymentsKey,
    queryFn: () => apiFetch<Payment[]>("/payments"),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) =>
      apiFetch<Payment>("/payments", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentsKey }),
  });
}

// Owner-only -- the backend 403s this for admin/agent (see
// payments_owner_update RLS policy + payment.routes.ts).
export function useUpdatePayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePaymentPayload) =>
      apiFetch<Payment>(`/payments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentsKey }),
  });
}
