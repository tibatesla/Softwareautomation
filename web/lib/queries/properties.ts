import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, deletePropertyMedia, uploadPropertyMedia } from "@/lib/api";
import type { Property } from "@/lib/types";

export type CreatePropertyPayload = Partial<
  Omit<
    Property,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "price" | "priceMin" | "priceMax" | "houseSizeSqft" | "amenities"
  >
> & {
  title: string;
  price?: number;
  priceMin?: number;
  priceMax?: number;
  houseSizeSqft?: number;
  amenities?: string[];
};

const propertiesKey = ["properties"] as const;
const propertyKey = (id: string) => ["properties", id] as const;

export function useProperties() {
  return useQuery({
    queryKey: propertiesKey,
    queryFn: () => apiFetch<Property[]>("/properties"),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: propertyKey(id),
    queryFn: () => apiFetch<Property>(`/properties/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePropertyPayload) =>
      apiFetch<Property>("/properties", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesKey });
    },
  });
}

export function useUpdateProperty(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePropertyPayload) =>
      apiFetch<Property>(`/properties/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesKey });
      queryClient.invalidateQueries({ queryKey: propertyKey(id) });
    },
  });
}

export function useUploadPropertyMedia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPropertyMedia(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKey(id) });
      queryClient.invalidateQueries({ queryKey: propertiesKey });
    },
  });
}

export function useDeletePropertyMedia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => deletePropertyMedia(id, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKey(id) });
      queryClient.invalidateQueries({ queryKey: propertiesKey });
    },
  });
}
