"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, CheckCircle2, Clock, Ban, Trash2, ChevronRight, ChevronDown, Share2 } from "lucide-react";
import { useBulkDeleteProperties, useProperties, usePostPropertyToSocial } from "@/lib/queries/properties";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROPERTY_STATUS_COLOR } from "@/lib/status-colors";
import { PROPERTY_AREA_VALUES } from "@/lib/property-constants";
import { formatCurrency, cn } from "@/lib/utils";
import { groupByDevelopment, countPropertyListings } from "@/lib/property-grouping";

export default function PropertiesPage() {
  const router = useRouter();
  const user = useAuthUser();
  const { data: properties, isLoading, error } = useProperties();
  const canManage = hasRole(user, ["owner", "admin"]);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const bulkDelete = useBulkDeleteProperties();
  const postToSocial = usePostPropertyToSocial();
  const [postingId, setPostingId] = useState<string | null>(null);

  const toggleGroup = (development: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(development) ? next.delete(development) : next.add(development);
      return next;
    });
  };

  const areaCounts = PROPERTY_AREA_VALUES.map((area) => ({
    area,
    label: area.split(",")[0],
    count: properties?.filter((p) => p.location === area).length ?? 0,
  }));
  const otherCount = properties?.filter((p) => !p.location || !(PROPERTY_AREA_VALUES as readonly string[]).includes(p.location)).length ?? 0;

  const visibleProperties = areaFilter ? properties?.filter((p) => (areaFilter === "Other" ? !p.location || !(PROPERTY_AREA_VALUES as readonly string[]).includes(p.location) : p.location === areaFilter)) : properties;

  const allVisibleSelected = Boolean(visibleProperties?.length) && visibleProperties!.every((p) => selected.has(p.id));
  const groupedRows = visibleProperties ? groupByDevelopment(visibleProperties) : undefined;

  const toggleAll = () => {
    if (!visibleProperties) return;
    setSelected(allVisibleSelected ? new Set() : new Set(visibleProperties.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(`Delete ${count} propert${count === 1 ? "y" : "ies"}? This can't be undone.`)) return;
    try {
      const result = await bulkDelete.mutateAsync([...selected]);
      setSelected(new Set());
      if (result.failed.length === 0) {
        toast.success(`Deleted ${result.deleted.length} propert${result.deleted.length === 1 ? "y" : "ies"}`);
      } else {
        toast.error(
          `Deleted ${result.deleted.length}, couldn't delete ${result.failed.length}: ${result.failed
            .map((f) => f.error)
            .join(" ")}`,
        );
      }
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const handlePostToSocial = async (id: string, label: string) => {
    if (!window.confirm(`Post "${label}" to Facebook and Instagram now?`)) return;
    setPostingId(id);
    try {
      const { result, unitsIncluded } = await postToSocial.mutateAsync(id);
      const platforms = [result.facebook === "posted" && "Facebook", result.instagram === "posted" && "Instagram"].filter(Boolean);
      if (platforms.length > 0) {
        toast.success(`Posted "${label}" (${unitsIncluded} unit${unitsIncluded === 1 ? "" : "s"}) to ${platforms.join(" & ")}`);
      } else {
        toast.error(`Post to social media failed for "${label}" -- check the Meta credentials are still valid.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post to social media");
    } finally {
      setPostingId(null);
    }
  };

  const renderSocialCell = (postedAt: string | null, id: string, label: string) => (
    <TableCell onClick={(e) => e.stopPropagation()}>
      {postedAt ? (
        <Badge variant="success" title={`Posted ${new Date(postedAt).toLocaleDateString()}`}>
          <CheckCircle2 className="size-3" />
          Posted
        </Badge>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePostToSocial(id, label)}
          disabled={postingId === id}
        >
          <Share2 className="size-3.5" />
          {postingId === id ? "Posting..." : "Post to Social"}
        </Button>
      )}
    </TableCell>
  );

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
          <StatCard label="Total" value={countPropertyListings(properties)} icon={Building2} color="primary" />
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

      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {visibleProperties && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                )}
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead>Social</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRows?.map((row) => {
                if (!("development" in row)) {
                  const property = row;
                  return (
                    <TableRow
                      key={property.id}
                      onClick={() => router.push(`/properties/${property.id}`)}
                      className="cursor-pointer"
                    >
                      {canManage && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(property.id)}
                            onCheckedChange={() => toggleOne(property.id)}
                            aria-label={`Select ${property.title}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{property.title}</TableCell>
                      <TableCell>{property.location ?? "—"}</TableCell>
                      <TableCell>{formatCurrency(property.price, property.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={PROPERTY_STATUS_COLOR[property.status]}>{property.status.replace("_", " ")}</Badge>
                      </TableCell>
                      {canManage && renderSocialCell(property.socialPostedAt, property.id, property.title)}
                    </TableRow>
                  );
                }

                const { development, units } = row;
                const expanded = expandedGroups.has(development);
                const prices = units.map((u) => Number(u.price));
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const statuses = new Set(units.map((u) => u.status));
                const location = units[0]?.location;
                const sameLocation = units.every((u) => u.location === location);
                const groupPostedAt = units.find((u) => u.socialPostedAt)?.socialPostedAt ?? null;

                return (
                  <Fragment key={development}>
                    <TableRow
                      onClick={() => toggleGroup(development)}
                      className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                    >
                      {canManage && <TableCell />}
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          {development}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({units.length} unit{units.length === 1 ? "" : "s"})
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{sameLocation ? (location ?? "—") : "—"}</TableCell>
                      <TableCell>
                        {minPrice === maxPrice
                          ? formatCurrency(minPrice, units[0]?.currency)
                          : `${formatCurrency(minPrice, units[0]?.currency)} – ${formatCurrency(maxPrice, units[0]?.currency)}`}
                      </TableCell>
                      <TableCell>
                        {statuses.size === 1 ? (
                          <Badge variant={PROPERTY_STATUS_COLOR[units[0].status]}>{units[0].status.replace("_", " ")}</Badge>
                        ) : (
                          <Badge variant="outline">Mixed</Badge>
                        )}
                      </TableCell>
                      {canManage && renderSocialCell(groupPostedAt, units[0].id, development)}
                    </TableRow>
                    {expanded &&
                      units.map((property) => (
                        <TableRow
                          key={property.id}
                          onClick={() => router.push(`/properties/${property.id}`)}
                          className="cursor-pointer"
                        >
                          {canManage && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(property.id)}
                                onCheckedChange={() => toggleOne(property.id)}
                                aria-label={`Select ${property.title}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="pl-8 font-medium">{property.title}</TableCell>
                          <TableCell>{property.location ?? "—"}</TableCell>
                          <TableCell>{formatCurrency(property.price, property.currency)}</TableCell>
                          <TableCell>
                            <Badge variant={PROPERTY_STATUS_COLOR[property.status]}>{property.status.replace("_", " ")}</Badge>
                          </TableCell>
                          {canManage && <TableCell />}
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
              {visibleProperties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 4} className="text-center text-muted-foreground">
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
