import multer from 'multer';
import path from 'path';
import { ApiError } from './errorHandler.js';

const storage = multer.memoryStorage();

/**
 * Multer upload middleware configured for image uploads.
 * Accepts JPEG, PNG, and WebP formats up to 5MB.
 */
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are allowed') as any);
    }
  },
});
