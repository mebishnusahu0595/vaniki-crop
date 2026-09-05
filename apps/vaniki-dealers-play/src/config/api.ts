import { Platform } from 'react-native';
import Constants from 'expo-constants';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const productionApiUrl = 'https://vanikicrop.com/api';

function getDevApiUrl(): string {
  if (envApiUrl) return envApiUrl;
  return productionApiUrl;
}

const resolvedApiUrl = (envApiUrl || productionApiUrl).replace(/\/+$/, '');

if (__DEV__) {
  console.log('🔗 Dealers Play API Base URL:', resolvedApiUrl);
}

export const API_BASE_URL = resolvedApiUrl;
