"use client";

import { Contact, CalendarCheck, ShieldAlert, Wallet, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useAgentPerformance } from "@/lib/queries/agent-performance";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

const leadsChartConfig: ChartConfig = { leadsClaimed: { label: "Leads claimed", color: "var(--chart-1)" } };
const bookingsChartConfig: ChartConfig = { bookingsCompleted: { label: "Bookings completed", color: "var(--chart-2)" } };
const slaChartConfig: ChartConfig = { slaViolations: { label: "SLA violations", color: "var(--chart-4)" } };
const revenueChartConfig: ChartConfig = { revenueClosed: { label: "Revenue closed", color: "var(--chart-3)" } };

/** First name only -- keeps chart x-axis labels from overlapping with 5+ agents. */
function shortName(fullName: string): string {
  return fullName.split(" ")[0];
}

export default function AgentPerformancePage() {
  const { data: agents, isLoading, error } = useAgentPerformance();

  const totals = (agents ?? []).reduce(
    (acc, a) => ({
      leadsClaimed: acc.leadsClaimed + a.leadsClaimed,
      bookingsCompleted: acc.bookingsCompleted + a.bookingsCompleted,
      slaViolations: acc.slaViolations + a.slaViolations,
      revenueClosed: acc.revenueClosed + a.revenueClosed,
    }),
    { leadsClaimed: 0, bookingsCompleted: 0, slaViolations: 0, revenueClosed: 0 },
  );

  const chartData = (agents ?? []).map((a) => ({
    name: shortName(a.fullName),
    leadsClaimed: a.leadsClaimed,
    bookingsCompleted: a.bookingsCompleted,
    slaViolations: a.slaViolations,
    revenueClosed: a.revenueClosed,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent Performance</h1>
        <p className="text-muted-foreground">Leads, bookings, SLA record, and revenue closed per agent.</p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading agent performance...</p>}
      {error && <p className="text-destructive">Failed to load agent performance.</p>}

      {agents && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Agents" value={agents.length} icon={Users} color="primary" />
            <StatCard label="Leads claimed" value={totals.leadsClaimed} icon={Contact} color="info" />
            <StatCard label="Bookings completed" value={totals.bookingsCompleted} icon={CalendarCheck} color="success" />
            <StatCard label="SLA violations" value={totals.slaViolations} icon={ShieldAlert} color="warning" />
            <StatCard label="Revenue closed" value={formatCurrency(totals.revenueClosed)} icon={Wallet} color="success" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leads claimed per agent</CardTitle>
                <CardDescription>Currently claimed, across all qualification stages</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={leadsChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="leadsClaimed" fill="var(--color-leadsClaimed)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bookings completed per agent</CardTitle>
                <CardDescription>Site visits actually carried out</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={bookingsChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="bookingsCompleted" fill="var(--color-bookingsCompleted)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SLA violations per agent</CardTitle>
                <CardDescription>Late or missed responses recorded against each agent</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={slaChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="slaViolations" fill="var(--color-slaViolations)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue closed per agent</CardTitle>
                <CardDescription>Payments tied to each agent&apos;s currently claimed leads</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={revenueChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenueClosed" fill="var(--color-revenueClosed)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads claimed</TableHead>
                  <TableHead>Qualified</TableHead>
                  <TableHead>Converted</TableHead>
                  <TableHead>Bookings scheduled</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Missed / cancelled</TableHead>
                  <TableHead>SLA violations</TableHead>
                  <TableHead>Revenue closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No agents yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.fullName}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={a.isActive ? "success" : "rose"}>{a.isActive ? "Active" : "Inactive"}</Badge>
                          {a.isActive && <Badge variant={a.isOnDuty ? "info" : "outline"}>{a.isOnDuty ? "On duty" : "Off duty"}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{a.leadsClaimed}</TableCell>
                      <TableCell>{a.leadsQualified}</TableCell>
                      <TableCell>{a.leadsConverted}</TableCell>
                      <TableCell>{a.bookingsScheduled}</TableCell>
                      <TableCell>{a.bookingsCompleted}</TableCell>
                      <TableCell>{a.bookingsMissed}</TableCell>
                      <TableCell>{a.slaViolations}</TableCell>
                      <TableCell>{formatCurrency(a.revenueClosed)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
