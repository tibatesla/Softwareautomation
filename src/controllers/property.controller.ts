// src/controllers/property.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext, AppRole } from '../config/database';
import { Prisma, Property } from '../../generated/prisma';
import { createPropertySchema, updatePropertySchema, bulkDeleteSchema } from '../schemas/property.schema';
import { uploadMediaBuffer, deletePropertyMedia, publicIdFromUrl } from '../services/cloudinary.service';
import { resourceTypeForMimetype } from '../middlewares/upload.middleware';
import { publishListingGroup } from '../services/social-publishing.service';
import { ListingForPost } from '../services/development-post.service';

/**
 * `outstandingAmenities` is only meaningful as a subset of `amenities`.
 * Zod can't enforce that across a partial PATCH (one field may arrive
 * without the other), so this reconciles it whenever both are present in
 * the same request -- silently dropping any outstanding entry that isn't
 * also in the submitted amenities list, rather than rejecting the request.
 */
const reconcileOutstandingAmenities = <T extends { amenities?: string[]; outstandingAmenities?: string[] }>(data: T): T => {
  if (!data.amenities || !data.outstandingAmenities) return data;
  const allowed = new Set(data.amenities);
  return { ...data, outstandingAmenities: data.outstandingAmenities.filter((a) => allowed.has(a)) };
};

const propertyToListing = (p: Property, imageUrlOverride?: string): ListingForPost => ({
  id: p.id,
  title: p.title,
  unitType: p.unitType,
  location: p.location,
  subLocation: p.subLocation,
  price: Number(p.price),
  priceMin: p.priceMin ? Number(p.priceMin) : null,
  priceMax: p.priceMax ? Number(p.priceMax) : null,
  currency: p.currency,
  houseSizeSqft: p.houseSizeSqft ? Number(p.houseSizeSqft) : null,
  houseSizeSqftMin: p.houseSizeSqftMin ? Number(p.houseSizeSqftMin) : null,
  houseSizeSqftMax: p.houseSizeSqftMax ? Number(p.houseSizeSqftMax) : null,
  amenities: p.amenities,
  outstandingAmenities: p.outstandingAmenities,
  imageUrl: imageUrlOverride ?? p.images[0] ?? null,
});

export const listProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const properties = await withRLSContext(id, role, (tx) =>
    tx.property.findMany({ orderBy: { createdAt: 'desc' } }),
  );
  res.status(200).json(properties);
};

export const getProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const property = await withRLSContext(id, role, (tx) =>
    tx.property.findUnique({ where: { id: req.params.id } }),
  );

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  res.status(200).json(property);
};

export const createProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createPropertySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed property payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  try {
    const data = reconcileOutstandingAmenities(parseResult.data);
    const property = await withRLSContext(id, role, (tx) =>
      tx.property.create({ data: { ...data, createdBy: id } }),
    );
    res.status(201).json(property);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Reference ID is already in use by another property.' });
      return;
    }
    throw error;
  }
};

/**
 * Blocked if any leads/bookings/payments still reference this property --
 * those all have NoAction (restrict) foreign keys, so the DELETE would fail
 * regardless; checking first lets us return a clear, itemized 409 instead
 * of a raw constraint-violation error.
 */
type DeletePropertyResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

/**
 * Shared by the single-item and bulk delete endpoints. Blocked if any
 * leads/bookings/payments still reference the property -- those all have
 * NoAction (restrict) foreign keys, so the DELETE would fail regardless;
 * checking first lets us return a clear, itemized reason instead of a raw
 * constraint-violation error.
 */
const deletePropertyCore = async (userId: string, role: AppRole, propertyId: string): Promise<DeletePropertyResult> => {
  try {
    const linked = await withRLSContext(userId, role, (tx) =>
      tx.property.findUnique({
        where: { id: propertyId },
        select: {
          images: true,
          videos: true,
          _count: { select: { leads: true, bookings: true, payments: true } },
        },
      }),
    );

    if (!linked) {
      return { ok: false, status: 404, error: 'Property not found' };
    }

    const linkedCounts = Object.entries(linked._count).filter(([, count]) => count > 0);
    if (linkedCounts.length > 0) {
      const summary = linkedCounts.map(([name, count]) => `${count} ${name}`).join(', ');
      return {
        ok: false,
        status: 409,
        error: `Can't delete -- this property has linked records (${summary}). Mark it as sold/unavailable instead to preserve that history.`,
      };
    }

    await withRLSContext(userId, role, (tx) => tx.property.delete({ where: { id: propertyId } }));

    for (const url of [...linked.images, ...linked.videos]) {
      const publicId = publicIdFromUrl(url);
      if (!publicId) continue;
      const resourceType = url.includes('/video/upload/') ? 'video' : 'image';
      deletePropertyMedia(publicId, resourceType).catch((error) =>
        console.error('[Property] Cloudinary cleanup failed for deleted property (DB already updated):', error),
      );
    }

    return { ok: true };
  } catch {
    return { ok: false, status: 404, error: 'Property not found' };
  }
};

