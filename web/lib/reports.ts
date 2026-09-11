import { ApiError } from "@/lib/api";

export type ReportResource = "properties" | "leads" | "payments" | "ad-performance" | "agent-performance";
export type ReportFormat = "csv" | "xlsx" | "pdf";

const FILENAME_FALLBACK: Record<ReportResource, string> = {
  properties: "properties-report",
  leads: "leads-report",
  payments: "payments-report",
  "ad-performance": "ad-performance-report",
  "agent-performance": "agent-performance-report",
};

/**
 * Fetches a report file from the backend and saves it via the browser --
 * a plain <a href> can't be used here since the request needs the session
 * cookie/auth forwarded through /api/backend first (see that proxy route),
 * so the file has to be fetched as a blob and handed to the browser
 * manually through a throwaway object URL.
 */
export async function downloadReport(resource: ReportResource, format: ReportFormat, query?: Record<string, string>): Promise<void> {
  const params = new URLSearchParams({ format, ...query });
  const response = await fetch(`/api/backend/reports/${resource}?${params.toString()}`);

  if (!response.ok) {
    let message = "Failed to generate report";
    try {
      const data = await response.json();
      message = data?.error ?? message;
    } catch {
      // Non-JSON error body (unlikely) -- fall back to the generic message.
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${FILENAME_FALLBACK[resource]}.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
