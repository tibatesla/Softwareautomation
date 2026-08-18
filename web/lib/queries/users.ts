import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

const usersKey = ["users"] as const;

// Only ever meaningful for owner/admin sessions -- the backend 403s this for
// agents. Pass enabled: hasRole(user, ['owner', 'admin']) so agent sessions
// don't fire a request that's guaranteed to fail.
export function useUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: usersKey,
    queryFn: () => apiFetch<User[]>("/users"),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      apiFetch<User>("/users", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) =>
      apiFetch<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

// Fails with a specific 409 message (via ApiError) if the account has any
// linked leads/properties/payments/bookings/penalties -- those are all
// NoAction foreign keys, so the backend checks first rather than letting a
// raw constraint violation surface. Deactivation (useUpdateUser with
// isActive: false) is the fallback for any account with real history.
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

// Self-service (agent SLA on-duty toggle) -- unlike useUsers, works for
// every role since it only ever reads/writes the caller's own row.
const ownProfileKey = ["users", "me"] as const;

export function useOwnProfile() {
  return useQuery({
    queryKey: ownProfileKey,
    queryFn: () => apiFetch<User>("/users/me"),
  });
}

export function useUpdateOwnDuty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isOnDuty: boolean) =>
      apiFetch<User>("/users/me/duty", { method: "PATCH", body: JSON.stringify({ isOnDuty }) }),
    onSuccess: (updated) => queryClient.setQueryData(ownProfileKey, updated),
  });
}
