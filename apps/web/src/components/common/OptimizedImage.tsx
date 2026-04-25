import React, { forwardRef, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { getCloudinaryPlaceholderUrl, isCloudinaryUrl, withCloudinaryTransforms } from '../../utils/cloudinary';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  containerClassName?: string;
  widthHint?: number;
  heightHint?: number;
}

const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  (
    {
      src,
      alt,
      className,
      containerClassName,
      widthHint,
      heightHint,
      loading = 'lazy',
      onLoad,
      ...props
    },
    ref,
  ) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const optimizedSrc = useMemo(() => {
      if (!src) return undefined;
      if (hasError) return 'https://placehold.co/400x400?text=Vaniki+Crop';

      return withCloudinaryTransforms(src, {
        width: widthHint,
        height: heightHint,
        quality: 'auto',
        format: 'auto',
      });
    }, [heightHint, src, widthHint, hasError]);

    const placeholderSrc = useMemo(() => {
      if (!src || !isCloudinaryUrl(src) || hasError) return undefined;
      return getCloudinaryPlaceholderUrl(src);
    }, [src, hasError]);

    if (!optimizedSrc) return null;

    return (
      <span className={cn('relative block overflow-hidden', containerClassName)}>
        {placeholderSrc && (
          <img
            src={placeholderSrc}
            alt=""
            aria-hidden
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full scale-105 object-cover blur-xl transition-opacity duration-500',
              isLoaded ? 'opacity-0' : 'opacity-100',
            )}
          />
        )}
        <img
          {...props}
          ref={ref}
          src={optimizedSrc}
          alt={alt}
          loading={loading}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
          onError={() => {
            if (!hasError) {
              setHasError(true);
              setIsLoaded(true);
            }
          }}
          className={cn('relative z-10 transition-opacity duration-500', className, isLoaded ? 'opacity-100' : 'opacity-0')}
        />
      </span>
    );
  },
);

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
