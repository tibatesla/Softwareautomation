"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useUpdatePayment } from "@/lib/queries/payments";
import { ApiError } from "@/lib/api";
import type { Payment } from "@/lib/types";
import { PAYMENT_PAYER_TYPE_VALUES } from "@/lib/payment-constants";

const PAYER_TYPE_LABEL: Record<(typeof PAYMENT_PAYER_TYPE_VALUES)[number], string> = {
  lead: "Lead payment (deposit/installment)",
  developer: "Developer commission",
};

const todayDateString = () => new Date().toISOString().slice(0, 10);

const editFormSchema = z.object({
  payerType: z.enum(PAYMENT_PAYER_TYPE_VALUES),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().length(3),
  paymentMethod: z.string().optional(),
  paymentDate: z
    .string()
    .optional()
    .refine((v) => !v || v <= todayDateString(), "Payment date cannot be in the future"),
  notes: z.string().optional(),
  isDeposit: z.boolean().optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

export function PaymentEditDialog({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const updatePayment = useUpdatePayment(payment.id);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      payerType: payment.payerType,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod ?? "",
      paymentDate: payment.paymentDate.slice(0, 10),
      notes: payment.notes ?? "",
      isDeposit: payment.isDeposit,
    },
  });

  const onSubmit = async (values: EditFormValues) => {
    try {
      await updatePayment.mutateAsync({
        payerType: values.payerType,
        amount: Number(values.amount),
        currency: values.currency,
        paymentMethod: values.paymentMethod || undefined,
        paymentDate: values.paymentDate ? new Date(values.paymentDate).toISOString() : undefined,
        notes: values.notes || undefined,
        isDeposit: values.isDeposit,
      });
      toast.success("Payment updated");
      setOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update payment";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="icon-sm" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Who paid?</Label>
            <Controller
              control={control}
              name="payerType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(PAYMENT_PAYER_TYPE_VALUES.map((type) => [type, PAYER_TYPE_LABEL[type]]))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_PAYER_TYPE_VALUES.map((type) => (
                      <SelectItem key={type} value={type} label={PAYER_TYPE_LABEL[type]}>
                        {PAYER_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="isDeposit"
              render={({ field }) => <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
            <Label>This is the deposit payment</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input id="edit-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Input id="edit-currency" maxLength={3} {...register("currency")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-paymentMethod">Method</Label>
              <Input id="edit-paymentMethod" {...register("paymentMethod")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-paymentDate">Date</Label>
              <Input id="edit-paymentDate" type="date" max={todayDateString()} {...register("paymentDate")} />
              {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updatePayment.isPending}>
              {updatePayment.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
