import { API_BASE_URL } from '../config/api';

const LOCAL_PUBLIC_ID_PREFIX = 'local:';

function getApiOrigin(): string {
  if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
    return '';
  }

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
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

function getLocalPublicIdFromUrl(rawUrl?: string): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const pathCandidate = (() => {
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        return new URL(trimmed).pathname;
      } catch {
        return '';
      }
    }

    return trimmed.split(/[?#]/, 1)[0] || '';
  })();

  if (!pathCandidate) return '';

  const normalizedPath = normalizeRelativePath(pathCandidate);
  if (!normalizedPath.startsWith('/uploads/')) return '';

  const relativePath = normalizedPath.replace(/^\/uploads\//, '');
  if (!relativePath) return '';

  const decodedRelativePath = relativePath
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

  return `${LOCAL_PUBLIC_ID_PREFIX}${decodedRelativePath}`;
}

function buildMediaProxyUrl(publicId?: string): string {
  if (!publicId?.startsWith(LOCAL_PUBLIC_ID_PREFIX)) return '';

  return `${API_BASE_URL}/media?publicId=${encodeURIComponent(publicId)}`;
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

  const apiOrigin = getApiOrigin();

  const resolveRelative = (value: string): string => {
    const normalizedPath = normalizeRelativePath(value);
    if (apiOrigin) return `${apiOrigin}${normalizedPath}`;
    return normalizedPath;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = encodePathname(parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/'));

      const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (isLocalHost && apiOrigin) {
        return resolveRelative(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      }

      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  return resolveRelative(trimmed);
}
