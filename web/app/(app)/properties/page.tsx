"use client";

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

function formatPrice(price: string, currency: string) {
  const amount = Number(price);
  if (!amount) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function PropertiesPage() {
  const router = useRouter();
  const user = useAuthUser();
  const { data: properties, isLoading, error } = useProperties();
  const canManage = hasRole(user, ["owner", "admin"]);

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
              {properties.map((property) => (
                <TableRow
                  key={property.id}
                  onClick={() => router.push(`/properties/${property.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{property.title}</TableCell>
                  <TableCell>{property.location ?? "—"}</TableCell>
                  <TableCell>{formatPrice(property.price, property.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={PROPERTY_STATUS_COLOR[property.status]}>{property.status.replace("_", " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No properties yet.
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
