// src/services/cloudinary.service.ts
//
// Cloudinary integration for manually-produced property photos/videos
// (CRM Handoff, Section 2: "Image and videos are where manually uploaded
// property photos and the property video live"). Files arrive as in-memory
// buffers via multer (see upload.middleware.ts), not local file paths, so
// this uses upload_stream + a Readable wrapping the buffer -- the standard
// pattern for streaming a buffer into Cloudinary's SDK.
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error('Missing critical CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET environment configuration.');
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

export type MediaResourceType = 'image' | 'video';

export interface UploadResult {
  url: string;
  publicId: string;
}

export const uploadMediaBuffer = (
  buffer: Buffer,
  propertyId: string,
  resourceType: MediaResourceType,
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `chestone/properties/${propertyId}`,
        resource_type: resourceType,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload returned no result.'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

export const deletePropertyMedia = async (publicId: string, resourceType: MediaResourceType): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

/**
 * Cloudinary's public_id (needed to delete an asset) isn't the same as the
 * URL stored on Property.images/videos -- it's embeddable in the URL path
 * (folder/filename, no extension). Derived here rather than stored
 * separately, since the DB only keeps the URL array per the CRM doc's
 * schema (images: string[], videos: string[]).
 */
export const publicIdFromUrl = (url: string): string | null => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
};
