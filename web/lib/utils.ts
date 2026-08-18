import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared KES/currency formatter -- was duplicated inline across five pages. */
export function formatCurrency(amount: number | string | null | undefined, currency = "KES"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!value) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
