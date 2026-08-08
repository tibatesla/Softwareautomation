"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, isSameDay, isToday } from "date-fns";
import { CalendarDays, CalendarCheck2, Video, CircleX } from "lucide-react";
import { useBookings, useUpdateBooking } from "@/lib/queries/bookings";
import { useProperties } from "@/lib/queries/properties";
import { useLeads } from "@/lib/queries/leads";
import { useUsers } from "@/lib/queries/users";
import { useAuthUser } from "@/components/layout/auth-context";
import { hasRole } from "@/lib/types";
import type { Booking, BookingStatus } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    >
      <SelectTrigger className={cn("w-36", STATUS_TRIGGER_CLASS[booking.status])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BOOKING_STATUS_VALUES.map((status) => (
          <SelectItem key={status} value={status}>
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

  const bookedDays = useMemo(() => bookings?.map((b) => new Date(b.scheduledAt)) ?? [], [bookings]);

  const visibleBookings = useMemo(() => {
    if (!bookings) return [];
    const filtered = showAll
      ? bookings
      : bookings.filter((b) => selectedDate && isSameDay(new Date(b.scheduledAt), selectedDate));
    return [...filtered].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [bookings, selectedDate, showAll]);

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

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
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
                      <TableCell>
                        {format(new Date(booking.scheduledAt), showAll ? "PP p" : "p")}
                      </TableCell>
                      <TableCell>{property?.title ?? "—"}</TableCell>
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
                    <TableCell colSpan={canAssign ? 7 : 6} className="text-center text-muted-foreground">
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
