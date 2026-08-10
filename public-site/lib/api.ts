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
  sort?: string;
}

export async function getProperties(filters: PropertyFilters = {}): Promise<PublicProperty[]> {
  const url = new URL(`${API_BASE_URL}/properties`);
  if (filters.area) url.searchParams.set("area", filters.area);
  if (filters.type) url.searchParams.set("type", filters.type);
  if (filters.price) url.searchParams.set("price", filters.price);
  if (filters.sort) url.searchParams.set("sort", filters.sort);

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
