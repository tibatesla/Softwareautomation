import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AdPerformanceLog, AdRuleExecution, AdPlatform } from "@/lib/types";

export function useAdPerformance(platform?: AdPlatform) {
  return useQuery({
    queryKey: ["ad-performance", platform] as const,
    queryFn: () => apiFetch<AdPerformanceLog[]>(`/ad-performance${platform ? `?platform=${platform}` : ""}`),
  });
}

export function useAdRuleExecutions(platform?: AdPlatform) {
  return useQuery({
    queryKey: ["ad-rule-executions", platform] as const,
    queryFn: () =>
      apiFetch<AdRuleExecution[]>(`/ad-performance/rule-executions${platform ? `?platform=${platform}` : ""}`),
  });
}
