import { Platform } from 'react-native';
import Constants from 'expo-constants';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const productionApiUrl = 'https://vanikicrop.com/api';

function getDevApiUrl(): string {
  if (envApiUrl) return envApiUrl;

  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    return `${origin}/api-proxy`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8081/api-proxy`;
    }
  }

  return 'http://localhost:8081/api-proxy';
}

const resolvedApiUrl = (__DEV__ ? getDevApiUrl() : (envApiUrl || productionApiUrl)).replace(/\/+$/, '');

if (__DEV__) {
  console.log('🔗 Dealers Play API Base URL:', resolvedApiUrl);
}

export const API_BASE_URL = resolvedApiUrl;
