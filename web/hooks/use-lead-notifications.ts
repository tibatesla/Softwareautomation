"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLeads } from "@/lib/queries/leads";

/**
 * Watches the (already-polling) leads list for unread counts that went UP
 * since the last poll and surfaces that as an in-app toast + a browser
 * notification -- there's no SMS/push infrastructure in this project, so
 * this is the realistic version of "notify when a lead reaches out" that's
 * actually buildable here. Only fires on an increase between two polls,
 * never on first load (that would toast once per already-unread lead on
 * every page load/login, which isn't a notification, it's spam).
 *
 * Mounted once in AppSidebar, so it's active on every authenticated page,
 * not just the leads list.
 */
export function useLeadNotifications() {
  const { data: leads } = useLeads();
  const previousUnreadRef = useRef<Map<string, number> | null>(null);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (permissionRequestedRef.current || Notification.permission !== "default") return;
    permissionRequestedRef.current = true;
    Notification.requestPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!leads) return;
    const current = new Map(leads.map((lead) => [lead.id, lead.unreadCount]));

    if (previousUnreadRef.current) {
      const previous = previousUnreadRef.current;
      for (const lead of leads) {
        const prevCount = previous.get(lead.id) ?? 0;
        if (lead.unreadCount > prevCount) {
          const name = lead.fullName || lead.phoneNumber;
          toast.info(`New message from ${name}`, {
            action: { label: "Open", onClick: () => { window.location.href = `/leads/${lead.id}`; } },
          });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("New WhatsApp message", { body: `${name} sent a new message` });
          }
        }
      }
    }

    previousUnreadRef.current = current;
  }, [leads]);

  const totalUnread = leads?.reduce((sum, lead) => sum + lead.unreadCount, 0) ?? 0;
  return { totalUnread };
}
