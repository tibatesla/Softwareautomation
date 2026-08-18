"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useDeleteProperty, useProperty } from "@/lib/queries/properties";
import { useUsers } from "@/lib/queries/users";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/properties/media-gallery";
import { PROPERTY_STATUS_COLOR } from "@/lib/status-colors";
import { BackButton } from "@/components/back-button";
import { formatCurrency } from "@/lib/utils";

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
  const router = useRouter();
  const user = useAuthUser();
  const { data: property, isLoading, error } = useProperty(id);
  const canManage = hasRole(user, ["owner", "admin"]);
  const { data: users } = useUsers({ enabled: canManage });
  const deleteProperty = useDeleteProperty();

  if (isLoading) return <p className="text-muted-foreground">Loading property...</p>;
  if (error || !property) return <p className="text-destructive">Property not found.</p>;

  const assignedAgent = users?.find((u) => u.id === property.assignedAgentId);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${property.title}"? This can't be undone.`)) return;
    try {
      await deleteProperty.mutateAsync(property.id);
      toast.success("Property deleted");
      router.push("/properties");
    } catch (deleteError) {
      // Most likely a 409 explaining which linked leads/bookings/payments
      // are blocking it (see deleteProperty in property.controller.ts) --
      // surfaced verbatim since it already tells the owner to mark the
      // property unavailable instead.
      const message = deleteError instanceof ApiError ? deleteError.message : "Failed to delete property";
      toast.error(message);
    }
  };

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
            <>
              <Button render={<Link href={`/properties/${property.id}/edit`} />} nativeButton={false}>
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Delete property"
                onClick={handleDelete}
                disabled={deleteProperty.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {property.description && <p className="text-sm">{property.description}</p>}

      <MediaGallery propertyId={property.id} images={property.images} videos={property.videos} canManage={canManage} />

      <section className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <Field label="Price" value={formatCurrency(property.price, property.currency)} />
        <Field label="Price range" value={`${formatCurrency(property.priceMin, property.currency)} - ${formatCurrency(property.priceMax, property.currency)}`} />
        <Field label="Reference ID" value={property.referenceId} />
        <Field label="Assigned agent" value={assignedAgent?.fullName} />
        <Field label="Unit type" value={property.unitType} />
        <Field label="Total units" value={property.totalUnits} />
        <Field label="Level / floors" value={property.levelFloors} />
        <Field label="House size (sqm)" value={property.houseSizeSqft} />
        <Field label="View" value={property.view} />
        <Field label="Sub-location" value={property.subLocation} />
        <Field label="Completion time" value={property.completionTime} />
        <Field label="Payment plan" value={property.paymentPlanStructure} />
      </section>

      {(property.developerContactName || property.developerEmail || property.developerPhone) && (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Developer Liaison Contact</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Name" value={property.developerContactName} />
            <Field
              label="Email"
              value={
                property.developerEmail ? (
                  <a href={`mailto:${property.developerEmail}`} className="text-primary hover:underline">
                    {property.developerEmail}
                  </a>
                ) : null
              }
            />
            <Field
              label="Phone"
              value={
                property.developerPhone ? (
                  <a href={`tel:${property.developerPhone}`} className="text-primary hover:underline">
                    {property.developerPhone}
                  </a>
                ) : null
              }
            />
          </div>
        </section>
      )}

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