export const deleteProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const result = await deletePropertyCore(id, role, req.params.id);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(204).send();
};

export const bulkDeleteProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = bulkDeleteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed request', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const results = await Promise.all(
    parseResult.data.ids.map(async (propertyId) => {
      const result = await deletePropertyCore(id, role, propertyId);
      return result.ok ? { id: propertyId, deleted: true as const } : { id: propertyId, deleted: false as const, error: result.error };
    }),
  );

  res.status(200).json({
    deleted: results.filter((r) => r.deleted).map((r) => r.id),
    failed: results.filter((r): r is { id: string; deleted: false; error: string } => !r.deleted),
  });
};

export const updateProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updatePropertySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed property payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const data = reconcileOutstandingAmenities(parseResult.data);
    const property = await withRLSContext(id, role, (tx) =>
      tx.property.update({ where: { id: req.params.id }, data }),
    );
    res.status(200).json(property);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Reference ID is already in use by another property.' });
      return;
    }
    res.status(404).json({ error: 'Property not found' });
  }
};

/**
 * Accepts one multipart file (see upload.middleware.ts for the multer
 * config), uploads it to Cloudinary, and appends the resulting URL to the
 * property's images or videos array (chosen from the file's mimetype, not
 * a client-supplied field, so a caller can't mislabel a video as an image
 * and vice versa).
 */
export const uploadPropertyMediaFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ error: 'No file provided (expected multipart field "file")' });
    return;
  }

  const resourceType = resourceTypeForMimetype(file.mimetype);
  if (!resourceType) {
    res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
    return;
  }

  const { id, role } = req.user!;
  const propertyId = req.params.id;

  try {
    const uploadResult = await uploadMediaBuffer(file.buffer, propertyId, resourceType);
    const field = resourceType === 'image' ? 'images' : 'videos';

    let shouldAutoPost = false;
    let siblingsToPost: Property[] = [];
    const property = await withRLSContext(id, role, async (tx) => {
      const existing = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      const updatedList = [...(existing as unknown as Record<string, string[]>)[field], uploadResult.url];
      // Auto-post fires once, the moment a property gets its first photo --
      // whether it actually succeeds determines socialPostedAt further
      // below, once the real publish attempt returns. This gate condition
      // (existing.images.length === 0) can only be true once per property
      // regardless, so a failed attempt can't accidentally re-fire here --
      // it just leaves the property retryable via the CRM's manual
      // "Post to Social" button instead of wrongly marked done forever.
      shouldAutoPost = resourceType === 'image' && existing.images.length === 0 && !existing.socialPostedAt;

      const updated = await tx.property.update({
        where: { id: propertyId },
        data: { [field]: updatedList },
      });

      if (shouldAutoPost && existing.developmentName) {
        const siblings = await tx.property.findMany({ where: { developmentName: existing.developmentName } });
        siblingsToPost = siblings.map((s) => (s.id === propertyId ? updated : s));
      }

      return updated;
    });

    res.status(201).json(property);

    if (shouldAutoPost) {
      const toListing = (p: Property) => propertyToListing(p, p.id === propertyId ? uploadResult.url : undefined);
      const group = siblingsToPost.length > 0 ? siblingsToPost : [property];
      const listings = group.map(toListing);
      const developmentName = property.developmentName;

      publishListingGroup(listings, developmentName)
        .then(async (result) => {
          if (result.facebook === 'posted' || result.instagram === 'posted') {
            await withRLSContext(id, role, (tx) =>
              tx.property.updateMany({ where: { id: { in: group.map((p) => p.id) } }, data: { socialPostedAt: new Date() } }),
            );
          } else {
            console.error(
              `[Property Media] Auto-post fully failed for "${developmentName ?? propertyId}", leaving unposted so it can be retried:`,
              JSON.stringify(result),
            );
          }
        })
        .catch((error) => console.error('[Property Media] Auto-post to social failed:', error));
    }
  } catch (error) {
    console.error('[Property Media] Upload failed:', error);
    res.status(404).json({ error: 'Property not found, or upload failed' });
  }
};

