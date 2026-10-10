import { PublicProperty } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("Missing critical NEXT_PUBLIC_API_BASE_URL environment configuration.");
}

// Revalidate every 60s (ISR) -- fresh enough that a newly-listed property
// shows up quickly, cached enough that this stays fast and doesn't hammer
// the CRM's backend on every visitor.
const REVALIDATE_SECONDS = 60;

export interface PropertyFilters {
  area?: string;
  type?: string;
  price?: string;
  size?: string;
  sort?: string;
  q?: string;
  maxPrice?: string;
}

export async function getProperties(filters: PropertyFilters = {}): Promise<PublicProperty[]> {
  const url = new URL(`${API_BASE_URL}/properties`);
  if (filters.area) url.searchParams.set("area", filters.area);
  if (filters.type) url.searchParams.set("type", filters.type);
  if (filters.price) url.searchParams.set("price", filters.price);
  if (filters.size) url.searchParams.set("size", filters.size);
  if (filters.sort) url.searchParams.set("sort", filters.sort);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.maxPrice) url.searchParams.set("maxPrice", filters.maxPrice);

  const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) {
    throw new Error(`Failed to load properties (${response.status})`);
  }
  return response.json();
}

export async function getProperty(id: string): Promise<PublicProperty | null> {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load property (${response.status})`);
  }
  return response.json();
}

export interface BookingSlot {
  id: string;
  label: string;
}

export interface BookingOptions {
  currentName: string | null;
  propertyTitle: string | null;
  agentName: string | null;
  isVirtual: boolean;
  slots: BookingSlot[];
}

// Never cached -- a booking link is single-use and time-sensitive (its
// slots reflect the agent's calendar at this exact moment), unlike a
// property listing which is fine to serve slightly stale for a minute.
export async function getBookingOptions(token: string): Promise<BookingOptions | null> {
  const response = await fetch(`${API_BASE_URL}/bookings/${token}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load booking options (${response.status})`);
  }
  return response.json();
}

export async function confirmBooking(token: string, slotId: string, fullName: string): Promise<{ whenLabel: string }> {
  const response = await fetch(`${API_BASE_URL}/bookings/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, fullName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to confirm booking (${response.status})`);
  }
  return data;
}
