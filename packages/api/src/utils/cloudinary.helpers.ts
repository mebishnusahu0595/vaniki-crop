import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './AppError.js';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export const LOCAL_PUBLIC_ID_PREFIX = 'local:';
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const localUploadDirectory = process.env.UPLOADS_DIR?.trim()
  ? resolve(process.env.UPLOADS_DIR.trim())
  : resolve(currentDirectory, '../../../../uploads');

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

function extensionFromBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return '.png';
  }

  if (
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) {
    return '.webp';
  }

  return '.webp';
}

function normalizeFolder(folder: string): string {
  return folder
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
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

export function localPathFromPublicId(publicId: string): string | null {
  if (!publicId.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
    return null;
  }

  const relativePath = publicId.slice(LOCAL_PUBLIC_ID_PREFIX.length).replace(/^\/+/, '');
  if (!relativePath) {
    return null;
  }

  const absolutePath = resolve(localUploadDirectory, relativePath);
  if (!absolutePath.startsWith(localUploadDirectory)) {
    return null;
  }

  return absolutePath;
}

async function saveBufferToLocalUploads(
  buffer: Buffer,
  folder: string,
  extension?: string,
): Promise<CloudinaryUploadResult> {
  const safeFolder = normalizeFolder(folder);
  const targetDirectory = safeFolder
    ? resolve(localUploadDirectory, safeFolder)
    : localUploadDirectory;

  if (!targetDirectory.startsWith(localUploadDirectory)) {
    throw new AppError('Invalid upload folder path', 400);
  }

  await fs.mkdir(targetDirectory, { recursive: true });

  const nextExtension = normalizeExtension(extension || extensionFromBuffer(buffer));
  const filename = `${Date.now()}-${randomUUID()}${nextExtension}`;
  const targetPath = resolve(targetDirectory, filename);

  try {
    await fs.writeFile(targetPath, buffer);
  } catch {
    throw new AppError('Unable to save image on server storage. Check uploads directory permissions.', 500);
  }

  const relativePath = safeFolder ? `${safeFolder}/${filename}` : filename;
  const encodedRelativePath = relativePath.split('/').map((entry) => encodeURIComponent(entry)).join('/');

  return {
    url: `${buildPublicImageBaseUrl()}/uploads/${encodedRelativePath}`,
    publicId: `${LOCAL_PUBLIC_ID_PREFIX}${relativePath}`,
  };
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
  return saveBufferToLocalUploads(buffer, folder);
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
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError('Image URL upload failed', 400);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFromContentType(response.headers.get('content-type'))
      || extensionFromImageUrl(imageUrl)
      || extensionFromBuffer(buffer);

    return saveBufferToLocalUploads(buffer, folder, extension);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
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
  if (!localPath) {
    return;
  }

  await fs.unlink(localPath).catch(() => undefined);
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
  const localUpload = await saveBufferToLocalUploads(buffer, 'vaniki/banners');
  return {
    ...localUpload,
    mobileUrl: localUpload.url,
  };
}

/**
 * Uploads a banner image from URL and returns desktop + mobile optimized URLs.
 *
 * @param imageUrl - Publicly accessible image URL
 */
export async function uploadBannerUrlToCloudinary(
  imageUrl: string,
): Promise<CloudinaryUploadResult & { mobileUrl: string }> {
  const localUpload = await uploadImageUrlToCloudinary(imageUrl, 'vaniki/banners');
  return {
    ...localUpload,
    mobileUrl: localUpload.url,
  };
}
