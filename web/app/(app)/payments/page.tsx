"use client";

import { Wallet, TrendingUp, CalendarRange, Calculator } from "lucide-react";
import { usePayments } from "@/lib/queries/payments";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { PaymentEditDialog } from "@/components/payments/payment-edit-dialog";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";

function formatAmount(amount: string | number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );
}

export default function PaymentsPage() {
  const user = useAuthUser();
  const canEdit = hasRole(user, ["owner"]);
  const { data: payments, isLoading, error } = usePayments();
  const { data: properties } = useProperties();
  const { data: leads } = useLeads();

  const totalAmount = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const now = new Date();
  const monthlyAmount =
    payments
      ?.filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const averageAmount = payments && payments.length > 0 ? totalAmount / payments.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <PaymentDialog />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading payments...</p>}
      {error && <p className="text-destructive">Failed to load payments.</p>}

      {payments && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total recorded" value={payments.length} icon={Wallet} color="primary" />
          <StatCard label="Total amount" value={formatAmount(totalAmount)} icon={TrendingUp} color="success" />
          <StatCard label="This month" value={formatAmount(monthlyAmount)} icon={CalendarRange} color="info" />
          <StatCard label="Average payment" value={formatAmount(averageAmount)} icon={Calculator} color="warning" />
        </div>
      )}

      {payments && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Notes</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const property = properties?.find((p) => p.id === payment.propertyId);
                const lead = leads?.find((l) => l.id === payment.leadId);
                return (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>{property?.title ?? "—"}</TableCell>
                    <TableCell>{lead?.fullName ?? lead?.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatAmount(payment.amount, payment.currency)}</TableCell>
                    <TableCell>{payment.paymentMethod ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{payment.notes ?? "—"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <PaymentEditDialog payment={payment} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
