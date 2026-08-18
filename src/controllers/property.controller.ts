// src/controllers/property.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';
import { Prisma } from '../../generated/prisma';
import { createPropertySchema, updatePropertySchema } from '../schemas/property.schema';
import { uploadMediaBuffer, deletePropertyMedia, publicIdFromUrl } from '../services/cloudinary.service';
import { resourceTypeForMimetype } from '../middlewares/upload.middleware';

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
    const property = await withRLSContext(id, role, (tx) =>
      tx.property.create({ data: { ...parseResult.data, createdBy: id } }),
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
export const deleteProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const propertyId = req.params.id;

  try {
    const linked = await withRLSContext(id, role, (tx) =>
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
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const linkedCounts = Object.entries(linked._count).filter(([, count]) => count > 0);
    if (linkedCounts.length > 0) {
      const summary = linkedCounts.map(([name, count]) => `${count} ${name}`).join(', ');
      res.status(409).json({
        error: `Can't delete -- this property has linked records (${summary}). Mark it as sold/unavailable instead to preserve that history.`,
      });
      return;
    }

    await withRLSContext(id, role, (tx) => tx.property.delete({ where: { id: propertyId } }));

    for (const url of [...linked.images, ...linked.videos]) {
      const publicId = publicIdFromUrl(url);
      if (!publicId) continue;
      const resourceType = url.includes('/video/upload/') ? 'video' : 'image';
      deletePropertyMedia(publicId, resourceType).catch((error) =>
        console.error('[Property] Cloudinary cleanup failed for deleted property (DB already updated):', error),
      );
    }

    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Property not found' });
  }
};

export const updateProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updatePropertySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed property payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const property = await withRLSContext(id, role, (tx) =>
      tx.property.update({ where: { id: req.params.id }, data: parseResult.data }),
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

    const property = await withRLSContext(id, role, async (tx) => {
      const existing = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      const updatedList = [...(existing as unknown as Record<string, string[]>)[field], uploadResult.url];
      return tx.property.update({ where: { id: propertyId }, data: { [field]: updatedList } });
    });

    res.status(201).json(property);
  } catch (error) {
    console.error('[Property Media] Upload failed:', error);
    res.status(404).json({ error: 'Property not found, or upload failed' });
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
