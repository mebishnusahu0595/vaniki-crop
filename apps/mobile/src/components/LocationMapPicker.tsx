import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { INDIAN_STATES, STATE_DISTRICTS } from '@vaniki/shared';
import { lookupPincode } from '../utils/pincode';

export interface LocationResult {
  lat: number;
  lng: number;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  formattedAddress?: string;
}

interface LocationMapPickerProps {
  onLocationSelect: (result: LocationResult) => void;
  initialLat?: number;
  initialLng?: number;
  currentPincode?: string;
  currentState?: string;
  currentCity?: string;
}

function findMatchingState(rawState?: string): string {
  if (!rawState) return '';
  const clean = rawState.trim().toLowerCase();
  const matched = INDIAN_STATES.find(
    (s) => s.toLowerCase() === clean || clean.includes(s.toLowerCase()) || s.toLowerCase().includes(clean),
  );
  return matched || '';
}

function findMatchingDistrict(state: string, rawCity?: string): string {
  if (!state || !rawCity) return '';
  const districts = STATE_DISTRICTS[state] || [];
  const clean = rawCity.trim().toLowerCase();
  const matched = districts.find(
    (d) => d.toLowerCase() === clean || clean.includes(d.toLowerCase()) || d.toLowerCase().includes(clean),
  );
  return matched || rawCity;
}

export function LocationMapPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  currentPincode,
  currentState,
  currentCity,
}: LocationMapPickerProps) {
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null,
  );
  const [addressText, setAddressText] = useState<string>('Detecting location...');

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'VanikiCropApp/1.0',
            'Accept-Language': 'en',
          },
        },
      );
      const data = await res.json();

      let street = '';
      let city = '';
      let state = '';
      let pincode = '';
      let landmark = '';
      let displayName = '';

      if (data && data.address) {
        const a = data.address;
        street = a.road || a.suburb || a.neighbourhood || a.village || a.hamlet || a.residential || '';
        const rawCity = a.city || a.town || a.district || a.county || a.state_district || a.suburb || '';
        const rawState = a.state || '';
        pincode = a.postcode ? a.postcode.replace(/\D/g, '') : '';
        landmark = a.amenity || a.building || a.shop || '';

        state = findMatchingState(rawState) || rawState;
        city = findMatchingDistrict(state, rawCity) || rawCity;

        // Auto lookup pincode details if state/city missing
        if (pincode.length === 6 && (!city || !state)) {
          const pinData = await lookupPincode(pincode);
          if (pinData) {
            if (!state) state = findMatchingState(pinData.state) || pinData.state;
            if (!city) city = findMatchingDistrict(state, pinData.district) || pinData.district;
          }
        }

        const addressParts = [street, city, state, pincode].filter(Boolean);
        displayName = addressParts.join(', ') || data.display_name || 'Selected Location';
      } else {
        displayName = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
      }

      setAddressText(displayName);

      onLocationSelect({
        lat,
        lng,
        street,
        city,
        state,
        pincode,
        landmark,
        formattedAddress: displayName,
      });

      return { street, city, state, pincode, displayName };
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      const fallbackMsg = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
      setAddressText(fallbackMsg);
      onLocationSelect({ lat, lng, formattedAddress: fallbackMsg });
      return null;
    }
  };

  const handleDetectLiveLocation = () => {
    setLoading(true);
    setAddressText('Detecting GPS location...');

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoading(false);
      Alert.alert('Not Supported', 'Geolocation is not supported by your browser or device.');
      return;
    }

    const tryGetPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });
          await reverseGeocode(lat, lng);
          setLoading(false);
        },
        (error) => {
          if (highAccuracy) {
            // Retry with standard accuracy (IP/WiFi fallback)
            tryGetPosition(false);
          } else {
            setLoading(false);
            setAddressText('Location access failed. Please select on map.');
            Alert.alert(
              'Location Access Failed',
              error.message || 'Could not fetch live GPS. Please enable location permissions or pick on map.',
            );
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 8000 : 15000, maximumAge: 10000 },
      );
    };

    tryGetPosition(true);
  };

  // On initial mount, detect location if coords not set
  useEffect(() => {
    if (!coords) {
      handleDetectLiveLocation();
    } else {
      reverseGeocode(coords.lat, coords.lng);
    }
  }, []);

  const activeLat = coords?.lat || 21.2514;
  const activeLng = coords?.lng || 81.6296;

  // Build Clean Leaflet OpenStreetMap HTML (No floating text badges inside map)
  const mapHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f7f6; }
    #map { width: 100%; height: 100%; }
    .leaflet-container { background: #e5e7eb; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var currentLat = ${activeLat};
    var currentLng = ${activeLng};

    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([currentLat, currentLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);

    function sendLocation(lat, lng) {
      window.parent.postMessage({ type: 'VANIKI_MAP_PIN_MOVED', lat: lat, lng: lng }, '*');
    }

    marker.on('dragend', function(e) {
      var p = e.target.getLatLng();
      sendLocation(p.lat, p.lng);
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      sendLocation(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>
    `;
  }, [activeLat, activeLng]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMessage = async (event: MessageEvent) => {
        if (event.data && event.data.type === 'VANIKI_MAP_PIN_MOVED') {
          const { lat, lng } = event.data;
          setCoords({ lat, lng });
          await reverseGeocode(lat, lng);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, []);

  return (
    <View className="rounded-[24px] bg-white border border-primary-100 overflow-hidden shadow-sm">
      {/* Top Bar */}
      <View className="p-4 bg-primary-50/70 border-b border-primary-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-500">
            <Feather name="map-pin" size={15} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black uppercase tracking-[1.5px] text-primary-900">
              Pick Delivery Pin on Map
            </Text>
            <Text className="text-[11px] font-semibold text-primary-700 mt-0.5" numberOfLines={1}>
              {addressText}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleDetectLiveLocation}
          disabled={loading}
          className="rounded-xl bg-primary-900 py-2 px-3 active:scale-95 flex-row items-center gap-1.5 shadow-sm"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="crosshair" size={13} color="#FFFFFF" />
          )}
          <Text className="text-[10px] font-black uppercase tracking-[1px] text-white">
            {loading ? 'Locating...' : 'GPS'}
          </Text>
        </Pressable>
      </View>

      {/* Embedded Map Container (Tall 380px) */}
      {Platform.OS === 'web' ? (
        <View style={{ height: 380 }} className="w-full bg-slate-100 relative">
          <iframe
            srcDoc={mapHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="OpenStreetMap Location Picker"
          />
        </View>
      ) : (
        <View className="p-6 bg-white items-center">
          <Feather name="map-pin" size={28} color="#2D6A4F" />
          <Text className="text-xs font-bold text-primary-900 mt-2 text-center">
            {addressText}
          </Text>
        </View>
      )}

      {/* Bottom Live Selected Address Info */}
      <View className="p-3.5 bg-white border-t border-primary-50 flex-row items-center gap-2">
        <Feather name="check-circle" size={14} color="#059669" />
        <Text className="text-xs font-bold text-primary-900 flex-1" numberOfLines={2}>
          📍 Selected: {addressText}
        </Text>
      </View>
    </View>
  );
}
