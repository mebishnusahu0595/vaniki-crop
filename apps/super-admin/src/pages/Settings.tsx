import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';

const settingsSchema = z.object({
  platformName: z.string().trim().min(2, 'Platform name must be at least 2 characters'),
  supportEmail: z.string().trim().email('Enter a valid support email').or(z.literal('')),
  supportPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter valid support phone (10 to 15 digits)').or(z.literal('')),
  homepageHeadline: z.string().max(220, 'Homepage headline can be up to 220 characters').optional(),
  defaultDeliveryRadius: z.coerce.number().min(0, 'Delivery radius cannot be negative'),
  maintenanceMode: z.boolean().default(false),
  allowGuestCheckout: z.boolean().default(false),
  metaTitle: z.string().max(160, 'Meta title can be up to 160 characters').optional(),
  metaDescription: z.string().max(300, 'Meta description can be up to 300 characters').optional(),
});

type SettingsFormInput = z.input<typeof settingsSchema>;
type SettingsFormOutput = z.output<typeof settingsSchema>;

const settingsDefaultValues: SettingsFormInput = {
  platformName: '',
  supportEmail: '',
  supportPhone: '',
  homepageHeadline: '',
  defaultDeliveryRadius: 10,
  maintenanceMode: false,
  allowGuestCheckout: false,
  metaTitle: '',
  metaDescription: '',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const settingsQuery = useQuery({ queryKey: ['super-admin-site-settings'], queryFn: adminApi.siteSettings });
  const storesQuery = useQuery({ queryKey: ['settings-store-options'], queryFn: () => adminApi.stores({ limit: 200 }) });
  const secretsQuery = useQuery({
    queryKey: ['store-secrets', selectedStoreId],
    queryFn: () => adminApi.storeSecrets(selectedStoreId),
    enabled: Boolean(selectedStoreId),
  });

  const { register, handleSubmit, reset, watch, formState: { isSubmitting, errors, isDirty } } = useForm<
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
      platformName: settingsQuery.data.platformName,
      supportEmail: settingsQuery.data.supportEmail || '',
      supportPhone: settingsQuery.data.supportPhone || '',
      homepageHeadline: settingsQuery.data.homepageHeadline || '',
      defaultDeliveryRadius: settingsQuery.data.defaultDeliveryRadius,
      maintenanceMode: settingsQuery.data.maintenanceMode,
      allowGuestCheckout: settingsQuery.data.allowGuestCheckout,
      metaTitle: settingsQuery.data.metaTitle || '',
      metaDescription: settingsQuery.data.metaDescription || '',
    });
  }, [reset, settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: SettingsFormOutput) => adminApi.updateSiteSettings(values),
    onMutate: () => {
      setSaveError('');
      setSaveSuccess('');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-site-settings'] });
      setSaveSuccess('Settings saved successfully.');
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save site settings.');
    },
  });

  const maintenanceModeEnabled = watch('maintenanceMode');
  const guestCheckoutEnabled = watch('allowGuestCheckout');

  const updateSecretsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStoreId) return;

      const payload = Object.fromEntries(
        Object.entries(secretDraft)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => Boolean(value)),
      );

      if (Object.keys(payload).length === 0) return;
      await adminApi.updateStoreSecrets(selectedStoreId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-secrets', selectedStoreId] });
      setSecretDraft({});
    },
  });

  const selectedStoreName = useMemo(() => {
    if (!selectedStoreId) return '';
    return storesQuery.data?.data.find((store) => store.id === selectedStoreId)?.name || '';
  }, [selectedStoreId, storesQuery.data?.data]);

  const secretFields = ['razorpayKeyId', 'razorpayKeySecret', 'smsAuthKey', 'smtpPassword'];

  if (settingsQuery.isLoading || !settingsQuery.data) return <LoadingBlock label="Loading site settings..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Site Settings" subtitle="Configure platform-level settings and securely manage per-store integration secrets." />
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <p className="mb-4 text-xs font-semibold text-slate-500">
          Har field ke upar label diya gaya hai. Toggle changes apply karne ke liye Save Settings zaroor click karein.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Platform Name</label>
            <input {...register('platformName')} placeholder="Platform name" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.platformName ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.platformName ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.platformName.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Support Phone</label>
            <input {...register('supportPhone')} placeholder="Support phone" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.supportPhone ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.supportPhone ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.supportPhone.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Support Email</label>
            <input {...register('supportEmail')} placeholder="Support email" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.supportEmail ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.supportEmail ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.supportEmail.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Homepage Headline</label>
            <input {...register('homepageHeadline')} placeholder="Homepage headline" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.homepageHeadline ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.homepageHeadline ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.homepageHeadline.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Default Delivery Radius (km)</label>
            <input type="number" {...register('defaultDeliveryRadius', { valueAsNumber: true })} placeholder="Default delivery radius (km)" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.defaultDeliveryRadius ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.defaultDeliveryRadius ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.defaultDeliveryRadius.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Meta Title</label>
            <input {...register('metaTitle')} placeholder="Meta title" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.metaTitle ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.metaTitle ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.metaTitle.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Meta Description</label>
            <textarea {...register('metaDescription')} placeholder="Meta description" className={`min-h-[88px] w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.metaDescription ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.metaDescription ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.metaDescription.message}</p> : null}
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Maintenance mode ({maintenanceModeEnabled ? 'ON' : 'OFF'})</span>
            <input type="checkbox" {...register('maintenanceMode')} className="h-4 w-4 accent-primary-600" />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Allow guest checkout ({guestCheckoutEnabled ? 'ON' : 'OFF'})</span>
            <input type="checkbox" {...register('allowGuestCheckout')} className="h-4 w-4 accent-primary-600" />
          </label>
        </div>

        {saveError ? <p className="mt-4 text-sm font-semibold text-rose-600">{saveError}</p> : null}
        {saveSuccess ? <p className="mt-4 text-sm font-semibold text-emerald-700">{saveSuccess}</p> : null}

        <button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty} className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting || mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Store Secrets</p>
        <p className="mt-2 text-sm text-slate-500">
          Secrets are AES-256 encrypted in the database and only masked values are ever shown here.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[240px_1fr]">
          <select
            value={selectedStoreId}
            onChange={(event) => {
              setSelectedStoreId(event.target.value);
              setSecretDraft({});
            }}
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          >
            <option value="">Select store</option>
            {storesQuery.data?.data.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-600">
            {selectedStoreName ? `Managing secrets for ${selectedStoreName}` : 'Choose a store to view and update masked secrets'}
          </div>
        </div>

        {selectedStoreId ? (
          <div className="mt-6 space-y-4">
            {secretFields.map((key) => (
              <div key={key} className="grid gap-3 rounded-2xl border border-primary-100 bg-primary-50/50 p-4 md:grid-cols-[180px_220px_1fr] md:items-center">
                <p className="text-sm font-black text-slate-900">{key}</p>
                <p className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                  {secretsQuery.data?.secrets?.[key] || 'Not set'}
                </p>
                <input
                  value={secretDraft[key] || ''}
                  onChange={(event) =>
                    setSecretDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  type="password"
                  placeholder={`Enter new ${key}`}
                  className="rounded-2xl border border-primary-100 bg-white px-4 py-3"
                />
              </div>
            ))}

            <button
              onClick={() => updateSecretsMutation.mutate()}
              disabled={updateSecretsMutation.isPending}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white"
            >
              {updateSecretsMutation.isPending ? 'Updating...' : 'Update Secrets'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
