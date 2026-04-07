import { cloudinary } from '../config/cloudinary.js';
import { AppError } from './AppError.js';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
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
  return new Promise((resolve, reject) => {
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
  return new Promise((resolve, reject) => {
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
