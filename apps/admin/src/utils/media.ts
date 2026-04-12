import { API_BASE_URL } from '../config/api';

const LOCAL_PUBLIC_ID_PREFIX = 'local:';

function getApiPathPrefix(): string {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    try {
      const path = new URL(API_BASE_URL).pathname.replace(/\/+$/, '');
      return path || '/api';
    } catch {
      return '/api';
    }
  }

  const trimmed = API_BASE_URL.trim();
  if (!trimmed) return '/api';

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '') || '/api';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function encodePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

function normalizeRelativePath(value: string): string {
  const cleaned = value.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const withLeadingSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;

  if (withLeadingSlash.startsWith('/api/uploads/')) {
    return withLeadingSlash.replace(/^\/api/, '');
  }

  return withLeadingSlash;
}

function decodePathSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
}

function getLocalPublicIdFromUrl(rawUrl?: string): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const fromUrl = (value: URL): string => {
    const queryPublicId = value.searchParams.get('publicId') || value.searchParams.get('public_id');
    if (queryPublicId?.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
      return queryPublicId;
    }

    const normalizedPath = normalizeRelativePath(value.pathname);
    if (!normalizedPath.startsWith('/uploads/')) return '';

    const relativePath = decodePathSegments(normalizedPath.replace(/^\/uploads\//, ''));
    return relativePath ? `${LOCAL_PUBLIC_ID_PREFIX}${relativePath}` : '';
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return fromUrl(new URL(trimmed));
    } catch {
      return '';
    }
  }

  const queryMatch = trimmed.match(/[?&](publicId|public_id)=([^&#]+)/i);
  if (queryMatch?.[2]) {
    try {
      const decoded = decodeURIComponent(queryMatch[2]);
      if (decoded.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
        return decoded;
      }
    } catch {
      // Ignore malformed query encoding and continue with path parsing.
    }
  }

  const pathOnly = normalizeRelativePath(trimmed.split(/[?#]/, 1)[0] || '');
  if (!pathOnly.startsWith('/uploads/')) return '';

  const relativePath = decodePathSegments(pathOnly.replace(/^\/uploads\//, ''));
  return relativePath ? `${LOCAL_PUBLIC_ID_PREFIX}${relativePath}` : '';
}

function buildMediaProxyUrl(publicId?: string): string {
  if (!publicId?.startsWith(LOCAL_PUBLIC_ID_PREFIX)) {
    return '';
  }

  return `${getApiPathPrefix()}/media?publicId=${encodeURIComponent(publicId)}`;
}

function resolveRelativePath(value: string): string {
  return normalizeRelativePath(value);
}

export function resolveMediaUrl(rawUrl?: string, publicId?: string): string {
  const normalizedPublicId = publicId || getLocalPublicIdFromUrl(rawUrl);
  const proxyUrl = buildMediaProxyUrl(normalizedPublicId);
  if (proxyUrl) return proxyUrl;

  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = encodePathname(parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/'));

      const pathWithSuffix = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const normalizedPath = normalizeRelativePath(parsed.pathname);
      const isLocalUploadPath = normalizedPath.startsWith('/uploads/') || normalizedPath.startsWith('/api/uploads/');
      const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      if (isLocalUploadPath || isLocalHost) {
        return resolveRelativePath(pathWithSuffix);
      }

      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  return resolveRelativePath(trimmed);
}
