"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, TrendingUp, CalendarRange, Calculator, HandCoins, Trash2 } from "lucide-react";
import { usePayments, useBulkDeletePayments } from "@/lib/queries/payments";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { PaymentEditDialog } from "@/components/payments/payment-edit-dialog";
import { ReportDownloadMenu } from "@/components/report-download-menu";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulkDelete = useBulkDeletePayments();

  const allSelected = Boolean(payments?.length) && payments!.every((p) => selected.has(p.id));

  const toggleAll = () => {
    if (!payments) return;
    setSelected(allSelected ? new Set() : new Set(payments.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(`Delete ${count} payment${count === 1 ? "" : "s"}? This can't be undone.`)) return;
    try {
      const result = await bulkDelete.mutateAsync([...selected]);
      setSelected(new Set());
      if (result.failed.length === 0) {
        toast.success(`Deleted ${result.deleted.length} payment${result.deleted.length === 1 ? "" : "s"}`);
      } else {
        toast.error(
          `Deleted ${result.deleted.length}, couldn't delete ${result.failed.length}: ${result.failed
            .map((f) => f.error)
            .join(" ")}`,
        );
      }
    } catch {
      toast.error("Bulk delete failed");
    }
  };

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
        <div className="flex items-center gap-2">
          <ReportDownloadMenu resource="payments" />
          <PaymentDialog />
        </div>
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

      {canEdit && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {payments && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                )}
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
                    {canEdit && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(payment.id)}
                          onCheckedChange={() => toggleOne(payment.id)}
                          aria-label={`Select payment from ${new Date(payment.paymentDate).toLocaleDateString()}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={PAYMENT_PAYER_TYPE_COLOR[payment.payerType]}>{PAYER_TYPE_LABEL[payment.payerType]}</Badge>
                    </TableCell>
                    <TableCell>{property?.title ?? "—"}</TableCell>
                    <TableCell>{lead?.fullName ?? lead?.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatCurrency(payment.amount, payment.currency)}
                        {payment.isDeposit && <Badge variant="success">Deposit</Badge>}
                      </div>
                    </TableCell>
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
                  <TableCell colSpan={canEdit ? 9 : 7} className="text-center text-muted-foreground">
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
