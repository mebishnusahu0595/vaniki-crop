import { v2 as cloudinary } from 'cloudinary';

/**
 * Configures the Cloudinary SDK with environment credentials.
 * Must be called once at server startup.
 * @returns {void}
 */
export function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export { cloudinary };
