import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { storefrontApi } from '../lib/api';
import { INDIAN_STATES, STATE_DISTRICTS } from '@vaniki/shared';

const VISITOR_ID_KEY = 'vaniki_visitor_uuid_v1';
const CACHED_LOCATION_KEY = 'vaniki_cached_user_location';

/**
 * Get or create a persistent unique visitor ID for this device
 */
export async function getOrCreateVisitorId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const generated =
      'v_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).substring(2, 10);
    await AsyncStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return 'v_fallback_' + Date.now();
  }
}

export interface TelemetryLocationResult {
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  location?: {
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
    formattedAddress?: string;
  };
}

/**
 * Normalizes state name to match official INDIAN_STATES list
 */
export function normalizeStateName(rawState?: string): string {
  if (!rawState) return '';
  const cleaned = rawState.trim().toLowerCase();
  const match = INDIAN_STATES.find(
    (s) => s.toLowerCase() === cleaned || s.toLowerCase().includes(cleaned) || cleaned.includes(s.toLowerCase())
  );
  return match || rawState;
}

/**
 * Normalizes district name to match official STATE_DISTRICTS list
 */
export function normalizeDistrictName(rawDistrict?: string, stateName?: string): string {
  if (!rawDistrict) return '';
  const cleaned = rawDistrict.trim().toLowerCase();
  const normalizedState = normalizeStateName(stateName);
  const districtList = (STATE_DISTRICTS as Record<string, string[]>)[normalizedState] || [];
  const match = districtList.find(
    (d) => d.toLowerCase() === cleaned || d.toLowerCase().includes(cleaned) || cleaned.includes(d.toLowerCase())
  );
  return match || rawDistrict;
}

/**
 * Requests location permission (1 time prompt), retrieves GPS coordinates,
 * reverse geocodes the address, caches it, and sends telemetry to SuperAdmin!
 */
export async function requestLocationAndTrack(options: {
  promptPermission?: boolean;
  userMobile?: string;
  userName?: string;
  url?: string;
} = {}): Promise<TelemetryLocationResult | null> {
  try {
    const visitorId = await getOrCreateVisitorId();
    let hasPermission = false;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        hasPermission = true;
      }
    } else {
      const permissionStatus = await Location.getForegroundPermissionsAsync();
      if (permissionStatus.granted) {
        hasPermission = true;
      } else if (options.promptPermission) {
        const req = await Location.requestForegroundPermissionsAsync();
        hasPermission = req.granted;
      }
    }

    if (!hasPermission) {
      // Send device telemetry without coordinates if permission not granted
      await storefrontApi.recordTelemetry({
        visitorId,
        device: {
          platform: Platform.OS,
          os: `${Platform.OS} ${Platform.Version || ''}`.trim(),
          browser: Platform.OS === 'web' ? (typeof navigator !== 'undefined' ? navigator.userAgent : 'Web') : 'Expo App',
          appVariant: Constants.expoConfig?.extra?.appVariant || 'mobile',
        },
        url: options.url || '/',
        userMobile: options.userMobile,
        userName: options.userName,
      });
      return null;
    }

    // Get live GPS position
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy || undefined,
    };

    let locDetails: TelemetryLocationResult['location'] = {};

    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (geocoded && geocoded.length > 0) {
        const first = geocoded[0];
        const rawState = first.region || (first as any).administrativeArea || '';
        const rawDistrict = first.district || first.subregion || first.city || '';
        const state = normalizeStateName(rawState);
        const district = normalizeDistrictName(rawDistrict, state);
        const pincode = first.postalCode || '';
        const formattedAddress = [
          first.streetNumber,
          first.street,
          first.name,
          first.subregion,
          district,
          state,
          pincode,
        ]
          .filter(Boolean)
          .join(', ');

        locDetails = {
          city: district || first.city || '',
          district: district,
          state: state,
          pincode: pincode,
          country: first.country || 'India',
          formattedAddress: formattedAddress,
        };
      }
    } catch {
      // Ignore geocoding errors, coordinates are still valid
    }

    const result: TelemetryLocationResult = {
      coordinates: coords,
      location: locDetails,
    };

    // Cache locally for instant auto-fill on signup & other screens
    await AsyncStorage.setItem(CACHED_LOCATION_KEY, JSON.stringify(result));

    // Send complete telemetry to SuperAdmin API
    await storefrontApi.recordTelemetry({
      visitorId,
      coordinates: coords,
      location: locDetails,
      device: {
        platform: Platform.OS,
        os: `${Platform.OS} ${Platform.Version || ''}`.trim(),
        browser: Platform.OS === 'web' ? (typeof navigator !== 'undefined' ? navigator.userAgent : 'Web') : 'Expo App',
        appVariant: Constants.expoConfig?.extra?.appVariant || 'mobile',
      },
      url: options.url || '/',
      userMobile: options.userMobile,
      userName: options.userName,
    });

    return result;
  } catch (error) {
    console.warn('Telemetry location tracking warning:', error);
    return null;
  }
}

/**
 * Retrieve cached location if already detected
 */
export async function getCachedUserLocation(): Promise<TelemetryLocationResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
