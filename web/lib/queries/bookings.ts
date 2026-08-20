import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Booking, BookingStatus } from "@/lib/types";

export interface CreateBookingPayload {
  propertyId: string;
  leadId?: string;
  agentId?: string;
  scheduledAt: string;
  isVirtual?: boolean;
  notes?: string;
}

export interface UpdateBookingPayload {
  scheduledAt?: string;
  status?: BookingStatus;
  isVirtual?: boolean;
  notes?: string;
}

const bookingsKey = ["bookings"] as const;

export function useBookings() {
  return useQuery({
    queryKey: bookingsKey,
    queryFn: () => apiFetch<Booking[]>("/bookings"),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) =>
      apiFetch<Booking>("/bookings", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingsKey }),
  });
}

export function useUpdateBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBookingPayload) =>
      apiFetch<Booking>(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingsKey }),
  });
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: { id: string; error: string }[];
}

// Owner/admin can delete any booking; an agent can only delete their own --
// enforced by RLS (see bookings_owner_admin_all / bookings_agent_own).
export function useBulkDeleteBookings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<BulkDeleteResult>("/bookings/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingsKey }),
  });
}
