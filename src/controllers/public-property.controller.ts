// src/controllers/public-property.controller.ts
//
// Unauthenticated, public-facing property listings for the customer
// website (chestoneproperties.com) -- a separate frontend from the CRM,
// with no login. Deliberately NOT reusing property.controller.ts's
// listProperties/getProperty: those return every column (including
// assignedAgentId, createdBy, developer contact info) to an authenticated
// CRM user under RLS; a public visitor gets neither RLS (there's no
// user/role to scope by) nor the internal fields -- both are hard-coded
// here via an explicit `select`, not an authorization check, so there's
// no way for a future edit to accidentally widen what an anonymous
// visitor can see.
//
// Scoped to Chestone's public-facing focus areas only, regardless of what
// else exists in the properties table -- matches the client's explicit
// positioning, not just "whatever's in the CRM right now."
import { Request, Response } from 'express';
import { withSystemContext } from '../config/database';
import { Prisma } from '../../generated/prisma';

export const PUBLIC_FOCUS_AREAS = ['Kilimani', 'Kileleshwa', 'Westlands', 'Lavington', 'Karen', 'Riverside'] as const;
export const PUBLIC_UNIT_TYPES = ['Apartment', 'Villa', 'Townhouse'] as const;

// Fixed bands rather than arbitrary user-supplied min/max -- keeps the
// filter UI a simple set of buttons (no numeric inputs) and the query
// bounded to values that actually make sense for this inventory.
export const PUBLIC_PRICE_BANDS = {
  'under-20m': { min: 0, max: 20_000_000 },
  '20m-40m': { min: 20_000_000, max: 40_000_000 },
  '40m-60m': { min: 40_000_000, max: 60_000_000 },
  '60m-plus': { min: 60_000_000, max: null },
} as const;
export type PublicPriceBand = keyof typeof PUBLIC_PRICE_BANDS;

export const PUBLIC_SIZE_BANDS = {
  'under-50': { min: 0, max: 50 },
  '50-100': { min: 50, max: 100 },
  '100-200': { min: 100, max: 200 },
  '200-plus': { min: 200, max: null },
} as const;
export type PublicSizeBand = keyof typeof PUBLIC_SIZE_BANDS;

const PUBLIC_PROPERTY_SELECT = {
  id: true,
  referenceId: true,
  title: true,
  description: true,
  location: true,
  subLocation: true,
  price: true,
  priceMin: true,
  priceMax: true,
  currency: true,
  status: true,
  unitType: true,
  totalUnits: true,
  levelFloors: true,
  view: true,
  completionTime: true,
  paymentPlanStructure: true,
  houseSizeSqft: true,
  houseSizeSqftMin: true,
  houseSizeSqftMax: true,
  developmentName: true,
  amenities: true,
  images: true,
  videos: true,
  createdAt: true,
} satisfies Prisma.PropertySelect;

// Never shown publicly: sold. 'available' and 'reserved' are both
// marketing-relevant (a reserved unit still signals real demand).
const PUBLIC_STATUSES = ['available', 'reserved'] as const;

/**
 * A property's "effective" price for filtering/sorting: its flat `price`
 * if set (>0), otherwise the bottom of its priceMin/priceMax range. Some
 * properties (see the seed data) use price=0 with a range instead of a
 * single figure, so neither column alone is a reliable sort/filter key.
 */
const effectivePrice = (p: { price: Prisma.Decimal; priceMin: Prisma.Decimal | null; priceMax: Prisma.Decimal | null }): number => {
  const price = Number(p.price);
  if (price > 0) return price;
  if (p.priceMin) return Number(p.priceMin);
  if (p.priceMax) return Number(p.priceMax);
  return 0;
};

const priceBandFilter = (band: PublicPriceBand): Prisma.PropertyWhereInput => {
  const { min, max } = PUBLIC_PRICE_BANDS[band];

  const flatPriceInBand: Prisma.PropertyWhereInput = {
    price: { gt: 0, gte: min, ...(max !== null ? { lte: max } : {}) },
  };

  // A ranged property (price=0, priceMin/priceMax instead) overlaps the
  // band if its low end isn't above the band's top, and its high end
  // isn't below the band's bottom. Each condition is skipped when the
  // corresponding side of the band is unbounded (min=0 / max=null), and
  // an unset priceMin/priceMax is treated as unbounded on that side too.
  const rangeConditions: Prisma.PropertyWhereInput[] = [];
  if (max !== null) {
    rangeConditions.push({ OR: [{ priceMin: null }, { priceMin: { lte: max } }] });
  }
  if (min > 0) {
    rangeConditions.push({ OR: [{ priceMax: null }, { priceMax: { gte: min } }] });
  }
  const rangedPriceInBand: Prisma.PropertyWhereInput = { price: 0, AND: rangeConditions };

  return { OR: [flatPriceInBand, rangedPriceInBand] };
};

