import type { IStore, IStoreAddress } from '../models/Store.model.js';

const PLACEHOLDER_ADDRESS_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);
const DEFAULT_PINCODE = '000000';

export function normalizeStoreAddressValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isMeaningfulStoreAddressValue(value: unknown): boolean {
  const normalized = normalizeStoreAddressValue(value);
  return Boolean(normalized) && !PLACEHOLDER_ADDRESS_VALUES.has(normalized);
}

export function sanitizeStoreAddress(address?: Partial<IStoreAddress> | null): Partial<IStoreAddress> {
  if (!address) {
    return {};
  }

  const street = isMeaningfulStoreAddressValue(address.street) ? String(address.street).trim() : '';
  const city = isMeaningfulStoreAddressValue(address.city) ? String(address.city).trim() : '';
  const state = isMeaningfulStoreAddressValue(address.state) ? String(address.state).trim() : '';
  const rawPincode = typeof address.pincode === 'string' ? address.pincode.trim() : '';
  const pincode = /^\d{6}$/.test(rawPincode) && rawPincode !== DEFAULT_PINCODE ? rawPincode : '';

  return {
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(pincode ? { pincode } : {}),
  };
}

export function needsStoreAddressBackfill(address?: Partial<IStoreAddress> | null): boolean {
  if (!address) {
    return true;
  }

  const street = normalizeStoreAddressValue(address.street);
  const city = normalizeStoreAddressValue(address.city);
  const state = normalizeStoreAddressValue(address.state);
  const pincode = normalizeStoreAddressValue(address.pincode);

  return (
    !street
    || !city
    || !state
    || PLACEHOLDER_ADDRESS_VALUES.has(city)
    || PLACEHOLDER_ADDRESS_VALUES.has(state)
    || !pincode
    || pincode === DEFAULT_PINCODE
  );
}

export function hasMeaningfulPickupAddress(address?: Partial<IStoreAddress> | null): boolean {
  const sanitized = sanitizeStoreAddress(address);
  // Relaxed: only street is absolutely required for it to be visible.
  return Boolean(sanitized.street);
}

function pickFirstMeaningfulValue(...values: Array<unknown>): string {
  for (const value of values) {
    if (!isMeaningfulStoreAddressValue(value)) {
      continue;
    }

    return String(value).trim();
  }

  return '';
}

function normalizePincode(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const match = value.match(/\b\d{6}\b/);
  if (!match || match[0] === DEFAULT_PINCODE) {
    return '';
  }

  return match[0];
}

function buildStreetFromGeocode(address: Record<string, unknown>): string {
  return pickFirstMeaningfulValue(
    address.road,
    address.neighbourhood,
    address.suburb,
    address.residential,
    address.quarter,
    address.hamlet,
    address.village,
    address.town,
    address.city_district,
  );
}

export async function reverseGeocodeStoreCoordinates(
  latitude: number,
  longitude: number,
): Promise<Partial<IStoreAddress> | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VanikiCrop/1.0 (support@vanikicrop.com)',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    address?: Record<string, unknown>;
  };
  const address = payload.address || {};

  const street = buildStreetFromGeocode(address);
  const city = pickFirstMeaningfulValue(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
    address.city_district,
    address.state_district,
  );
  const state = pickFirstMeaningfulValue(address.state, address.region, address.province, address.state_district);
  const pincode = normalizePincode(address.postcode);

  return {
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(pincode ? { pincode } : {}),
  };
}

export async function buildStoreAddressFromCoordinates(params: {
  latitude: number;
  longitude: number;
  fallbackStreet?: string;
  existingAddress?: Partial<IStoreAddress> | null;
}): Promise<IStoreAddress> {
  const { latitude, longitude, fallbackStreet, existingAddress } = params;
  const currentAddress = sanitizeStoreAddress(existingAddress);

  let resolvedAddress: Partial<IStoreAddress> | null = null;
  try {
    resolvedAddress = await reverseGeocodeStoreCoordinates(latitude, longitude);
  } catch {
    resolvedAddress = null;
  }

  return {
    street: currentAddress.street || pickFirstMeaningfulValue(fallbackStreet, resolvedAddress?.street) || 'Address pending',
    city: currentAddress.city || pickFirstMeaningfulValue(resolvedAddress?.city) || 'Pending',
    state: currentAddress.state || pickFirstMeaningfulValue(resolvedAddress?.state) || 'Pending',
    pincode: currentAddress.pincode || normalizePincode(resolvedAddress?.pincode) || DEFAULT_PINCODE,
  };
}

export async function repairStoreAddressIfNeeded(store: IStore, fallbackStreet?: string): Promise<IStore> {
  if (!needsStoreAddressBackfill(store.address)) {
    return store;
  }

  const [longitude, latitude] = store.location?.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return store;
  }

  const nextAddress = await buildStoreAddressFromCoordinates({
    latitude,
    longitude,
    fallbackStreet,
    existingAddress: store.address,
  });

  const hasChanges = (
    store.address.street !== nextAddress.street
    || store.address.city !== nextAddress.city
    || store.address.state !== nextAddress.state
    || store.address.pincode !== nextAddress.pincode
  );

  if (!hasChanges) {
    return store;
  }

  store.address = nextAddress;
  await store.save();
  return store;
}
