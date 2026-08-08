"use client";

import { use } from "react";
import { useProperty } from "@/lib/queries/properties";
import { PropertyForm } from "@/components/properties/property-form";
import { MediaGallery } from "@/components/properties/media-gallery";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: property, isLoading, error } = useProperty(id);

  if (isLoading) return <p className="text-muted-foreground">Loading property...</p>;
  if (error || !property) return <p className="text-destructive">Property not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <h1 className="text-2xl font-semibold">Edit Property</h1>

      <Card>
        <CardHeader>
          <CardTitle>Photos & videos</CardTitle>
          <CardDescription>Upload images and videos for this listing.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaGallery propertyId={property.id} images={property.images} videos={property.videos} canManage />
        </CardContent>
      </Card>

      <PropertyForm property={property} />
    </div>
  );
}
