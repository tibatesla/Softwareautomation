"use client";

import { Wallet, TrendingUp, CalendarRange, Calculator, HandCoins } from "lucide-react";
import { usePayments } from "@/lib/queries/payments";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { PaymentEditDialog } from "@/components/payments/payment-edit-dialog";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_PAYER_TYPE_COLOR } from "@/lib/status-colors";

const PAYER_TYPE_LABEL: Record<string, string> = { lead: "Lead", developer: "Developer" };

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
  const commissionsAmount = payments?.filter((p) => p.payerType === "developer").reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <PaymentDialog />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading payments...</p>}
      {error && <p className="text-destructive">Failed to load payments.</p>}

      {payments && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total recorded" value={payments.length} icon={Wallet} color="primary" />
          <StatCard label="Total amount" value={formatCurrency(totalAmount)} icon={TrendingUp} color="success" />
          <StatCard label="This month" value={formatCurrency(monthlyAmount)} icon={CalendarRange} color="info" />
          <StatCard label="Average payment" value={formatCurrency(averageAmount)} icon={Calculator} color="warning" />
          <StatCard label="Developer commissions" value={formatCurrency(commissionsAmount)} icon={HandCoins} color="danger" />
        </div>
      )}

      {payments && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payer</TableHead>
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
                    <TableCell>
                      <Badge variant={PAYMENT_PAYER_TYPE_COLOR[payment.payerType]}>{PAYER_TYPE_LABEL[payment.payerType]}</Badge>
                    </TableCell>
                    <TableCell>{property?.title ?? "—"}</TableCell>
                    <TableCell>{lead?.fullName ?? lead?.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(payment.amount, payment.currency)}</TableCell>
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
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground">
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
