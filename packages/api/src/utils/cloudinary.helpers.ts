import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudinary } from '../config/cloudinary.js';
import { AppError } from './AppError.js';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

const LOCAL_PUBLIC_ID_PREFIX = 'local:';
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const localUploadDirectory = resolve(currentDirectory, '../../../../uploads');

function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET,
  );
}

function normalizeExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  if (normalized === '.jpeg' || normalized === '.jpg') return '.jpg';
  if (normalized === '.png') return '.png';
  if (normalized === '.webp') return '.webp';
  return '.webp';
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const [mime] = contentType.split(';').map((entry) => entry.trim().toLowerCase());

  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return null;
}

function extensionFromImageUrl(imageUrl: string): string {
  try {
    const pathname = new URL(imageUrl).pathname;
    return normalizeExtension(extname(pathname));
  } catch {
    return '.webp';
  }
}

function buildPublicImageBaseUrl(): string {
  const explicit = process.env.BACKEND_URL
    || process.env.API_PUBLIC_URL
    || process.env.SERVER_URL;

  if (explicit) {
    return explicit.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://vanikicrop.com';
  }

  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

function localPathFromPublicId(publicId: string): string | null {
  if (!publicId.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
    return null;
  }

  const filename = publicId.slice(LOCAL_PUBLIC_ID_PREFIX.length);
  if (!filename) {
    return null;
  }

  return resolve(localUploadDirectory, filename);
}

async function saveBufferToLocalUploads(buffer: Buffer, extension = '.webp'): Promise<CloudinaryUploadResult> {
  await fs.mkdir(localUploadDirectory, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}${normalizeExtension(extension)}`;
  const targetPath = resolve(localUploadDirectory, filename);
  await fs.writeFile(targetPath, buffer);

  return {
    url: `${buildPublicImageBaseUrl()}/uploads/${filename}`,
    publicId: `${LOCAL_PUBLIC_ID_PREFIX}${filename}`,
  };
}

function assertCloudinaryConfigured(): void {
  if (!isCloudinaryConfigured()) {
    throw new AppError('Image service is not configured on server. Please contact support.', 503);
  }

}

/**
 * Uploads a file buffer to Cloudinary with WebP auto-format.
 *
 * @param buffer - The file buffer (from multer memoryStorage)
 * @param folder - Cloudinary folder path (e.g. 'vaniki/products')
 * @returns Object with secure URL and public ID
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    return saveBufferToLocalUploads(buffer, '.webp');
  }

  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          format: 'webp',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          resource_type: 'image',
        },
        (error: any, result: any) => {
          if (error || !result) {
            return reject(new AppError('Image upload failed', 500));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );
      uploadStream.end(buffer);
    } catch {
      reject(new AppError('Image service is not configured on server. Please contact support.', 503));
    }
  });
}

/**
 * Uploads an image to Cloudinary directly from a remote URL.
 *
 * @param imageUrl - Publicly accessible image URL
 * @param folder - Cloudinary folder path (e.g. 'vaniki/products')
 */
export async function uploadImageUrlToCloudinary(
  imageUrl: string,
  folder: string,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new AppError('Image URL upload failed', 400);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = extensionFromContentType(response.headers.get('content-type'))
        || extensionFromImageUrl(imageUrl);

      return saveBufferToLocalUploads(buffer, extension);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Image URL upload failed', 400);
    }
  }

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder,
      format: 'webp',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      resource_type: 'image',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch {
    throw new AppError('Image URL upload failed', 400);
  }
}

/**
 * Deletes an image from Cloudinary by its public ID.
 *
 * @param publicId - The Cloudinary public ID of the image
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const localPath = localPathFromPublicId(publicId);
  if (localPath) {
    await fs.unlink(localPath).catch(() => undefined);
    return;
  }

  if (!isCloudinaryConfigured()) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, error);
  }
}

/**
 * Uploads multiple file buffers to Cloudinary in parallel.
 *
 * @param files - Array of multer file objects
 * @param folder - Cloudinary folder path
 * @param maxFiles - Maximum number of files allowed
 * @returns Array of upload results
 */
export async function uploadMultipleToCloudinary(
  files: Express.Multer.File[],
  folder: string,
  maxFiles = 5,
): Promise<CloudinaryUploadResult[]> {
  if (files.length > maxFiles) {
    throw new AppError(`Maximum ${maxFiles} images allowed`, 400);
  }

  return Promise.all(files.map((file) => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Uploads a banner image and returns both desktop and mobile optimized URLs.
 * Desktop: 1920x600, Mobile: 768x400
 *
 * @param buffer - File buffer
 * @returns Object with desktop and mobile URLs
 */
export async function uploadBannerToCloudinary(
  buffer: Buffer,
): Promise<CloudinaryUploadResult & { mobileUrl: string }> {
  if (!isCloudinaryConfigured()) {
    const localUpload = await saveBufferToLocalUploads(buffer, '.webp');
    return {
      ...localUpload,
      mobileUrl: localUpload.url,
    };
  }

  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'vaniki/banners',
          format: 'webp',
          resource_type: 'image',
          transformation: [
            { width: 1920, height: 600, crop: 'fill', gravity: 'center', quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error: any, result: any) => {
          if (error || !result) {
            return reject(new AppError('Banner upload failed', 500));
          }

          // Generate mobile version URL using the same publicId
          const mobileUrl = cloudinary.url(result.public_id, {
            width: 768,
            height: 400,
            crop: 'fill',
            gravity: 'center',
            quality: 'auto',
            fetch_format: 'auto',
            secure: true
          });

          resolve({
            url: result.secure_url, // This is the 1920x600 version
            mobileUrl,
            publicId: result.public_id,
          });
        },
      );
      uploadStream.end(buffer);
    } catch {
      reject(new AppError('Image service is not configured on server. Please contact support.', 503));
    }
  });
}

/**
 * Uploads a banner image from URL and returns desktop + mobile optimized URLs.
 *
 * @param imageUrl - Publicly accessible image URL
 */
export async function uploadBannerUrlToCloudinary(
  imageUrl: string,
): Promise<CloudinaryUploadResult & { mobileUrl: string }> {
  if (!isCloudinaryConfigured()) {
    const localUpload = await uploadImageUrlToCloudinary(imageUrl, 'vaniki/banners');
    return {
      ...localUpload,
      mobileUrl: localUpload.url,
    };
  }

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'vaniki/banners',
      format: 'webp',
      resource_type: 'image',
      transformation: [
        { width: 1920, height: 600, crop: 'fill', gravity: 'center', quality: 'auto', fetch_format: 'auto' },
      ],
    });

    const mobileUrl = cloudinary.url(result.public_id, {
      width: 768,
      height: 400,
      crop: 'fill',
      gravity: 'center',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true,
    });

    return {
      url: result.secure_url,
      mobileUrl,
      publicId: result.public_id,
    };
  } catch {
    throw new AppError('Banner image URL upload failed', 400);
  }
}
