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
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().or(z.literal('')),
  adminId: z.string().min(1),
  street: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  deliveryRadius: z.coerce.number().min(0),
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
    formState: { isSubmitting },
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
          <input {...register('name')} placeholder="Store name" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div className="grid gap-3 md:grid-cols-2">
            <input {...register('phone')} placeholder="Phone" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('email')} placeholder="Email" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>
          <select {...register('adminId')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <option value="">Assign admin</option>
            {availableAdmins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.mobile})
                {admin.assignedStore ? ` • assigned to ${admin.assignedStore.name}` : ''}
              </option>
            ))}
          </select>

          <div className="grid gap-3 md:grid-cols-2">
            <input {...register('street')} placeholder="Street" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
            <input {...register('city')} placeholder="City" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('state')} placeholder="State" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('pincode')} placeholder="Pincode" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" step="0.000001" {...register('latitude', { valueAsNumber: true })} placeholder="Latitude" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" step="0.000001" {...register('longitude', { valueAsNumber: true })} placeholder="Longitude" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" {...register('deliveryRadius', { valueAsNumber: true })} placeholder="Delivery radius (km)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input {...register('openHoursMonday')} placeholder="Monday hours (e.g. 09:00-21:00)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursTuesday')} placeholder="Tuesday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursWednesday')} placeholder="Wednesday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursThursday')} placeholder="Thursday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursFriday')} placeholder="Friday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursSaturday')} placeholder="Saturday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('openHoursSunday')} placeholder="Sunday hours" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
          </div>
          <p className="text-xs font-semibold text-slate-500">City, state, and pincode auto-fill from the latitude and longitude.</p>

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
              <button
                onClick={() => setEditing(store)}
                className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit
              </button>
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
