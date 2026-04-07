import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['admin-store-settings'], queryFn: adminApi.storeSettings });
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<
    SettingsFormInput,
    undefined,
    SettingsFormOutput
  >({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsDefaultValues,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] });
    },
  });

  if (settingsQuery.isLoading || !settingsQuery.data) return <LoadingBlock label="Loading store settings..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Store Settings" subtitle="Update your store profile, hours, address, and delivery radius." />
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <input {...register('name')} placeholder="Store name" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('phone')} placeholder="Phone" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('email')} placeholder="Email" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
          <input {...register('street')} placeholder="Street" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2" />
          <input {...register('city')} placeholder="City" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('state')} placeholder="State" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('pincode')} placeholder="Pincode" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input type="number" step="0.000001" {...register('latitude', { valueAsNumber: true })} placeholder="Latitude" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input type="number" step="0.000001" {...register('longitude', { valueAsNumber: true })} placeholder="Longitude" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input type="number" {...register('deliveryRadius', { valueAsNumber: true })} placeholder="Delivery radius (km)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
            <input key={day} {...register(day as keyof SettingsFormValues)} placeholder={`${day[0].toUpperCase()}${day.slice(1)} hours`} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          ))}
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
