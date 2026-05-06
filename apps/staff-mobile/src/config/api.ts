const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (envApiUrl || 'https://vanikicrop.com/api').replace(/\/+$/, '');
