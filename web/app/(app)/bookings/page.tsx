"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, isSameDay, isToday } from "date-fns";
import { CalendarDays, CalendarCheck2, Video, CircleX, Trash2 } from "lucide-react";
import { useBookings, useBulkDeleteBookings, useUpdateBooking } from "@/lib/queries/bookings";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { useUsers } from "@/lib/queries/users";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import type { Booking, BookingStatus } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BOOKING_STATUS_VALUES } from "@/lib/booking-constants";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DEAL_STAGE_COLOR } from "@/lib/status-colors";

const STATUS_TRIGGER_CLASS: Record<BookingStatus, string> = {
  scheduled: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  no_show: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function BookingStatusSelect({ booking }: { booking: Booking }) {
  const updateBooking = useUpdateBooking(booking.id);

  return (
    <Select
      value={booking.status}
      onValueChange={async (status) => {
        try {
          await updateBooking.mutateAsync({ status: status as BookingStatus });
        } catch (error) {
          const message = error instanceof ApiError ? error.message : "Failed to update booking";
          toast.error(message);
        }
      }}
      items={Object.fromEntries(BOOKING_STATUS_VALUES.map((status) => [status, status.replace("_", " ")]))}
    >
      <SelectTrigger className={cn("w-36", STATUS_TRIGGER_CLASS[booking.status])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BOOKING_STATUS_VALUES.map((status) => (
          <SelectItem key={status} value={status} label={status.replace("_", " ")}>
            {status.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showAll, setShowAll] = useState(false);
  const user = useAuthUser();
  const canAssign = hasRole(user, ["owner", "admin"]);

  const { data: bookings, isLoading, error } = useBookings();
  const { data: properties } = useProperties();
  const { data: leads } = useLeads();
  const { data: users } = useUsers({ enabled: canAssign });
  const bulkDelete = useBulkDeleteBookings();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const bookedDays = useMemo(() => bookings?.map((b) => new Date(b.scheduledAt)) ?? [], [bookings]);

  const visibleBookings = useMemo(() => {
    if (!bookings) return [];
    const filtered = showAll
      ? bookings
      : bookings.filter((b) => selectedDate && isSameDay(new Date(b.scheduledAt), selectedDate));
    return [...filtered].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [bookings, selectedDate, showAll]);

  // Owner/admin can delete any booking; an agent can only delete their own
  // (matches the RLS scoping the backend already enforces).
  const canDelete = (booking: Booking) => canAssign || booking.agentId === user?.id;
  const deletableVisible = visibleBookings.filter(canDelete);
  const allSelected = deletableVisible.length > 0 && deletableVisible.every((b) => selected.has(b.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(deletableVisible.map((b) => b.id)));
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
    if (!window.confirm(`Delete ${count} booking${count === 1 ? "" : "s"}? This can't be undone.`)) return;
    try {
      const result = await bulkDelete.mutateAsync([...selected]);
      setSelected(new Set());
      if (result.failed.length === 0) {
        toast.success(`Deleted ${result.deleted.length} booking${result.deleted.length === 1 ? "" : "s"}`);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Button render={<Link href="/bookings/new" />} nativeButton={false}>
          New Booking
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading bookings...</p>}
      {error && <p className="text-destructive">Failed to load bookings.</p>}

      {bookings && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today"
            value={bookings.filter((b) => isToday(new Date(b.scheduledAt))).length}
            icon={CalendarDays}
            color="primary"
          />
          <StatCard
            label="Scheduled"
            value={bookings.filter((b) => b.status === "scheduled").length}
            icon={CalendarCheck2}
            color="info"
          />
          <StatCard label="Virtual" value={bookings.filter((b) => b.isVirtual).length} icon={Video} color="success" />
          <StatCard
            label="Cancelled / no-show"
            value={bookings.filter((b) => b.status === "cancelled" || b.status === "no_show").length}
            icon={CircleX}
            color="danger"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="overflow-x-auto">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{ booked: bookedDays }}
            modifiersClassNames={{ booked: "font-semibold underline" }}
            className="w-full rounded-lg border lg:w-auto"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {showAll
                ? "All bookings"
                : selectedDate
                  ? `Bookings on ${format(selectedDate, "PP")}`
                  : "Select a date"}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show selected date only" : "Show all bookings"}
            </Button>
          </div>

          {selected.size > 0 && (
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

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {deletableVisible.length > 0 && (
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                  )}
                  <TableHead>{showAll ? "Date" : "Time"}</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Lead</TableHead>
                  {canAssign && <TableHead>Agent</TableHead>}
                  <TableHead>Visit type</TableHead>
                  <TableHead>Deal stage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBookings.map((booking) => {
                  const property = properties?.find((p) => p.id === booking.propertyId);
                  const lead = leads?.find((l) => l.id === booking.leadId);
                  const agent = users?.find((u) => u.id === booking.agentId);
                  return (
                    <TableRow key={booking.id}>
                      {deletableVisible.length > 0 && (
                        <TableCell>
                          {canDelete(booking) && (
                            <Checkbox
                              checked={selected.has(booking.id)}
                              onCheckedChange={() => toggleOne(booking.id)}
                              aria-label={`Select booking on ${format(new Date(booking.scheduledAt), "PP p")}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {format(new Date(booking.scheduledAt), showAll ? "PP p" : "p")}
                      </TableCell>
                      <TableCell>
                        {property?.title ?? (booking.propertyId ? "—" : <span className="text-muted-foreground">General consultation</span>)}
                      </TableCell>
                      <TableCell>{lead?.fullName ?? lead?.phoneNumber ?? "—"}</TableCell>
                      {canAssign && <TableCell>{agent?.fullName ?? "—"}</TableCell>}
                      <TableCell>
                        <Badge variant={booking.isVirtual ? "purple" : "info"}>
                          {booking.isVirtual ? "Virtual Visit" : "Physical Visit"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead ? (
                          <Badge variant={DEAL_STAGE_COLOR[lead.dealStage]}>{lead.dealStage.replace(/_/g, " ")}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <BookingStatusSelect booking={booking} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visibleBookings.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={(canAssign ? 7 : 6) + (deletableVisible.length > 0 ? 1 : 0)}
                      className="text-center text-muted-foreground"
                    >
                      No bookings {showAll ? "yet" : "on this date"}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
