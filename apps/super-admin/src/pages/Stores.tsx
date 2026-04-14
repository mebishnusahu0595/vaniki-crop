import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { StoreSummary } from '../types/admin';
import { adminApi } from '../utils/api';
import { formatDisplayStoreAddress, isMeaningfulAddressText, reverseGeocodeCoordinates } from '../utils/geocoding';
import { currencyFormatter } from '../utils/format';

const storeSchema = z.object({
  name: z.string().trim().min(2, 'Store name must be at least 2 characters.'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number.'),
  email: z.string().trim().email('Please enter a valid email address.').or(z.literal('')),
  adminId: z.string().min(1, 'Please assign a store admin.'),
  street: z.string().trim().min(3, 'Street is required.'),
  city: z.string().trim().min(2, 'City is required.'),
  state: z.string().trim().min(2, 'State is required.'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits.'),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90.').max(90, 'Latitude must be between -90 and 90.'),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180.').max(180, 'Longitude must be between -180 and 180.'),
  deliveryRadius: z.coerce.number().min(0, 'Delivery radius cannot be negative.'),
  openHoursMonday: z.string().optional().or(z.literal('')),
  openHoursTuesday: z.string().optional().or(z.literal('')),
  openHoursWednesday: z.string().optional().or(z.literal('')),
  openHoursThursday: z.string().optional().or(z.literal('')),
  openHoursFriday: z.string().optional().or(z.literal('')),
  openHoursSaturday: z.string().optional().or(z.literal('')),
  openHoursSunday: z.string().optional().or(z.literal('')),
});

type StoreFormInput = z.input<typeof storeSchema>;
type StoreFormOutput = z.output<typeof storeSchema>;

const storeDefaultValues: StoreFormInput = {
  name: '',
  phone: '',
  email: '',
  adminId: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  latitude: 0,
  longitude: 0,
  deliveryRadius: 10,
  openHoursMonday: '',
  openHoursTuesday: '',
  openHoursWednesday: '',
  openHoursThursday: '',
  openHoursFriday: '',
  openHoursSaturday: '',
  openHoursSunday: '',
};

export default function StoresPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StoreSummary | null>(null);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [actioningStoreId, setActioningStoreId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const storesQuery = useQuery({
    queryKey: ['super-admin-stores', debouncedSearch],
    queryFn: () => adminApi.stores({ search: debouncedSearch, limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const adminsQuery = useQuery({
    queryKey: ['super-admin-admin-options'],
    queryFn: () => adminApi.admins({ limit: 200, isActive: true }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<StoreFormInput, undefined, StoreFormOutput>({
    resolver: zodResolver(storeSchema),
    defaultValues: storeDefaultValues,
  });
  const lastResolvedCoordinatesRef = useRef('');
  const autoFilledStreetRef = useRef('');
  const [latitude, longitude] = watch(['latitude', 'longitude']);

  useEffect(() => {
    if (!editing) {
      reset(storeDefaultValues);
      lastResolvedCoordinatesRef.current = '';
      autoFilledStreetRef.current = '';
      return;
    }

    setFormError('');

    const locationCoordinates = editing.location?.coordinates || [0, 0];
    const [nextLongitude, nextLatitude] = locationCoordinates;
    const editingAddress = editing.address || { street: '', city: '', state: '', pincode: '' };
    const editingOpenHours = editing.openHours || {};

    reset({
      name: editing.name,
      phone: editing.phone,
      email: editing.email || '',
      adminId: editing.admin?.id || '',
      street: editingAddress.street || '',
      city: editingAddress.city || '',
      state: editingAddress.state || '',
      pincode: editingAddress.pincode || '',
      latitude: nextLatitude || 0,
      longitude: nextLongitude || 0,
      deliveryRadius: editing.deliveryRadius,
      openHoursMonday: editingOpenHours.monday || '',
      openHoursTuesday: editingOpenHours.tuesday || '',
      openHoursWednesday: editingOpenHours.wednesday || '',
      openHoursThursday: editingOpenHours.thursday || '',
      openHoursFriday: editingOpenHours.friday || '',
      openHoursSaturday: editingOpenHours.saturday || '',
      openHoursSunday: editingOpenHours.sunday || '',
    });
    lastResolvedCoordinatesRef.current = '';
    autoFilledStreetRef.current = '';
  }, [editing, reset]);

  useEffect(() => {
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);

    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude) || (nextLatitude === 0 && nextLongitude === 0)) {
      return;
    }

    const coordinatesKey = `${nextLatitude.toFixed(6)},${nextLongitude.toFixed(6)}`;
    if (lastResolvedCoordinatesRef.current === coordinatesKey) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const resolvedAddress = await reverseGeocodeCoordinates(nextLatitude, nextLongitude);
          if (isCancelled) {
            return;
          }

          const currentStreet = getValues('street');
          if (
            resolvedAddress.street
            && (!isMeaningfulAddressText(currentStreet) || currentStreet.trim() === autoFilledStreetRef.current)
          ) {
            setValue('street', resolvedAddress.street, { shouldDirty: true, shouldValidate: true });
            autoFilledStreetRef.current = resolvedAddress.street;
          }

          if (resolvedAddress.city) {
            setValue('city', resolvedAddress.city, { shouldDirty: true, shouldValidate: true });
          }
          if (resolvedAddress.state) {
            setValue('state', resolvedAddress.state, { shouldDirty: true, shouldValidate: true });
          }
          if (resolvedAddress.pincode) {
            setValue('pincode', resolvedAddress.pincode, { shouldDirty: true, shouldValidate: true });
          }

          lastResolvedCoordinatesRef.current = coordinatesKey;
        } catch {
          lastResolvedCoordinatesRef.current = coordinatesKey;
        }
      })();
    }, 700);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [getValues, latitude, longitude, setValue]);

  const availableAdmins = useMemo(() => {
    const rows = adminsQuery.data?.data || [];
    const activeApproved = rows.filter((admin) => admin.isActive && admin.approvalStatus === 'approved');

    const filteredRows = editing
      ? activeApproved
      : activeApproved.filter((admin) => !admin.assignedStore || !admin.assignedStore.isActive);

    if (
      editing?.admin
      && !filteredRows.some((admin) => admin.id === editing.admin?.id)
    ) {
      return [
        {
          id: editing.admin.id,
          name: editing.admin.name,
          email: editing.admin.email,
          mobile: editing.admin.mobile || '',
          role: 'storeAdmin' as const,
          isActive: Boolean(editing.admin.isActive),
          status: editing.admin.isActive ? 'active' as const : 'inactive' as const,
          approvalStatus: 'approved' as const,
          assignedStore: editing
            ? {
                id: editing.id,
                name: editing.name,
                isActive: Boolean(editing.isActive),
              }
            : null,
        },
        ...filteredRows,
      ];
    }

    return filteredRows;
  }, [adminsQuery.data?.data, editing]);

  const upsertMutation = useMutation({
    mutationFn: async (values: StoreFormOutput) => {
      setFormError('');
      const openHours = {
        monday: values.openHoursMonday?.trim() || undefined,
        tuesday: values.openHoursTuesday?.trim() || undefined,
        wednesday: values.openHoursWednesday?.trim() || undefined,
        thursday: values.openHoursThursday?.trim() || undefined,
        friday: values.openHoursFriday?.trim() || undefined,
        saturday: values.openHoursSaturday?.trim() || undefined,
        sunday: values.openHoursSunday?.trim() || undefined,
      };

      const payload = {
        name: values.name,
        phone: values.phone,
        email: values.email,
        adminId: values.adminId,
        address: {
          street: values.street,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
        },
        location: {
          type: 'Point' as const,
          coordinates: [values.longitude, values.latitude] as [number, number],
        },
        deliveryRadius: values.deliveryRadius,
        openHours,
      };

      if (editing) {
        return adminApi.updateStore(editing.id, payload);
      }

      return adminApi.createStore(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-admin-options'] });
      setEditing(null);
      setFormError('');
      reset(storeDefaultValues);
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Unable to save store.');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.toggleStoreActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-stores'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to update store status.');
    },
    onSettled: () => {
      setActioningStoreId(null);
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async (id: string) => adminApi.deleteStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-admin-options'] });
      if (editing) {
        setEditing(null);
        reset(storeDefaultValues);
      }
      setFormError('');
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Unable to delete store.');
    },
    onSettled: () => {
      setActioningStoreId(null);
    },
  });

  if (storesQuery.isLoading && !storesQuery.data) return <LoadingBlock label="Loading stores..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader
          title="All Stores"
          subtitle="Create, edit, deactivate, and reassign admin ownership across stores."
        />

        <form
          onSubmit={handleSubmit((values) => {
            setFormError('');
            upsertMutation.mutate(values);
          })}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Name</label>
            <input
              {...register('name')}
              placeholder="Store name"
              className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.name ? 'border-rose-300' : 'border-primary-100'}`}
            />
            {errors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.name.message}</p> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phone</label>
              <input
                {...register('phone')}
                inputMode="numeric"
                maxLength={10}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                }}
                placeholder="9876543210"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.phone ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.phone ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.phone.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email</label>
              <input
                {...register('email')}
                placeholder="store@example.com"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.email ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email.message}</p> : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Assign Admin</label>
            <select
              {...register('adminId')}
              className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.adminId ? 'border-rose-300' : 'border-primary-100'}`}
            >
              <option value="">Assign admin</option>
              {availableAdmins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name} ({admin.mobile})
                  {admin.assignedStore ? ` • assigned to ${admin.assignedStore.name}` : ''}
                </option>
              ))}
            </select>
            {errors.adminId ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.adminId.message}</p> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Street</label>
              <input
                {...register('street')}
                placeholder="Street"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.street ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.street ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.street.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">City</label>
              <input
                {...register('city')}
                placeholder="City"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.city ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.city ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.city.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">State</label>
              <input
                {...register('state')}
                placeholder="State"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.state ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.state ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.state.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pincode</label>
              <input
                {...register('pincode')}
                inputMode="numeric"
                maxLength={6}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
                }}
                placeholder="493332"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.pincode ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.pincode ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.pincode.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Latitude</label>
              <input
                type="number"
                step="0.000001"
                {...register('latitude', { valueAsNumber: true })}
                placeholder="21.2333"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.latitude ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.latitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.latitude.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Longitude</label>
              <input
                type="number"
                step="0.000001"
                {...register('longitude', { valueAsNumber: true })}
                placeholder="81.6333"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.longitude ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.longitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.longitude.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Delivery Radius (km)</label>
              <input
                type="number"
                {...register('deliveryRadius', { valueAsNumber: true })}
                placeholder="10"
                className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.deliveryRadius ? 'border-rose-300' : 'border-primary-100'}`}
              />
              {errors.deliveryRadius ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.deliveryRadius.message}</p> : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Open Hours</label>
            <div className="grid gap-3 md:grid-cols-2">
              <input {...register('openHoursMonday')} placeholder="Monday hours (e.g. 09:00-21:00)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursTuesday')} placeholder="Tuesday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursWednesday')} placeholder="Wednesday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursThursday')} placeholder="Thursday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursFriday')} placeholder="Friday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursSaturday')} placeholder="Saturday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              <input {...register('openHoursSunday')} placeholder="Sunday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500">City, state, and pincode auto-fill from the latitude and longitude.</p>

          {Object.keys(errors).length > 0 ? (
            <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Please fix highlighted fields before submitting.
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || upsertMutation.isPending}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? 'Update Store' : 'Add Store'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormError('');
                  reset(storeDefaultValues);
                }}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {formError ? <p className="text-sm font-semibold text-rose-600">{formError}</p> : null}
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search stores by name, city, phone"
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
          {storesQuery.isFetching ? <p className="mt-2 text-xs font-semibold text-slate-500">Updating list...</p> : null}
        </div>

        {storesQuery.data?.data.map((store) => (
          <div key={store.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">{store.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDisplayStoreAddress(store.address) || 'Address needs update'}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                  Admin: {store.adminName}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setEditing(store)}
                  className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete store ${store.name}? This action cannot be undone.`)) return;
                    setActioningStoreId(store.id);
                    deleteStoreMutation.mutate(store.id);
                  }}
                  disabled={actioningStoreId === store.id}
                  className="rounded-xl border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Orders</p>
                <p className="mt-1 text-sm font-black text-slate-900">{store.totalOrders}</p>
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Revenue</p>
                <p className="mt-1 text-sm font-black text-slate-900">{currencyFormatter.format(store.totalRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Delivery Radius</p>
                <p className="mt-1 text-sm font-black text-slate-900">{store.deliveryRadius} km</p>
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
                <button
                  onClick={() => {
                    setActioningStoreId(store.id);
                    toggleActiveMutation.mutate({
                      id: store.id,
                      isActive: !store.isActive,
                    });
                  }}
                  disabled={actioningStoreId === store.id}
                  className={`mt-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                    store.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {store.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
