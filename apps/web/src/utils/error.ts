import axios from 'axios';

/**
 * Extracts a human-readable error message from an Axios error or returns a fallback.
 * Handles both { message: '...' } and { error: '...' } response shapes.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) return error.message;
    return fallback;
  }
  
  const payload = error.response?.data as { message?: string; error?: string; success?: boolean } | undefined;
  
  // If the backend sent a 'message' or 'error' string, use it.
  return payload?.message || payload?.error || error.message || fallback;
};
