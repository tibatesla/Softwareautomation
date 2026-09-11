import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Building2, Contact, CalendarDays, Wallet, LineChart, Trophy, UserCog } from "lucide-react";
import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  icon: LucideIcon;
  iconClassName: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["owner", "admin", "agent"],
    icon: LayoutDashboard,
    iconClassName: "text-indigo-400",
  },
  {
    href: "/properties",
    label: "Properties",
    roles: ["owner", "admin", "agent"],
    icon: Building2,
    iconClassName: "text-sky-400",
  },
  {
    href: "/leads",
    label: "Leads",
    roles: ["owner", "admin", "agent"],
    icon: Contact,
    iconClassName: "text-violet-400",
  },
  {
    href: "/bookings",
    label: "Bookings",
    roles: ["owner", "admin", "agent"],
    icon: CalendarDays,
    iconClassName: "text-teal-400",
  },
  {
    href: "/payments",
    label: "Payments",
    roles: ["owner", "admin", "agent"],
    icon: Wallet,
    iconClassName: "text-emerald-400",
  },
  {
    href: "/ad-performance",
    label: "Ad Performance",
    roles: ["owner", "admin"],
    icon: LineChart,
    iconClassName: "text-rose-400",
  },
  {
    href: "/agent-performance",
    label: "Agent Performance",
    roles: ["owner", "admin", "agent"],
    icon: Trophy,
    iconClassName: "text-yellow-400",
  },
  {
    href: "/users",
    label: "Users",
    roles: ["owner"],
    icon: UserCog,
    iconClassName: "text-amber-400",
  },
];
