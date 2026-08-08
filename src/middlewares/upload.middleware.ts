// src/middlewares/upload.middleware.ts
import multer from 'multer';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB -- generous enough for a manually-shot property tour video

// Memory storage: files are forwarded straight to Cloudinary as a buffer
// (see cloudinary.service.ts), never written to local disk.
export const uploadPropertyMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, callback) => {
    if (![...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).single('file');

export const resourceTypeForMimetype = (mimetype: string): 'image' | 'video' | null => {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return 'video';
  return null;
};