/**
 * Manual, on-demand counterpart to the automatic first-photo trigger above
 * -- for the ~100 properties that already had photos before auto-posting
 * existed, nothing will ever fire for them on its own (the auto-post gate
 * requires zero existing images). This lets an owner/admin push one
 * property (or, if it has a developmentName, its whole development group)
 * to social at a moment of their own choosing, rather than a bulk backfill
 * blasting through Meta's rate limits the way an earlier attempt did.
 */
export const postPropertyToSocial = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const propertyId = req.params.id;
  const force = req.body?.force === true;

  try {
    let alreadyPostedAt: Date | null = null;
    let group: Property[] = [];
    let developmentName: string | null = null;

    await withRLSContext(id, role, async (tx) => {
      const target = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      developmentName = target.developmentName;
      group = developmentName ? await tx.property.findMany({ where: { developmentName } }) : [target];

      const posted = group.find((p) => p.socialPostedAt);
      if (posted && !force) {
        alreadyPostedAt = posted.socialPostedAt;
      }
    });

    if (alreadyPostedAt) {
      res.status(409).json({ error: 'Already posted to social media.', postedAt: alreadyPostedAt });
      return;
    }

    const listings = group.map((p) => propertyToListing(p));
    if (listings.every((l) => !l.imageUrl)) {
      res.status(400).json({ error: 'No photos available to post -- upload at least one photo first.' });
      return;
    }

    const result = await publishListingGroup(listings, developmentName);

    // Only mark as posted once it actually reached at least one platform --
    // marking it beforehand (the previous behavior) meant a full failure
    // (Meta rate limit, an unready Instagram container, an expired token)
    // still showed a permanent "Posted" badge in the CRM with no way to
    // retry, which is exactly the "says Posted but nothing appeared on
    // Facebook/Instagram" bug this fixes.
    if (result.facebook === 'posted' || result.instagram === 'posted') {
      const postedAt = new Date();
      await withRLSContext(id, role, (tx) =>
        tx.property.updateMany({ where: { id: { in: group.map((p) => p.id) } }, data: { socialPostedAt: postedAt } }),
      );
    } else {
      console.error(
        `[Property Media] Manual social post fully failed for "${developmentName ?? propertyId}", leaving unposted so it can be retried:`,
        JSON.stringify(result),
      );
    }

    res.status(200).json({ result, unitsIncluded: listings.length });
  } catch (error) {
    console.error('[Property Media] Manual social post failed:', error);
    res.status(404).json({ error: 'Property not found, or post failed' });
  }
};

/**
 * Removes a URL from the property's images/videos array and best-effort
 * deletes the underlying Cloudinary asset. The DB update is what matters
 * for correctness (the URL disappears from the listing either way); a
 * failed Cloudinary deletion just leaves an orphaned asset in storage,
 * logged rather than blocking the request.
 */
export const deletePropertyMediaFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const propertyId = req.params.id;
  const mediaUrl = typeof req.query.url === 'string' ? req.query.url : undefined;

  if (!mediaUrl) {
    res.status(400).json({ error: 'Missing required "url" query parameter' });
    return;
  }

  try {
    const property = await withRLSContext(id, role, async (tx) => {
      const existing = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      const images = existing.images.filter((u) => u !== mediaUrl);
      const videos = existing.videos.filter((u) => u !== mediaUrl);
      return tx.property.update({ where: { id: propertyId }, data: { images, videos } });
    });

    const publicId = publicIdFromUrl(mediaUrl);
    if (publicId) {
      const resourceType = mediaUrl.includes('/video/upload/') ? 'video' : 'image';
      deletePropertyMedia(publicId, resourceType).catch((error) =>
        console.error('[Property Media] Cloudinary deletion failed (DB already updated):', error),
      );
    }

    res.status(200).json(property);
  } catch {
    res.status(404).json({ error: 'Property not found' });
  }
};
