import type { PROPERTY_AMENITY_VALUES, PROPERTY_STATUS_VALUES } from "@/lib/property-constants";
import type { DEAL_STAGE_VALUES, LEAD_QUALIFICATION_STATUS_VALUES, LEAD_SEGMENT_VALUES } from "@/lib/lead-constants";
import type { BOOKING_STATUS_VALUES } from "@/lib/booking-constants";
import type { PAYMENT_PAYER_TYPE_VALUES } from "@/lib/payment-constants";

export type UserRole = "owner" | "admin" | "agent";

// Owner is deliberately excluded -- mirrors the backend's
// manageableUserRoleValues (src/schemas/user.schema.ts). An Owner cannot
// create or promote another account to Owner through the Users UI.
export const MANAGEABLE_USER_ROLE_VALUES: Exclude<UserRole, "owner">[] = ["admin", "agent"];

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export function hasRole(user: AuthUser | null, roles: UserRole[]): boolean {
  return user !== null && roles.includes(user.role);
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  isOnDuty: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PropertyStatus = (typeof PROPERTY_STATUS_VALUES)[number];
export type PropertyAmenity = (typeof PROPERTY_AMENITY_VALUES)[number];

export type AdPlatform = "meta" | "google" | "tiktok";

export interface AdPerformanceLog {
  id: string;
  platform: AdPlatform;
  campaignId: string;
  adId: string;
  windowStart: string;
  impressions: number;
  clicks: number;
  spend: string;
  currency: string;
  qualifiedLeads: number;
  ctr: string | null;
  cpql: string | null;
  loggedAt: string;
}

export interface AdRuleExecution {
  id: string;
  adPerformanceLogId: string | null;
  ruleName: string;
  platform: AdPlatform | null;
  campaignId: string | null;
  adId: string | null;
  actionTaken: string;
  reason: string | null;
  success: boolean;
  errorDetail: string | null;
  executedAt: string;
}

export type PaymentPayerType = (typeof PAYMENT_PAYER_TYPE_VALUES)[number];

export interface Payment {
  id: string;
  propertyId: string;
  leadId: string | null;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  paymentDate: string;
  recordedBy: string;
  notes: string | null;
  payerType: PaymentPayerType;
  createdAt: string;
}

export type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

export interface Booking {
  id: string;
  propertyId: string;
  leadId: string | null;
  agentId: string;
  scheduledAt: string;
  status: BookingStatus;
  isVirtual: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadQualificationStatus = (typeof LEAD_QUALIFICATION_STATUS_VALUES)[number];
export type LeadSegment = (typeof LEAD_SEGMENT_VALUES)[number];
export type DealStage = (typeof DEAL_STAGE_VALUES)[number];

export interface Lead {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  email: string | null;
  source: string | null;
  propertyId: string | null;
  qualificationStatus: LeadQualificationStatus;
  budgetRange: string | null;
  preferredUnit: string | null;
  purchaseTimeline: string | null;
  targetSegment: LeadSegment | null;
  countryCode: string | null;
  requiresProxyVisit: boolean;
  proxyPhoneNumber: string | null;
  isOvernightDiaspora: boolean;
  fbclid: string | null;
  claimedAt: string | null;
  claimedByAgentId: string | null;
  lastCapiFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  investmentType: string | null;
  transactionType: string | null;
  dealStage: DealStage;
  propertyInterestRaw: string | null;
  ctwaClid: string | null;
  lastMessageAt: string | null;
  visitPreference: "in_person" | "virtual" | null;
  // Not a DB column -- computed per-request in listLeads, scoped to the
  // calling user's own read state (see lead_reads / migration 030).
  unreadCount: number;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageSenderType = "bot" | "human";

export interface LeadMessage {
  id: string;
  leadId: string;
  direction: MessageDirection;
  senderType: MessageSenderType | null;
  body: string;
  whatsappMessageId: string | null;
  createdAt: string;
}

// Prisma Decimal fields (price, priceMin, priceMax, houseSizeSqft) serialize
// as strings over JSON -- not numbers.
export interface Property {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price: string;
  currency: string;
  status: PropertyStatus;
  assignedAgentId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  referenceId: string | null;
  priceMin: string | null;
  priceMax: string | null;
  unitType: string | null;
  totalUnits: number | null;
  developerContactName: string | null;
  developerEmail: string | null;
  developerPhone: string | null;
  completionTime: string | null;
  levelFloors: number | null;
  view: string | null;
  paymentPlanStructure: string | null;
  houseSizeSqft: string | null;
  amenities: PropertyAmenity[];
  subLocation: string | null;
  images: string[];
  videos: string[];
}
