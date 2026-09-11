"use client";

import { useState } from "react";
import { useAdPerformance, useAdRuleExecutions } from "@/lib/queries/ad-performance";
import type { AdPlatform } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AD_PLATFORM_COLOR } from "@/lib/status-colors";
import { formatCurrency } from "@/lib/utils";
import { ReportDownloadMenu } from "@/components/report-download-menu";

const PLATFORMS: AdPlatform[] = ["meta", "google", "tiktok"];

function PerformanceTable({ platform }: { platform?: AdPlatform }) {
  const { data: logs, isLoading, error } = useAdPerformance(platform);

  if (isLoading) return <p className="text-muted-foreground">Loading performance data...</p>;
  if (error) return <p className="text-destructive">Failed to load ad performance.</p>;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Window</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Ad</TableHead>
            <TableHead>Spend</TableHead>
            <TableHead>Impressions</TableHead>
            <TableHead>Clicks</TableHead>
            <TableHead>CTR</TableHead>
            <TableHead>Qualified leads</TableHead>
            <TableHead>CPQL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.windowStart).toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant={AD_PLATFORM_COLOR[log.platform]}>{log.platform}</Badge>
              </TableCell>
              <TableCell className="max-w-40 truncate">{log.campaignId}</TableCell>
              <TableCell className="max-w-40 truncate">{log.adId}</TableCell>
              <TableCell>{formatCurrency(log.spend, log.currency)}</TableCell>
              <TableCell>{log.impressions}</TableCell>
              <TableCell>{log.clicks}</TableCell>
              <TableCell>{log.ctr ? `${log.ctr}%` : "—"}</TableCell>
              <TableCell>{log.qualifiedLeads}</TableCell>
              <TableCell>{log.cpql ?? "—"}</TableCell>
            </TableRow>
          ))}
          {logs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No performance data ingested yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RuleExecutionsTable({ platform }: { platform?: AdPlatform }) {
  const { data: executions, isLoading, error } = useAdRuleExecutions(platform);

  if (isLoading) return <p className="text-muted-foreground">Loading rule executions...</p>;
  if (error) return <p className="text-destructive">Failed to load rule executions.</p>;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Executed</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Ad</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions?.map((execution) => (
            <TableRow key={execution.id}>
              <TableCell>{new Date(execution.executedAt).toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant={execution.ruleName === "AI_ADVISORY" ? "purple" : "secondary"}>
                  {execution.ruleName}
                </Badge>
              </TableCell>
              <TableCell>
                {execution.platform && <Badge variant={AD_PLATFORM_COLOR[execution.platform]}>{execution.platform}</Badge>}
              </TableCell>
              <TableCell className="max-w-40 truncate">{execution.adId ?? "—"}</TableCell>
              <TableCell>{execution.actionTaken}</TableCell>
              <TableCell className="max-w-xs truncate">{execution.reason ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={execution.success ? "success" : "rose"}>
                  {execution.success ? "OK" : "Failed"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {executions?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No rule executions logged yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdPerformancePage() {
  const [platform, setPlatform] = useState<AdPlatform | undefined>(undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ad Performance</h1>
        <div className="flex items-center gap-2">
          <ReportDownloadMenu resource="ad-performance" query={platform ? { platform } : undefined} />
          <Select
            value={platform ?? "all"}
            onValueChange={(v) => setPlatform(v === "all" ? undefined : (v as AdPlatform))}
            items={{ all: "All platforms", ...Object.fromEntries(PLATFORMS.map((p) => [p, p])) }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All platforms">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} label={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="rules">Rule Executions</TabsTrigger>
        </TabsList>
        <TabsContent value="performance">
          <PerformanceTable platform={platform} />
        </TabsContent>
        <TabsContent value="rules">
          <RuleExecutionsTable platform={platform} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
