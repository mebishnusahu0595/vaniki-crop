import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';

const settingsSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(10),
  email: z.string().email().or(z.literal('')),
  street: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  deliveryRadius: z.coerce.number().min(0),
  monday: z.string().optional(),
  tuesday: z.string().optional(),
  wednesday: z.string().optional(),
  thursday: z.string().optional(),
  friday: z.string().optional(),
  saturday: z.string().optional(),
  sunday: z.string().optional(),
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
  const [saveError, setSaveError] = useState('');
  const settingsQuery = useQuery({ queryKey: ['admin-store-settings'], queryFn: adminApi.storeSettings });
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<
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
      }),
    onMutate: () => {
      setSaveError('');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] });
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save store settings.');
    },
  });

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
        <input type="hidden" {...register('latitude', { valueAsNumber: true })} />
        <input type="hidden" {...register('longitude', { valueAsNumber: true })} />
        <div className="grid gap-4 md:grid-cols-2">
          <input {...register('name')} placeholder="Store name" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('phone')} placeholder="Phone" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('email')} placeholder="Email" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
          <input {...register('street')} placeholder="Street" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
          <input {...register('city')} placeholder="City" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('state')} placeholder="State" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('pincode')} placeholder="Pincode" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input type="number" {...register('deliveryRadius', { valueAsNumber: true })} placeholder="Delivery radius (km)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
            <p className="font-black uppercase tracking-[0.14em] text-primary-600">Map Coordinates</p>
            <p className="mt-1">{coordinatesText || 'Coordinates will be filled from address map lookup.'}</p>
          </div>
          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
            <input key={day} {...register(day as keyof SettingsFormValues)} placeholder={`${day[0].toUpperCase()}${day.slice(1)} hours`} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          ))}
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Store Location Map</p>
              <p className="mt-1 text-sm text-slate-600">Address based map preview with automatic coordinate lookup.</p>
            </div>
            <button
              type="button"
              onClick={resolveCoordinatesFromAddress}
              disabled={isResolvingAddress}
              className="rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary-700"
            >
              {isResolvingAddress ? 'Locating...' : 'Use Address On Map'}
            </button>
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
        <button type="submit" disabled={isSubmitting} className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
