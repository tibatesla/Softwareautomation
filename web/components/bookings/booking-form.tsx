"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { useUsers } from "@/lib/queries/users";
import { useCreateBooking } from "@/lib/queries/bookings";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { ApiError } from "@/lib/api";

const bookingFormSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  leadId: z.string().optional(),
  agentId: z.string().optional(),
  scheduledAt: z.string().min(1, "Date and time are required"),
  isVirtual: z.boolean().optional(),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export function BookingForm({ defaultDate }: { defaultDate?: Date }) {
  const router = useRouter();
  const user = useAuthUser();
  const canAssign = hasRole(user, ["owner", "admin"]);

  const { data: properties } = useProperties();
  const { data: leads } = useLeads();
  const { data: users } = useUsers({ enabled: canAssign });
  const agents = users?.filter((u) => u.role === "agent") ?? [];

  const createBooking = useCreateBooking();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      scheduledAt: defaultDate ? toLocalDatetimeInput(defaultDate) : undefined,
    },
  });

  const onSubmit = async (values: BookingFormValues) => {
    try {
      await createBooking.mutateAsync({
        propertyId: values.propertyId,
        leadId: values.leadId || undefined,
        agentId: canAssign ? values.agentId || undefined : undefined,
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        isVirtual: values.isVirtual,
        notes: values.notes,
      });
      toast.success("Booking created");
      router.push("/bookings");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Property</Label>
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
                <SelectValue placeholder="Select property" />
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
        {errors.propertyId && <p className="text-sm text-destructive">{errors.propertyId.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Lead</Label>
        <Controller
          control={control}
          name="leadId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              items={Object.fromEntries((leads ?? []).map((lead) => [lead.id, lead.fullName ?? lead.phoneNumber]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {leads?.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id} label={lead.fullName ?? lead.phoneNumber}>
                    {lead.fullName ?? lead.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {canAssign && (
        <div className="flex flex-col gap-2">
          <Label>Agent</Label>
          <Controller
            control={control}
            name="agentId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(agents.map((agent) => [agent.id, agent.fullName]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Self" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} label={agent.fullName}>
                      {agent.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="scheduledAt">Date and time</Label>
        <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
        {errors.scheduledAt && <p className="text-sm text-destructive">{errors.scheduledAt.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isVirtual"
          render={({ field }) => <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />}
        />
        <Label>Virtual site visit</Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createBooking.isPending}>
          {createBooking.isPending ? "Saving..." : "Create booking"}
        </Button>
      </div>
    </form>
  );
}

function toLocalDatetimeInput(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
