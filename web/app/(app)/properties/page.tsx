"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Clock, Ban } from "lucide-react";
import { useProperties } from "@/lib/queries/properties";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROPERTY_STATUS_COLOR } from "@/lib/status-colors";
import { PROPERTY_AREA_VALUES } from "@/lib/property-constants";
import { formatCurrency, cn } from "@/lib/utils";

export default function PropertiesPage() {
  const router = useRouter();
  const user = useAuthUser();
  const { data: properties, isLoading, error } = useProperties();
  const canManage = hasRole(user, ["owner", "admin"]);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);

  const areaCounts = PROPERTY_AREA_VALUES.map((area) => ({
    area,
    label: area.split(",")[0],
    count: properties?.filter((p) => p.location === area).length ?? 0,
  }));
  const otherCount = properties?.filter((p) => !p.location || !(PROPERTY_AREA_VALUES as readonly string[]).includes(p.location)).length ?? 0;

  const visibleProperties = areaFilter ? properties?.filter((p) => (areaFilter === "Other" ? !p.location || !(PROPERTY_AREA_VALUES as readonly string[]).includes(p.location) : p.location === areaFilter)) : properties;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Properties</h1>
        {canManage && (
          <Button render={<Link href="/properties/new" />} nativeButton={false}>
            New Property
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading properties...</p>}
      {error && <p className="text-destructive">Failed to load properties.</p>}

      {properties && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={properties.length} icon={Building2} color="primary" />
          <StatCard
            label="Available"
            value={properties.filter((p) => p.status === "available").length}
            icon={CheckCircle2}
            color="success"
          />
          <StatCard
            label="Reserved"
            value={properties.filter((p) => p.status === "reserved").length}
            icon={Clock}
            color="warning"
          />
          <StatCard
            label="Off-market / sold"
            value={properties.filter((p) => p.status === "off_market" || p.status === "sold").length}
            icon={Ban}
            color="danger"
          />
        </div>
      )}

      {properties && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">By area:</span>
          <button
            type="button"
            onClick={() => setAreaFilter(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              areaFilter === null ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            All ({properties.length})
          </button>
          {areaCounts.map(({ area, label, count }) => (
            <button
              key={area}
              type="button"
              onClick={() => setAreaFilter(areaFilter === area ? null : area)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                areaFilter === area ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              {label} ({count})
            </button>
          ))}
          {otherCount > 0 && (
            <button
              type="button"
              onClick={() => setAreaFilter(areaFilter === "Other" ? null : "Other")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                areaFilter === "Other" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              Other ({otherCount})
            </button>
          )}
        </div>
      )}

      {visibleProperties && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProperties.map((property) => (
                <TableRow
                  key={property.id}
                  onClick={() => router.push(`/properties/${property.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{property.title}</TableCell>
                  <TableCell>{property.location ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(property.price, property.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={PROPERTY_STATUS_COLOR[property.status]}>{property.status.replace("_", " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {visibleProperties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {areaFilter ? "No properties in this area." : "No properties yet."}
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
