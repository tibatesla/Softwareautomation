// lib/neighborhoods.ts
//
// Single source of truth for neighborhood page content. Used by:
//   - app/[area]/page.tsx   (renders the page + generates metadata)
//   - JSON-LD schema        (uses lat/lng for geo data)
//
// areaParam values match FOCUS_AREAS in lib/types.ts exactly -- these are
// passed straight into getProperties({ area }) from lib/api.ts.

export type Neighborhood = {
  slug: string;          // the URL: /<slug>
  areaParam: string;     // must exactly match a value in FOCUS_AREAS (lib/types.ts)
  name: string;
  title: string;
  metaDescription: string;
  heading: string;
  intro: string[];
  fitFor: string[];
  diligence: string[];
  lat: number;
  lng: number;
};

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    slug: "kilimani",
    areaParam: "Kilimani",
    name: "Kilimani",
    title: "Apartments for Sale in Kilimani, Nairobi | Chestone Properties",
    metaDescription:
      "Browse verified apartments for sale in Kilimani, Nairobi — 1, 2, and 3-bedroom units near Yaya Centre and Ring Road, with transparent pricing and direct WhatsApp advisory.",
    heading: "Apartments & Off-Plan Units in Kilimani",
    intro: [
      "Kilimani is a vertical, connected apartment corridor bounded by Argwings Kodhek Road, Ngong Road, and Ring Road Kilimani — one of Nairobi's most active markets for professionals, corporate renters, and investors seeking furnished or managed stock close to the city centre.",
      "Chestone's Kilimani listings are reviewed directly by our team before publishing. Building quality, service charge, water and parking arrangements, and construction exposure are worth confirming on a building-by-building basis before you commit.",
    ],
    fitFor: ["Professionals and corporate renters", "Smaller households", "Investors seeking furnished, rentable stock"],
    diligence: ["Building quality and management", "Service charge history", "Water and parking allocation", "Adjacent construction exposure"],
    lat: -1.2921,
    lng: 36.7833,
  },
  {
    slug: "kileleshwa",
    areaParam: "Kileleshwa",
    name: "Kileleshwa",
    title: "Apartments & Family Homes for Sale in Kileleshwa | Chestone Properties",
    metaDescription:
      "Verified apartments and family-sized units for sale in Kileleshwa, Nairobi — leafier, calmer living close to the city, with transparent pricing and direct WhatsApp advisory.",
    heading: "Apartments & Family Homes in Kileleshwa",
    intro: [
      "Kileleshwa is a leafier, more family-oriented apartment corridor undergoing rapid densification, connected via Oloitoktok Road, Mandera Road, and Gitanga Road. It suits families, executive renters, and owner-occupiers who want more space without leaving city proximity.",
      "As with every Chestone listing, availability and pricing shown here are reviewed by our team. Road condition, drainage, sewerage, lift and generator performance are the main diligence points buyers raise in this area.",
    ],
    fitFor: ["Families", "Executive renters and owner-occupiers", "Buyers wanting more space near the city"],
    diligence: ["Road and drainage condition", "Sewerage capacity", "Lift and generator maintenance", "Parking allocation"],
    lat: -1.2793,
    lng: 36.7833,
  },
  {
    slug: "westlands",
    areaParam: "Westlands",
    name: "Westlands",
    title: "Apartments for Sale in Westlands, Nairobi | Chestone Properties",
    metaDescription:
      "Verified apartments and serviced units for sale in Westlands, Nairobi — business-district access near Sarit Centre and Waiyaki Way, with transparent pricing and direct WhatsApp advisory.",
    heading: "Apartments & Serviced Units in Westlands",
    intro: [
      "Westlands is an amenity-dense business and apartment node, with strong reported serviced-apartment activity alongside standard long-term stock. It draws corporate tenants, professionals, and investors who prioritise convenience and access to Waiyaki Way and the Nairobi Expressway.",
      "New apartment supply here has been expanding, so absorption and pricing can vary building to building — we disclose what's confirmed and what's still pending on every listing rather than presenting occupancy as guaranteed.",
    ],
    fitFor: ["Corporate tenants and professionals", "Investors comparing serviced vs. long-term stock", "Buyers prioritising business-district access"],
    diligence: ["Serviced vs. long-term management distinction", "Service charge and supply pipeline", "Parking availability", "Achieved (not just asking) rent"],
    lat: -1.2648,
    lng: 36.8039,
  },
  {
    slug: "lavington",
    areaParam: "Lavington",
    name: "Lavington",
    title: "Homes & Apartments for Sale in Lavington | Chestone Properties",
    metaDescription:
      "Verified townhouses, villas, and apartments for sale in Lavington, Nairobi — a mixed-typology executive market with transparent pricing and direct WhatsApp advisory.",
    heading: "Townhouses, Villas & Apartments in Lavington",
    intro: [
      "Lavington is best treated as a portfolio of micro-markets rather than one product — apartments, townhouses, villas, and established low-density homes each serve different buyers. It suits executives, families, and furnished-tenant demand close to top schools and retail hubs.",
      "Because Lavington spans several property types, every Chestone listing here specifies bedroom count, internal area, service charge, utilities, and route-tested school and workplace times, alongside an asking-versus-achievable price view.",
    ],
    fitFor: ["Executives and families", "Furnished-tenant demand", "Townhouse and villa buyers"],
    diligence: ["Apartment vs. home distinction", "Service charge and utilities", "Building age", "School and workplace commute times"],
    lat: -1.2769,
    lng: 36.7719,
  },
  {
    slug: "karen",
    areaParam: "Karen",
    name: "Karen",
    title: "Villas & Homes for Sale in Karen, Nairobi | Chestone Properties",
    metaDescription:
      "Verified villas, compounds, and detached homes for sale in Karen, Nairobi — space, privacy, and school access, with transparent pricing and direct WhatsApp advisory.",
    heading: "Villas & Detached Homes in Karen",
    intro: [
      "Karen is a space-led, detached and gated-estate lifestyle market, where usable space, privacy, gardens, staff quarters, and school access are the central purchase criteria rather than proximity alone.",
      "Vehicle dependence and maintenance costs are worth planning for explicitly here — we set those out on each listing rather than leaving them implied.",
    ],
    fitFor: ["School-led families", "Privacy-seeking owner-occupiers", "Furnished-compound and lifestyle buyers"],
    diligence: ["Plot and internal area", "Staff quarters and maintenance", "School route", "Water, security, and drainage exposure"],
    lat: -1.3192,
    lng: 36.7076,
  },
  {
    slug: "riverside",
    areaParam: "Riverside",
    name: "Riverside",
    title: "Apartments for Sale on Riverside Drive, Nairobi | Chestone Properties",
    metaDescription:
      "Verified apartments near Riverside Drive, Nairobi — a diplomatic and executive corridor with transparent pricing and direct WhatsApp advisory.",
    heading: "Apartments Near Riverside Drive",
    intro: [
      "Riverside is a premium, address-led corridor with diplomatic residences, multinationals, and NGOs nearby, appealing to buyers who prioritise privacy and controlled access.",
      "Flood and drainage awareness matters here given proximity to the Nairobi River — we note elevation and drainage status on each listing where it's been checked.",
    ],
    fitFor: ["Diplomats and international-organisation staff", "Senior executives", "Prestige owner-occupiers"],
    diligence: ["Title and utilities", "Flood and drainage exposure", "Traffic and access control", "Parking"],
    lat: -1.2687,
    lng: 36.8098,
  },
  {
    slug: "runda",
    areaParam: "Runda",
    name: "Runda",
    title: "Villas & Homes for Sale in Runda, Nairobi | Chestone Properties",
    metaDescription:
      "Verified villas and gated-estate homes for sale in Runda, Nairobi — spacious, low-density living with transparent pricing and direct WhatsApp advisory.",
    heading: "Villas & Gated Estate Homes in Runda",
    intro: [
      "Runda is a low-density, gated-estate residential area favoured for its space, greenery, and privacy, suiting buyers who want a suburban feel with larger plots than the more central corridors offer.",
      "As with our other listings, plot size, security arrangements, and estate management terms are confirmed before publishing.",
    ],
    fitFor: ["Families wanting larger plots", "Privacy-focused owner-occupiers", "Buyers comparing Karen vs. Runda for space and access trade-offs"],
    diligence: ["Plot size and boundaries", "Estate management and service charge", "Security arrangements", "Access road condition"],
    lat: -1.2172,
    lng: 36.8267,
  },
];

export function getNeighborhood(slug: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.slug === slug);
}
