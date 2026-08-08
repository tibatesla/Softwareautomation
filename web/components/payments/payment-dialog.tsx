"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { useCreatePayment } from "@/lib/queries/payments";
import { ApiError } from "@/lib/api";

const todayDateString = () => new Date().toISOString().slice(0, 10);

const paymentFormSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  leadId: z.string().optional(),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().length(3).optional(),
  paymentMethod: z.string().optional(),
  paymentDate: z
    .string()
    .optional()
    .refine((v) => !v || v <= todayDateString(), "Payment date cannot be in the future"),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function PaymentDialog() {
  const [open, setOpen] = useState(false);
  const { data: properties } = useProperties();
  const { data: leads } = useLeads();
  const createPayment = useCreatePayment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { currency: "KES" },
  });

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      await createPayment.mutateAsync({
        propertyId: values.propertyId,
        leadId: values.leadId || undefined,
        amount: Number(values.amount),
        currency: values.currency,
        paymentMethod: values.paymentMethod || undefined,
        paymentDate: values.paymentDate ? new Date(values.paymentDate).toISOString() : undefined,
        notes: values.notes || undefined,
      });
      toast.success("Payment recorded");
      reset({ currency: "KES" });
      setOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to record payment";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Record Payment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Property</Label>
            <Controller
              control={control}
              name="propertyId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.propertyId && <p className="text-sm text-destructive">{errors.propertyId.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Lead</Label>
            <Controller
              control={control}
              name="leadId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads?.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.fullName ?? lead.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentMethod">Method</Label>
              <Input id="paymentMethod" {...register("paymentMethod")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentDate">Date</Label>
              <Input id="paymentDate" type="date" max={todayDateString()} {...register("paymentDate")} />
              {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? "Saving..." : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
