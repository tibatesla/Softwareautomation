import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AgentPerformance } from "@/lib/types";

export function useAgentPerformance() {
  return useQuery({
    queryKey: ["agent-performance"] as const,
    queryFn: () => apiFetch<AgentPerformance[]>("/agent-performance"),
  });
}
