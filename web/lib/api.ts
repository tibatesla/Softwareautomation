export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    throw new ApiError(data?.error ?? "Request failed", response.status, data?.details);
  }

  return data as T;
}

export async function uploadPropertyMedia(propertyId: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`/api/backend/properties/${propertyId}/media`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data?.error ?? "Upload failed", response.status, data?.details);
  }

  return data;
}

export async function deletePropertyMedia(propertyId: string, url: string) {
  return apiFetch(`/properties/${propertyId}/media?url=${encodeURIComponent(url)}`, {
    method: "DELETE",
  });
}
