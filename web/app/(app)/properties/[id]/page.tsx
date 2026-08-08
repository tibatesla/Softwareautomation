"use client";

import { use } from "react";
import Link from "next/link";
import { useProperty } from "@/lib/queries/properties";
import { useUsers } from "@/lib/queries/users";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/properties/media-gallery";
import { PROPERTY_STATUS_COLOR } from "@/lib/status-colors";
import { BackButton } from "@/components/back-button";

function formatPrice(price: string | null, currency: string) {
  if (!price) return "—";
  const amount = Number(price);
  if (!amount) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuthUser();
  const { data: property, isLoading, error } = useProperty(id);
  const canManage = hasRole(user, ["owner", "admin"]);
  const { data: users } = useUsers({ enabled: canManage });

  if (isLoading) return <p className="text-muted-foreground">Loading property...</p>;
  if (error || !property) return <p className="text-destructive">Property not found.</p>;

  const assignedAgent = users?.find((u) => u.id === property.assignedAgentId);

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{property.title}</h1>
          <p className="text-muted-foreground">{property.location ?? "No location set"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={PROPERTY_STATUS_COLOR[property.status]}>{property.status.replace("_", " ")}</Badge>
          {canManage && (
            <Button render={<Link href={`/properties/${property.id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {property.description && <p className="text-sm">{property.description}</p>}

      <MediaGallery propertyId={property.id} images={property.images} videos={property.videos} canManage={canManage} />

      <section className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <Field label="Price" value={formatPrice(property.price, property.currency)} />
        <Field label="Price range" value={`${formatPrice(property.priceMin, property.currency)} - ${formatPrice(property.priceMax, property.currency)}`} />
        <Field label="Reference ID" value={property.referenceId} />
        <Field label="Assigned agent" value={assignedAgent?.fullName} />
        <Field label="Unit type" value={property.unitType} />
        <Field label="Total units" value={property.totalUnits} />
        <Field label="Level / floors" value={property.levelFloors} />
        <Field label="House size (sqft)" value={property.houseSizeSqft} />
        <Field label="View" value={property.view} />
        <Field label="Sub-location" value={property.subLocation} />
        <Field label="Completion time" value={property.completionTime} />
        <Field label="Payment plan" value={property.paymentPlanStructure} />
        <Field label="Developer contact" value={property.developerContactName} />
        <Field label="Developer email" value={property.developerEmail} />
        <Field label="Developer phone" value={property.developerPhone} />
      </section>

      {property.amenities.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity) => (
              <Badge key={amenity} variant="purple">
                {amenity}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
