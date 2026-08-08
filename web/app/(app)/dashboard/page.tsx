"use client";

import { isToday, subMonths, format } from "date-fns";
import { Building2, Contact, CalendarClock, Wallet, Megaphone, ListChecks } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { useBookings } from "@/lib/queries/bookings";
import { usePayments } from "@/lib/queries/payments";
import { useAdPerformance } from "@/lib/queries/ad-performance";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LEAD_QUALIFICATION_STATUS_VALUES } from "@/lib/lead-constants";

function AgentDashboard({ userId }: { userId: string }) {
  const { data: leads } = useLeads();
  const { data: bookings } = useBookings();

  const claimableLeads = leads?.filter((l) => !l.claimedByAgentId).length ?? 0;
  const myLeads = leads?.filter((l) => l.claimedByAgentId === userId) ?? [];
  const todaysBookings = bookings?.filter((b) => isToday(new Date(b.scheduledAt))).length ?? 0;

  const leadStatusData = LEAD_QUALIFICATION_STATUS_VALUES.map((status) => ({
    status,
    count: myLeads.filter((l) => l.qualificationStatus === status).length,
  })).filter((d) => d.count > 0);

  const chartConfig: ChartConfig = { count: { label: "Leads", color: "var(--chart-1)" } };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's site visits" value={todaysBookings} icon={CalendarClock} color="info" />
        <StatCard
          label="Claimable leads"
          value={claimableLeads}
          description="Unclaimed, qualified"
          icon={ListChecks}
          color="warning"
        />
        <StatCard label="My active leads" value={myLeads.length} icon={Contact} color="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My leads by status</CardTitle>
          <CardDescription>Breakdown of leads currently assigned to you</CardDescription>
        </CardHeader>
        <CardContent>
          {leadStatusData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No claimed leads yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={leadStatusData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerAdminDashboard() {
  const { data: properties } = useProperties();
  const { data: leads } = useLeads();
  const { data: payments } = usePayments();
  const { data: adLogs } = useAdPerformance();

  const availableProperties = properties?.filter((p) => p.status === "available").length ?? 0;
  const qualifiedLeads = leads?.filter((l) => l.qualificationStatus === "qualified").length ?? 0;
  const unclaimedLeads = leads?.filter((l) => !l.claimedByAgentId).length ?? 0;

  const monthlyPayments =
    payments?.reduce((sum, p) => {
      const date = new Date(p.paymentDate);
      const now = new Date();
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        return sum + Number(p.amount);
      }
      return sum;
    }, 0) ?? 0;

  const totalSpend = adLogs?.reduce((sum, log) => sum + Number(log.spend), 0) ?? 0;

  const leadStatusData = LEAD_QUALIFICATION_STATUS_VALUES.map((status) => ({
    status,
    count: leads?.filter((l) => l.qualificationStatus === status).length ?? 0,
  }));

  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
  const paymentsTrend = months.map((month) => {
    const total =
      payments
        ?.filter((p) => {
          const d = new Date(p.paymentDate);
          return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
        })
        .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
    return { month: format(month, "MMM"), total };
  });

  const leadChartConfig: ChartConfig = { count: { label: "Leads", color: "var(--chart-1)" } };
  const paymentsChartConfig: ChartConfig = { total: { label: "Payments (KES)", color: "var(--chart-3)" } };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Properties"
          value={properties?.length ?? 0}
          description={`${availableProperties} available`}
          icon={Building2}
          color="primary"
        />
        <StatCard
          label="Qualified leads"
          value={qualifiedLeads}
          description={`${unclaimedLeads} unclaimed`}
          icon={Contact}
          color="info"
        />
        <StatCard
          label="Payments this month"
          value={new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(monthlyPayments)}
          icon={Wallet}
          color="success"
        />
        <StatCard
          label="Ad spend (recent logs)"
          value={new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(totalSpend)}
          icon={Megaphone}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by qualification status</CardTitle>
            <CardDescription>Across the full pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leadChartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={leadStatusData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={paymentsChartConfig} className="aspect-auto h-64 w-full">
              <LineChart data={paymentsTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthUser();
  const canManage = hasRole(user, ["owner", "admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.fullName} ({user.role}).
        </p>
      </div>

      {canManage ? <OwnerAdminDashboard /> : <AgentDashboard userId={user.id} />}
    </div>
  );
}
