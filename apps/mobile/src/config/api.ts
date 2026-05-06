const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const localhostApiUrl = 'http://localhost:5000/api';
const isLocalWeb =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (
  envApiUrl ||
  (isLocalWeb ? localhostApiUrl : 'https://vanikicrop.com/api')
).replace(/\/+$/, '');
