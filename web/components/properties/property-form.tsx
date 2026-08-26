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
import { PROPERTY_AMENITY_VALUES, PROPERTY_AREA_VALUES, PROPERTY_STATUS_VALUES } from "@/lib/property-constants";
import type { Property } from "@/lib/types";
import { useUsers } from "@/lib/queries/users";
import { useCreateProperty, useUpdateProperty, type CreatePropertyPayload } from "@/lib/queries/properties";
import { ApiError } from "@/lib/api";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";

const optionalNumberInput = z.union([z.string(), z.number()]).optional();

const propertyFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  price: optionalNumberInput,
  currency: z.string().length(3).optional(),
  status: z.enum(PROPERTY_STATUS_VALUES).optional(),
  assignedAgentId: z.string().optional(),
  referenceId: z.string().optional(),
  priceMin: optionalNumberInput,
  priceMax: optionalNumberInput,
  unitType: z.string().optional(),
  totalUnits: optionalNumberInput,
  developerContactName: z.string().optional(),
  developerEmail: z.union([z.string().email(), z.literal("")]).optional(),
  developerPhone: z.string().optional(),
  completionTime: z.string().optional(),
  levelFloors: optionalNumberInput,
  view: z.string().optional(),
  paymentPlanStructure: z.string().optional(),
  houseSizeSqft: optionalNumberInput,
  houseSizeSqftMin: optionalNumberInput,
  houseSizeSqftMax: optionalNumberInput,
  developmentName: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  subLocation: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

function toDefaultValues(property?: Property): Partial<PropertyFormValues> {
  if (!property) return { currency: "KES", amenities: [] };

  return {
    title: property.title,
    description: property.description ?? "",
    location: property.location ?? "",
    price: property.price ? Number(property.price) : undefined,
    currency: property.currency,
    status: property.status,
    assignedAgentId: property.assignedAgentId ?? "",
    referenceId: property.referenceId ?? "",
    priceMin: property.priceMin ? Number(property.priceMin) : undefined,
    priceMax: property.priceMax ? Number(property.priceMax) : undefined,
    unitType: property.unitType ?? "",
    totalUnits: property.totalUnits ?? undefined,
    developerContactName: property.developerContactName ?? "",
    developerEmail: property.developerEmail ?? "",
    developerPhone: property.developerPhone ?? "",
    completionTime: property.completionTime ?? "",
    levelFloors: property.levelFloors ?? undefined,
    view: property.view ?? "",
    paymentPlanStructure: property.paymentPlanStructure ?? "",
    houseSizeSqft: property.houseSizeSqft ? Number(property.houseSizeSqft) : undefined,
    houseSizeSqftMin: property.houseSizeSqftMin ? Number(property.houseSizeSqftMin) : undefined,
    houseSizeSqftMax: property.houseSizeSqftMax ? Number(property.houseSizeSqftMax) : undefined,
    developmentName: property.developmentName ?? "",
    amenities: property.amenities,
    subLocation: property.subLocation ?? "",
  };
}

