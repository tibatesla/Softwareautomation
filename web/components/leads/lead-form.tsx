"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEAL_STAGE_VALUES, LEAD_QUALIFICATION_STATUS_VALUES, LEAD_SEGMENT_VALUES } from "@/lib/lead-constants";
import type { Lead } from "@/lib/types";
import { useProperties } from "@/lib/queries/properties";
import { useCreateLead, useUpdateLead, type LeadPayload } from "@/lib/queries/leads";
import { ApiError } from "@/lib/api";

const leadFormSchema = z.object({
  fullName: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  source: z.string().optional(),
  propertyId: z.string().optional(),
  qualificationStatus: z.enum(LEAD_QUALIFICATION_STATUS_VALUES).optional(),
  budgetRange: z.string().optional(),
  preferredUnit: z.string().optional(),
  purchaseTimeline: z.string().optional(),
  targetSegment: z.enum(LEAD_SEGMENT_VALUES).optional(),
  countryCode: z.string().optional(),
  requiresProxyVisit: z.boolean().optional(),
  proxyPhoneNumber: z.string().optional(),
  isOvernightDiaspora: z.boolean().optional(),
  tags: z.string().optional(),
  investmentType: z.string().optional(),
  transactionType: z.string().optional(),
  dealStage: z.enum(DEAL_STAGE_VALUES).optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

function toDefaultValues(lead?: Lead): Partial<LeadFormValues> {
  if (!lead) return {};

  return {
    fullName: lead.fullName ?? "",
    phoneNumber: lead.phoneNumber,
    email: lead.email ?? "",
    source: lead.source ?? "",
    propertyId: lead.propertyId ?? "",
    qualificationStatus: lead.qualificationStatus,
    budgetRange: lead.budgetRange ?? "",
    preferredUnit: lead.preferredUnit ?? "",
    purchaseTimeline: lead.purchaseTimeline ?? "",
    targetSegment: lead.targetSegment ?? undefined,
    countryCode: lead.countryCode ?? "",
    requiresProxyVisit: lead.requiresProxyVisit ?? undefined,
    proxyPhoneNumber: lead.proxyPhoneNumber ?? "",
    isOvernightDiaspora: lead.isOvernightDiaspora,
    tags: lead.tags.join(", "),
    investmentType: lead.investmentType ?? "",
    transactionType: lead.transactionType ?? "",
    dealStage: lead.dealStage,
  };
}

export function LeadForm({ lead }: { lead?: Lead }) {
  const router = useRouter();
  const { data: properties } = useProperties();

  const createLead = useCreateLead();
  const updateLead = useUpdateLead(lead?.id ?? "");
  const mutation = lead ? updateLead : createLead;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: toDefaultValues(lead),
  });

  const onSubmit = async (values: LeadFormValues) => {
    const payload: LeadPayload = {
      ...values,
      email: values.email || undefined,
      propertyId: values.propertyId || undefined,
      tags: values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined,
    };

    try {
      const saved = await mutation.mutateAsync(payload);
      toast.success(lead ? "Lead updated" : "Lead created");
      router.push(`/leads/${saved.id}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" {...register("fullName")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phoneNumber">Phone number</Label>
          <Input id="phoneNumber" {...register("phoneNumber")} />
          {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">Source</Label>
          <Input id="source" {...register("source")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Property of interest</Label>
          <Controller
            control={control}
            name="propertyId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries((properties ?? []).map((property) => [property.id, property.title]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((property) => (
                    <SelectItem key={property.id} value={property.id} label={property.title}>
                      {property.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Qualification status</Label>
          <Controller
            control={control}
            name="qualificationStatus"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(LEAD_QUALIFICATION_STATUS_VALUES.map((status) => [status, status]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_QUALIFICATION_STATUS_VALUES.map((status) => (
                    <SelectItem key={status} value={status} label={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Deal stage</Label>
          <Controller
            control={control}
            name="dealStage"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(DEAL_STAGE_VALUES.map((stage) => [stage, stage.replace(/_/g, " ")]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGE_VALUES.map((stage) => (
                    <SelectItem key={stage} value={stage} label={stage.replace(/_/g, " ")}>
                      {stage.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Target segment</Label>
          <Controller
            control={control}
            name="targetSegment"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(LEAD_SEGMENT_VALUES.map((segment) => [segment, segment]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SEGMENT_VALUES.map((segment) => (
                    <SelectItem key={segment} value={segment} label={segment}>
                      {segment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="budgetRange">Budget range</Label>
          <Input id="budgetRange" {...register("budgetRange")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preferredUnit">Preferred unit</Label>
          <Input id="preferredUnit" {...register("preferredUnit")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="purchaseTimeline">Purchase timeline</Label>
          <Input id="purchaseTimeline" {...register("purchaseTimeline")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="investmentType">Investment type</Label>
          <Input id="investmentType" {...register("investmentType")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transactionType">Transaction type</Label>
          <Input id="transactionType" {...register("transactionType")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="countryCode">Country code</Label>
          <Input id="countryCode" {...register("countryCode")} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" {...register("tags")} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Diaspora / proxy visit</h2>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isOvernightDiaspora"
            render={({ field }) => <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />}
          />
          <Label>Overnight diaspora lead</Label>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="requiresProxyVisit"
            render={({ field }) => <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />}
          />
          <Label>Requires proxy site visit</Label>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="proxyPhoneNumber">Proxy phone number</Label>
          <Input id="proxyPhoneNumber" {...register("proxyPhoneNumber")} />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : lead ? "Save changes" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}
