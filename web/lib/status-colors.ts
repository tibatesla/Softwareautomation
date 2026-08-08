import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeColor = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const PROPERTY_STATUS_COLOR: Record<string, BadgeColor> = {
  available: "success",
  reserved: "warning",
  sold: "info",
  off_market: "rose",
};

export const LEAD_QUALIFICATION_COLOR: Record<string, BadgeColor> = {
  new: "info",
  qualifying: "warning",
  qualified: "success",
  unqualified: "rose",
  converted: "purple",
  lost: "secondary",
};

export const BOOKING_STATUS_COLOR: Record<string, BadgeColor> = {
  scheduled: "info",
  completed: "success",
  cancelled: "rose",
  no_show: "warning",
};

export const USER_ROLE_COLOR: Record<string, BadgeColor> = {
  owner: "purple",
  admin: "info",
  agent: "success",
};

export const DEAL_STAGE_COLOR: Record<string, BadgeColor> = {
  new: "secondary",
  site_visit_scheduled: "info",
  site_visit_done: "warning",
  offer_signed: "purple",
  deposit_paid: "success",
  commission_paid: "success",
};

export const AD_PLATFORM_COLOR: Record<string, BadgeColor> = {
  meta: "info",
  google: "warning",
  tiktok: "purple",
};