export function PropertyForm({ property }: { property?: Property }) {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: users } = useUsers({ enabled: hasRole(authUser, ["owner", "admin"]) });
  const agents = users?.filter((u) => u.role === "agent") ?? [];

  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty(property?.id ?? "");
  const mutation = property ? updateProperty : createProperty;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: toDefaultValues(property),
  });

  const onSubmit = async (values: PropertyFormValues) => {
    // A property saved before the area dropdown existed can carry a
    // location outside the approved list (shown as its own flagged option
    // in the Select, see below) -- if the user leaves it untouched, don't
    // resubmit it: the backend's strict enum would reject the whole update
    // over an unrelated field. Only send location when it's empty or one
    // of the approved values, i.e. the user actually picked from the list.
    const location =
      !values.location || PROPERTY_AREA_VALUES.includes(values.location as (typeof PROPERTY_AREA_VALUES)[number])
        ? values.location
        : undefined;

    const payload: CreatePropertyPayload = {
      ...values,
      location,
      price: toNumber(values.price),
      priceMin: toNumber(values.priceMin),
      priceMax: toNumber(values.priceMax),
      totalUnits: toNumber(values.totalUnits),
      levelFloors: toNumber(values.levelFloors),
      houseSizeSqft: toNumber(values.houseSizeSqft),
      houseSizeSqftMin: toNumber(values.houseSizeSqftMin),
      houseSizeSqftMax: toNumber(values.houseSizeSqftMax),
      assignedAgentId: values.assignedAgentId || undefined,
      developerEmail: values.developerEmail || undefined,
      referenceId: values.referenceId || undefined,
    };

    try {
      const saved = await mutation.mutateAsync(payload);
      toast.success(property ? "Property updated" : "Property created — add photos and videos below");
      router.push(`/properties/${saved.id}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="developmentName">Development / project group</Label>
          <Input
            id="developmentName"
            placeholder="e.g. Steller Bay Residence"
            {...register("developmentName")}
          />
          <p className="text-xs text-muted-foreground">
            Properties sharing this name are grouped together on the Properties page. Leave blank if this isn&apos;t
            part of a multi-unit development.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...register("description")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Location</Label>
          <Controller
            control={control}
            name="location"
            render={({ field }) => {
              // A property saved before this dropdown existed (or edited
              // directly in the database) can carry a location outside the
              // approved list -- show it as its own option rather than
              // silently discarding it, so an admin can see what it
              // currently is instead of it just vanishing on save.
              const currentIsUnlisted =
                field.value && !PROPERTY_AREA_VALUES.includes(field.value as (typeof PROPERTY_AREA_VALUES)[number]);
              const areaItems: Record<string, string> = Object.fromEntries(PROPERTY_AREA_VALUES.map((area) => [area, area]));
              if (currentIsUnlisted) {
                areaItems[field.value as string] = `${field.value} (not an approved area — please update)`;
              }
              return (
                <Select value={field.value} onValueChange={field.onChange} items={areaItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentIsUnlisted && (
                      <SelectItem value={field.value as string} label={field.value as string}>
                        {field.value} (not an approved area — please update)
                      </SelectItem>
                    )}
                    {PROPERTY_AREA_VALUES.map((area) => (
                      <SelectItem key={area} value={area} label={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="subLocation">Sub-location</Label>
          <Input id="subLocation" {...register("subLocation")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="referenceId">Reference ID</Label>
          <Input id="referenceId" {...register("referenceId")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(PROPERTY_STATUS_VALUES.map((status) => [status, status.replace("_", " ")]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_STATUS_VALUES.map((status) => (
                    <SelectItem key={status} value={status} label={status.replace("_", " ")}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Assigned agent</Label>
          <Controller
            control={control}
            name="assignedAgentId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={Object.fromEntries(agents.map((agent) => [agent.id, agent.fullName]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
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
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price</Label>
          <Input id="price" type="number" step="0.01" {...register("price")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" maxLength={3} {...register("currency")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priceMin">Price min</Label>
          <Input id="priceMin" type="number" step="0.01" {...register("priceMin")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priceMax">Price max</Label>
          <Input id="priceMax" type="number" step="0.01" {...register("priceMax")} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="unitType">Unit type</Label>
          <Input id="unitType" {...register("unitType")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="totalUnits">Total units</Label>
          <Input id="totalUnits" type="number" {...register("totalUnits")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="levelFloors">Level / floors</Label>
          <Input id="levelFloors" type="number" {...register("levelFloors")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="houseSizeSqft">House size (sqm)</Label>
          <Input id="houseSizeSqft" type="number" step="0.01" {...register("houseSizeSqft")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="houseSizeSqftMin">House size min (sqm)</Label>
          <Input id="houseSizeSqftMin" type="number" step="0.01" {...register("houseSizeSqftMin")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="houseSizeSqftMax">House size max (sqm)</Label>
          <Input id="houseSizeSqftMax" type="number" step="0.01" {...register("houseSizeSqftMax")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="view">View</Label>
          <Input id="view" {...register("view")} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="completionTime">Completion time</Label>
          <Input id="completionTime" {...register("completionTime")} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-4">
          <Label htmlFor="paymentPlanStructure">Payment plan structure</Label>
          <Textarea id="paymentPlanStructure" rows={2} {...register("paymentPlanStructure")} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">Developer Liaison Contact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="developerContactName">Name</Label>
            <Input id="developerContactName" {...register("developerContactName")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="developerEmail">Email</Label>
            <Input id="developerEmail" type="email" {...register("developerEmail")} />
            {errors.developerEmail && <p className="text-sm text-destructive">{errors.developerEmail.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="developerPhone">Phone</Label>
            <Input id="developerPhone" {...register("developerPhone")} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label>Amenities</Label>
        <Controller
          control={control}
          name="amenities"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-4 sm:grid-cols-3 lg:grid-cols-4">
              {PROPERTY_AMENITY_VALUES.map((amenity) => {
                const checked = field.value?.includes(amenity) ?? false;
                return (
                  <label key={amenity} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => {
                        const current = field.value ?? [];
                        field.onChange(next ? [...current, amenity] : current.filter((a) => a !== amenity));
                      }}
                    />
                    {amenity}
                  </label>
                );
              })}
            </div>
          )}
        />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : property ? "Save changes" : "Create property"}
        </Button>
      </div>
    </form>
  );
}
