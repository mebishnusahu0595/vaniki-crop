const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const productionApiUrl = 'https://vanikicrop.com/api';

export const API_BASE_URL = (envApiUrl || productionApiUrl).replace(/\/+$/, '');
