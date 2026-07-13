// src/services/ghl-objects.service.ts
//
// Handles GHL Custom Object records (Property / Unit Type data) — separate
// from ghl.service.ts, which handles Contact upsert for qualified leads.
// Same GHL account, two different resource types, kept in separate files
// so a change to one doesn't risk breaking the other.

import axios, { AxiosError } from 'axios';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28'; // TODO: verify against current Objects API docs
                                        // (marketplace.gohighlevel.com/docs/ghl/objects/records)
                                        // before trusting long-term — GHL has changed this
                                        // string before between resource families.

// GHL's documented burst limit is 100 requests / 10s per app per location.
// This client retries once on 429 with the delay GHL suggests (falls back
// to a fixed 2s if no Retry-After header is present), rather than hammering
// straight through a rate-limit response.
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 2000;

export interface GhlCustomObjectRecord<T = Record<string, unknown>> {
  id: string;
  locationId: string;
  objectKey?: string;
  createdAt?: string;
  updatedAt?: string;
  properties: T;
}

interface SearchRecordsResponse {
  records: GhlCustomObjectRecord[];
  total: number;
}

function getCredentials(): { token: string; locationId: string } {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!token || !locationId) {
    throw new Error('Missing GHL credentials in environment (GHL_API_TOKEN / GHL_LOCATION_ID).');
  }

  return { token, locationId };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an axios call with one retry on 429 (rate limited) or 5xx (GHL-side
 * transient failure). Does NOT retry on 4xx client errors other than 429 —
 * a 404 or 401 retried blindly just wastes calls against your burst budget.
 */
async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;

    const isRetryable = status === 429 || (status && status >= 500);
    if (!isRetryable || attempt >= MAX_RETRIES) {
      throw err;
    }

    const retryAfterHeader = axiosErr.response?.headers?.['retry-after'];
    const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : DEFAULT_RETRY_DELAY_MS;

    console.warn(
      `[ghl-objects] Request failed with ${status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
    );
    await sleep(delayMs);
    return withRetry(fn, attempt + 1);
  }
}

/**
 * Search records on a custom object, with optional updatedAfter filtering.
 * Used by both the webhook handler (to hydrate a full record from a partial
 * webhook payload) and the polling job.
 *
 * NOTE on the filter shape: written from GHL's general filter convention
 * used elsewhere in the v2 API. Test this against a live sandbox record
 * before trusting it in production polling — if GHL rejects the filter
 * shape, it'll come back as a 400/422, not a silent wrong result, so it
 * should fail loudly rather than quietly.
 */
export async function searchObjectRecords(params: {
  objectKey: string;
  updatedAfter?: string; // ISO timestamp
  page?: number;
  pageLimit?: number;
}): Promise<SearchRecordsResponse> {
  const { objectKey, updatedAfter, page = 1, pageLimit = 100 } = params;
  const { token, locationId } = getCredentials();

  const body: Record<string, unknown> = { locationId, page, pageLimit };
  if (updatedAfter) {
    body.filters = [{ field: 'updatedAt', operator: 'greaterThanOrEqual', value: updatedAfter }];
  }

  return withRetry(async () => {
    const response = await axios.post<SearchRecordsResponse>(
      `${GHL_API_BASE}/objects/${objectKey}/records/search`,
      body,
      { headers: authHeaders(token), timeout: 15_000 },
    );
    return response.data;
  }).catch((error: AxiosError) => {
    console.error('[ghl-objects] searchObjectRecords failed:', error.response?.data || error.message);
    throw new Error(`Failed to search GHL object records for key "${objectKey}"`);
  });
}

export async function getObjectRecordById(objectKey: string, recordId: string): Promise<GhlCustomObjectRecord> {
  const { token } = getCredentials();

  return withRetry(async () => {
    const response = await axios.get<{ record: GhlCustomObjectRecord }>(
      `${GHL_API_BASE}/objects/${objectKey}/records/${recordId}`,
      { headers: authHeaders(token), timeout: 15_000 },
    );
    return response.data.record;
  }).catch((error: AxiosError) => {
    console.error('[ghl-objects] getObjectRecordById failed:', error.response?.data || error.message);
    throw new Error(`Failed to fetch GHL record ${recordId} on object "${objectKey}"`);
  });
}

export async function createObjectRecord(
  objectKey: string,
  properties: Record<string, unknown>,
): Promise<GhlCustomObjectRecord> {
  const { token, locationId } = getCredentials();

  return withRetry(async () => {
    const response = await axios.post<{ record: GhlCustomObjectRecord }>(
      `${GHL_API_BASE}/objects/${objectKey}/records`,
      { locationId, properties },
      { headers: authHeaders(token), timeout: 15_000 },
    );
    return response.data.record;
  }).catch((error: AxiosError) => {
    console.error('[ghl-objects] createObjectRecord failed:', error.response?.data || error.message);
    throw new Error(`Failed to create GHL record on object "${objectKey}"`);
  });
}

export async function updateObjectRecord(
  objectKey: string,
  recordId: string,
  properties: Record<string, unknown>,
): Promise<GhlCustomObjectRecord> {
  const { token } = getCredentials();

  return withRetry(async () => {
    const response = await axios.put<{ record: GhlCustomObjectRecord }>(
      `${GHL_API_BASE}/objects/${objectKey}/records/${recordId}`,
      { properties },
      { headers: authHeaders(token), timeout: 15_000 },
    );
    return response.data.record;
  }).catch((error: AxiosError) => {
    console.error('[ghl-objects] updateObjectRecord failed:', error.response?.data || error.message);
    throw new Error(`Failed to update GHL record ${recordId} on object "${objectKey}"`);
  });
}

/**
 * Fetch a Property record's associated Unit Type records via the
 * Associations API. GHL's Custom Object associations aren't embedded in the
 * record itself — they're a separate lookup.
 *
 * CONFIRM BEFORE RELYING ON THIS: the exact endpoint path is written from
 * GHL's documented "Get all relations by record Id" association endpoint,
 * but the precise URL structure wasn't fully visible in the docs pulled for
 * this build. Test against one real Chestone Property record before wiring
 * this into the render pipeline — if the path is wrong you'll get a clean
 * 404, not silently wrong data, so it's safe to test against production
 * credentials in a dry run.
 */
export async function getUnitTypesForProperty(
  propertyRecordId: string,
  unitTypeObjectKey: string,
): Promise<GhlCustomObjectRecord[]> {
  const { token, locationId } = getCredentials();

  return withRetry(async () => {
    const response = await axios.get<{ relations: Array<{ secondaryRecordId: string }> }>(
      `${GHL_API_BASE}/associations/relations/${propertyRecordId}`,
      { headers: authHeaders(token), params: { locationId }, timeout: 15_000 },
    );

    const relatedIds = response.data.relations.map((r) => r.secondaryRecordId);

    // Fetch each related unit type individually — GHL's relations endpoint
    // returns IDs, not full records. Sequential rather than Promise.all to
    // stay comfortably inside the burst limit when a property has many
    // unit types; switch to a small concurrency pool (e.g. 5 at a time) if
    // this becomes a bottleneck once real data volume is known.
    const unitTypes: GhlCustomObjectRecord[] = [];
    for (const id of relatedIds) {
      const record = await getObjectRecordById(unitTypeObjectKey, id);
      unitTypes.push(record);
    }
    return unitTypes;
  }).catch((error: AxiosError) => {
    console.error('[ghl-objects] getUnitTypesForProperty failed:', error.response?.data || error.message);
    throw new Error(`Failed to fetch associated unit types for property ${propertyRecordId}`);
  });
}