// Same overlap logic as priceBandFilter above, but for house_size_sqft --
// a property with no size data at all never matches any band (there's no
// "flat" fallback like price=0 to distinguish "unset" from "ranged").
const sizeBandFilter = (band: PublicSizeBand): Prisma.PropertyWhereInput => {
  const { min, max } = PUBLIC_SIZE_BANDS[band];

  const flatSizeInBand: Prisma.PropertyWhereInput = {
    houseSizeSqft: { gt: 0, gte: min, ...(max !== null ? { lte: max } : {}) },
  };

  const rangeConditions: Prisma.PropertyWhereInput[] = [];
  if (max !== null) {
    rangeConditions.push({ OR: [{ houseSizeSqftMin: null }, { houseSizeSqftMin: { lte: max } }] });
  }
  if (min > 0) {
    rangeConditions.push({ OR: [{ houseSizeSqftMax: null }, { houseSizeSqftMax: { gte: min } }] });
  }
  const rangedSizeInBand: Prisma.PropertyWhereInput = {
    houseSizeSqft: null,
    OR: [{ houseSizeSqftMin: { not: null } }, { houseSizeSqftMax: { not: null } }],
    AND: rangeConditions,
  };

  return { OR: [flatSizeInBand, rangedSizeInBand] };
};

interface PublicListingQuery {
  area?: string;
  type?: string;
  price?: string;
  size?: string;
  development?: string;
  sort?: string;
}

const buildWhere = (query: PublicListingQuery): Prisma.PropertyWhereInput => {
  const areas = query.area
    ? PUBLIC_FOCUS_AREAS.filter((a) => a.toLowerCase() === query.area!.toLowerCase())
    : PUBLIC_FOCUS_AREAS;

  const where: Prisma.PropertyWhereInput = {
    status: { in: [...PUBLIC_STATUSES] },
    AND: [{ OR: areas.map((area) => ({ location: { contains: area, mode: 'insensitive' } })) }],
  };

  const type = PUBLIC_UNIT_TYPES.find((t) => t.toLowerCase() === query.type?.toLowerCase());
  if (type) {
    (where.AND as Prisma.PropertyWhereInput[]).push({ unitType: { equals: type, mode: 'insensitive' } });
  }

  const band = query.price && query.price in PUBLIC_PRICE_BANDS ? (query.price as PublicPriceBand) : undefined;
  if (band) {
    (where.AND as Prisma.PropertyWhereInput[]).push(priceBandFilter(band));
  }

  const sizeBand = query.size && query.size in PUBLIC_SIZE_BANDS ? (query.size as PublicSizeBand) : undefined;
  if (sizeBand) {
    (where.AND as Prisma.PropertyWhereInput[]).push(sizeBandFilter(sizeBand));
  }

  if (query.development) {
    (where.AND as Prisma.PropertyWhereInput[]).push({ developmentName: { equals: query.development, mode: 'insensitive' } });
  }

  return where;
};

export const listPublicProperties = async (req: Request, res: Response): Promise<void> => {
  const query: PublicListingQuery = {
    area: typeof req.query.area === 'string' ? req.query.area : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : undefined,
    price: typeof req.query.price === 'string' ? req.query.price : undefined,
    size: typeof req.query.size === 'string' ? req.query.size : undefined,
    development: typeof req.query.development === 'string' ? req.query.development : undefined,
    sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
  };

  let properties = await withSystemContext((tx) =>
    tx.property.findMany({
      where: buildWhere(query),
      select: PUBLIC_PROPERTY_SELECT,
      orderBy: { createdAt: 'desc' },
    }),
  );

  // Sorted in application code, not the DB query: "effective price" isn't
  // a single column (see effectivePrice above), and this dataset is small
  // enough that sorting after fetch is simpler and just as correct as
  // fighting Prisma's query builder for a computed ORDER BY.
  if (query.sort === 'price-asc') {
    properties = [...properties].sort((a, b) => effectivePrice(a) - effectivePrice(b));
  } else if (query.sort === 'price-desc') {
    properties = [...properties].sort((a, b) => effectivePrice(b) - effectivePrice(a));
  }

  res.status(200).json(properties);
};

export const getPublicProperty = async (req: Request, res: Response): Promise<void> => {
  const property = await withSystemContext((tx) =>
    tx.property.findFirst({
      where: {
        id: req.params.id,
        status: { in: [...PUBLIC_STATUSES] },
        OR: PUBLIC_FOCUS_AREAS.map((area) => ({ location: { contains: area, mode: 'insensitive' } })),
      },
      select: PUBLIC_PROPERTY_SELECT,
    }),
  );

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  res.status(200).json(property);
};
