import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { GstVerificationData } from '../types/admin';

const settingsSchema = z.object({
  name: z.string().trim().min(3, 'Store name must be at least 3 characters'),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter valid phone (10 to 15 digits)'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  street: z.string().trim().min(5, 'Street is required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  deliveryRadius: z.coerce.number().min(0, 'Delivery radius cannot be negative'),
  monday: z.string().optional(),
  tuesday: z.string().optional(),
  wednesday: z.string().optional(),
  thursday: z.string().optional(),
  friday: z.string().optional(),
  saturday: z.string().optional(),
  sunday: z.string().optional(),
  gstNumber: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  sgstNumber: z.string().trim().min(5).max(30).optional().or(z.literal('')),
  cgst: z.coerce.number().min(0).max(100).optional(),
  sgst: z.coerce.number().min(0).max(100).optional(),
  igst: z.coerce.number().min(0).max(100).optional(),
  loyaltyPointRupeeValue: z.coerce.number().min(0).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type SettingsFormInput = z.input<typeof settingsSchema>;
type SettingsFormOutput = z.output<typeof settingsSchema>;

const settingsDefaultValues: SettingsFormInput = {
  name: '',
  phone: '',
  email: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  latitude: 0,
  longitude: 0,
  deliveryRadius: 0,
  monday: '',
  tuesday: '',
  wednesday: '',
  thursday: '',
  friday: '',
  saturday: '',
  sunday: '',
  gstNumber: '',
  sgstNumber: '',
  cgst: 0,
  sgst: 0,
  igst: 0,
  loyaltyPointRupeeValue: 1,
};

function buildAddressText(values: Pick<SettingsFormInput, 'street' | 'city' | 'state' | 'pincode'>): string {
  return [values.street, values.city, values.state, values.pincode]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');
}

function buildMapEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [mapLookupError, setMapLookupError] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [gstVerification, setGstVerification] = useState<{ loading: boolean; error: string; data: GstVerificationData | null }>({
    loading: false,
    error: '',
    data: null,
  });
  const settingsQuery = useQuery({ queryKey: ['admin-store-settings'], queryFn: adminApi.storeSettings });
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting, isDirty, errors } } = useForm<
    SettingsFormInput,
    undefined,
    SettingsFormOutput
  >({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsDefaultValues,
  });

  const [street, city, state, pincode, latitude, longitude] = watch([
    'street',
    'city',
    'state',
    'pincode',
    'latitude',
    'longitude',
  ]);

  const addressText = useMemo(
    () => buildAddressText({ street: street || '', city: city || '', state: state || '', pincode: pincode || '' }),
    [city, pincode, state, street],
  );

  const coordinatesText = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, [latitude, longitude]);

  const mapEmbedUrl = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return buildMapEmbedUrl(`${lat},${lng}`);
    }
    if (addressText) {
      return buildMapEmbedUrl(addressText);
    }
    return '';
  }, [addressText, latitude, longitude]);

  useEffect(() => {
    if (!settingsQuery.data) return;

    reset({
      name: settingsQuery.data.name,
      phone: settingsQuery.data.phone,
      email: settingsQuery.data.email || '',
      street: settingsQuery.data.address.street,
      city: settingsQuery.data.address.city,
      state: settingsQuery.data.address.state,
      pincode: settingsQuery.data.address.pincode,
      latitude: settingsQuery.data.location.coordinates[1],
      longitude: settingsQuery.data.location.coordinates[0],
      deliveryRadius: settingsQuery.data.deliveryRadius,
      monday: settingsQuery.data.openHours?.monday || '',
      tuesday: settingsQuery.data.openHours?.tuesday || '',
      wednesday: settingsQuery.data.openHours?.wednesday || '',
      thursday: settingsQuery.data.openHours?.thursday || '',
      friday: settingsQuery.data.openHours?.friday || '',
      saturday: settingsQuery.data.openHours?.saturday || '',
      sunday: settingsQuery.data.openHours?.sunday || '',
      gstNumber: settingsQuery.data.gstNumber || '',
      sgstNumber: settingsQuery.data.sgstNumber || '',
      cgst: settingsQuery.data.cgst || 0,
      sgst: settingsQuery.data.sgst || 0,
      igst: settingsQuery.data.igst || 0,
      loyaltyPointRupeeValue: settingsQuery.data.loyaltyPointRupeeValue || 1,
    });
  }, [reset, settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: SettingsFormOutput) =>
      adminApi.updateStoreSettings({
        name: values.name,
        phone: values.phone,
        email: values.email,
        address: {
          street: values.street,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
        },
        location: {
          type: 'Point',
          coordinates: [values.longitude, values.latitude],
        },
        deliveryRadius: values.deliveryRadius,
        openHours: {
          monday: values.monday,
          tuesday: values.tuesday,
          wednesday: values.wednesday,
          thursday: values.thursday,
          friday: values.friday,
          saturday: values.saturday,
          sunday: values.sunday,
        },
        gstNumber: values.gstNumber,
        sgstNumber: values.sgstNumber,
        cgst: values.cgst,
        sgst: values.sgst,
        igst: values.igst,
        loyaltyPointRupeeValue: values.loyaltyPointRupeeValue,
      }),
    onMutate: () => {
      setSaveError('');
      setSaveSuccess('');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] });
      setSaveSuccess('Store settings saved successfully.');
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save store settings.');
    },
  });

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapLookupError('Geolocation is not supported on this device/browser.');
      return;
    }

    setMapLookupError('');
    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = Number(position.coords.latitude.toFixed(6));
        const nextLongitude = Number(position.coords.longitude.toFixed(6));

        setValue('latitude', nextLatitude, { shouldDirty: true, shouldValidate: true });
        setValue('longitude', nextLongitude, { shouldDirty: true, shouldValidate: true });
        setIsDetectingLocation(false);
      },
      () => {
        setMapLookupError('Unable to detect your current location. Please allow location permission and retry.');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const gstNumberValue = watch('gstNumber');
  const handleVerifyGst = async () => {
    if (!gstNumberValue) return;
    setGstVerification({ loading: true, error: '', data: null });
    try {
      const data = await adminApi.verifyGst(gstNumberValue);
      setGstVerification({ loading: false, error: '', data });
    } catch (error) {
      setGstVerification({ loading: false, error: error instanceof Error ? error.message : 'Verification failed', data: null });
    }
  };

  const resolveCoordinatesFromAddress = async () => {
    if (!addressText) {
      setMapLookupError('Please fill complete address before resolving map location.');
      return;
    }

    try {
      setIsResolvingAddress(true);
      setMapLookupError('');

      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressText)}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Unable to fetch coordinates for this address.');
      }

      const results = await response.json() as Array<{ lat: string; lon: string }>;
      const firstMatch = results[0];

      if (!firstMatch) {
        throw new Error('No map result found for this address.');
      }

      const nextLatitude = Number(firstMatch.lat);
      const nextLongitude = Number(firstMatch.lon);

      if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
        throw new Error('Received invalid coordinates from map lookup.');
      }

      setValue('latitude', Number(nextLatitude.toFixed(6)), { shouldDirty: true, shouldValidate: true });
      setValue('longitude', Number(nextLongitude.toFixed(6)), { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setMapLookupError(error instanceof Error ? error.message : 'Unable to resolve location from address.');
    } finally {
      setIsResolvingAddress(false);
    }
  };

  if (settingsQuery.isLoading) return <LoadingBlock label="Loading store settings..." />;
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="space-y-4 rounded-[1.75rem] border border-rose-200 bg-rose-50/50 p-5">
        <PageHeader title="Store Settings" subtitle="Unable to load store settings right now." />
        <p className="text-sm text-rose-700">{settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Please retry in a moment.'}</p>
        <button
          type="button"
          onClick={() => settingsQuery.refetch()}
          className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Store Settings" subtitle="Update your store profile, hours, address, and delivery radius." />
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <p className="mb-4 text-xs font-semibold text-slate-500">
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Store Name</label>
            <input {...register('name')} placeholder="Store name" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.name ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Phone</label>
            <input {...register('phone')} placeholder="Phone" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.phone ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.phone ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.phone.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Email</label>
            <input {...register('email')} placeholder="Email" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.email ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Street Address</label>
            <input {...register('street')} placeholder="Street" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.street ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.street ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.street.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">City</label>
            <input {...register('city')} placeholder="City" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.city ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.city ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.city.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">State</label>
            <input {...register('state')} placeholder="State" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.state ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.state ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.state.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Pincode</label>
            <input {...register('pincode')} placeholder="Pincode" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.pincode ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.pincode ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.pincode.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Delivery Radius (km)</label>
            <input type="number" {...register('deliveryRadius', { valueAsNumber: true })} placeholder="Delivery radius (km)" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.deliveryRadius ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.deliveryRadius ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.deliveryRadius.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Latitude</label>
            <input type="number" step="0.000001" {...register('latitude', { valueAsNumber: true })} placeholder="Latitude" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.latitude ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.latitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.latitude.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Longitude</label>
            <input type="number" step="0.000001" {...register('longitude', { valueAsNumber: true })} placeholder="Longitude" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.longitude ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.longitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.longitude.message}</p> : null}
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
            <p className="font-black uppercase tracking-[0.14em] text-primary-600">Map Coordinates</p>
            <p className="mt-1">{coordinatesText || 'Coordinates will be filled from address map lookup.'}</p>
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600 border-b border-primary-100 pb-2">Taxation & Legal</h3>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">GST Number (GSTIN)</label>
            <div className="flex gap-2">
              <input {...register('gstNumber')} placeholder="e.g. 22AAAAA0000A1Z5" className={`flex-1 rounded-2xl border bg-primary-50 px-4 py-3 uppercase ${errors.gstNumber ? 'border-rose-300' : 'border-primary-100'}`} />
              <button
                type="button"
                onClick={handleVerifyGst}
                disabled={gstVerification.loading || !gstNumberValue}
                className="rounded-2xl bg-primary-600 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
              >
                {gstVerification.loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {errors.gstNumber ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.gstNumber.message}</p> : null}
            {gstVerification.error ? <p className="mt-1 text-xs font-semibold text-rose-600">{gstVerification.error}</p> : null}
            {gstVerification.data ? (
              <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-100">
                <p><strong>Status:</strong> {gstVerification.data.status}</p>
                <p><strong>Trade Name:</strong> {gstVerification.data.tradeName}</p>
                <p className="mt-1 opacity-75">{gstVerification.data.message}</p>
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">SGST Number</label>
            <input {...register('sgstNumber')} placeholder="SGST Registration Number" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 uppercase ${errors.sgstNumber ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.sgstNumber ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.sgstNumber.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">SGST (%)</label>
            <input type="number" step="0.01" {...register('sgst', { valueAsNumber: true })} placeholder="SGST %" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.sgst ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.sgst ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.sgst.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">CGST (%)</label>
            <input type="number" step="0.01" {...register('cgst', { valueAsNumber: true })} placeholder="CGST %" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.cgst ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.cgst ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.cgst.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">IGST (%)</label>
            <input type="number" step="0.01" {...register('igst', { valueAsNumber: true })} placeholder="IGST %" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.igst ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.igst ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.igst.message}</p> : null}
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600 border-b border-primary-100 pb-2">Loyalty Points System</h3>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Point Value (₹ per 1 point)</label>
            <input type="number" step="0.01" {...register('loyaltyPointRupeeValue', { valueAsNumber: true })} placeholder="e.g. 1.00" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.loyaltyPointRupeeValue ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.loyaltyPointRupeeValue ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.loyaltyPointRupeeValue.message}</p> : null}
            <p className="mt-1 text-[10px] text-slate-400">Value of 1 loyalty point in rupees during checkout discount.</p>
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600 border-b border-primary-100 pb-2">Business Hours</h3>
          </div>
          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
            const dayError = (errors as Record<string, { message?: string }>)[day];
            return (
              <div key={day}>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{`${day[0].toUpperCase()}${day.slice(1)} Hours`}</label>
                <input
                  {...register(day as keyof SettingsFormValues)}
                  placeholder={`${day[0].toUpperCase()}${day.slice(1)} hours`}
                  className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${dayError ? 'border-rose-300' : 'border-primary-100'}`}
                />
                {dayError?.message ? <p className="mt-1 text-xs font-semibold text-rose-600">{dayError.message}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Store Location Map</p>
              <p className="mt-1 text-sm text-slate-600">Address based map preview with automatic coordinate lookup.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary-700"
              >
                {isDetectingLocation ? 'Detecting...' : 'Detect Current Location'}
              </button>
              <button
                type="button"
                onClick={resolveCoordinatesFromAddress}
                disabled={isResolvingAddress}
                className="rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary-700"
              >
                {isResolvingAddress ? 'Locating...' : 'Use Address On Map'}
              </button>
            </div>
          </div>
          {mapLookupError ? <p className="mt-3 text-sm text-rose-600">{mapLookupError}</p> : null}
          {mapEmbedUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-primary-100 bg-white">
              <iframe
                title="Store location map"
                src={mapEmbedUrl}
                className="h-[320px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </div>

        {saveError ? <p className="mt-4 text-sm text-rose-600">{saveError}</p> : null}
        {saveSuccess ? <p className="mt-4 text-sm font-semibold text-emerald-700">{saveSuccess}</p> : null}
        <button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty} className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting || mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
