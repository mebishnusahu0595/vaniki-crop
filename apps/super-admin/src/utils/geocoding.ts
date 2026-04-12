import type { Address } from '../types/admin';

const PLACEHOLDER_ADDRESS_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);

export interface ReverseGeocodedAddress extends Partial<Address> {
  displayLabel: string;
}

export function normalizeAddressText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function isMeaningfulAddressText(value?: string | null): boolean {
  const normalized = normalizeAddressText(value);
  return Boolean(normalized) && !PLACEHOLDER_ADDRESS_VALUES.has(normalized);
}

export function shouldAutofillLocationText(value?: string | null): boolean {
  const normalized = normalizeAddressText(value);
  return !normalized || normalized.startsWith('detected at') || PLACEHOLDER_ADDRESS_VALUES.has(normalized);
}

export function formatDisplayStoreAddress(address?: Partial<Address> | null): string {
  if (!address) {
    return '';
  }

  return [address.street, address.city, address.state, address.pincode]
    .filter((value) => isMeaningfulAddressText(value) && normalizeAddressText(value) !== '000000')
    .join(', ');
}

function pickFirstMeaningfulValue(...values: Array<unknown>): string {
  for (const value of values) {
    if (!isMeaningfulAddressText(typeof value === 'string' ? value : '')) {
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
  return match?.[0] || '';
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedAddress> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error('Unable to fetch address from coordinates.');
  }

  const payload = (await response.json()) as {
    address?: Record<string, unknown>;
  };
  const address = payload.address || {};

  const street = pickFirstMeaningfulValue(
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
  const displayLabel = [street, city, state].filter(Boolean).join(', ') || [city, state].filter(Boolean).join(', ');

  return {
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(pincode ? { pincode } : {}),
    displayLabel,
  };
}
