export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'jpg' | 'png' | 'avif';
  crop?: 'fill' | 'fit' | 'limit';
  blur?: number;
}

const CLOUDINARY_SEGMENT = '/upload/';

export const isCloudinaryUrl = (url?: string): boolean => {
  return Boolean(url && url.includes('res.cloudinary.com') && url.includes(CLOUDINARY_SEGMENT));
};

export const withCloudinaryTransforms = (
  url: string,
  {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
    blur,
  }: CloudinaryTransformOptions = {},
): string => {
  if (!isCloudinaryUrl(url)) return url;

  const [prefix, suffix] = url.split(CLOUDINARY_SEGMENT);
  if (!prefix || !suffix) return url;

  const transforms = [
    format ? `f_${format}` : null,
    quality ? `q_${quality}` : null,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    width || height ? `c_${crop}` : null,
    blur ? `e_blur:${blur}` : null,
  ].filter(Boolean);

  return `${prefix}${CLOUDINARY_SEGMENT}${transforms.join(',')}/${suffix}`;
};

export const getCloudinaryPlaceholderUrl = (url: string): string => {
  return withCloudinaryTransforms(url, {
    width: 20,
    height: 20,
    quality: 30,
    blur: 1000,
    crop: 'fill',
  });
};
