import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  allowGuestCheckout: false,
  metaTitle: '',
  metaDescription: '',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const settingsQuery = useQuery({ queryKey: ['super-admin-site-settings'], queryFn: adminApi.siteSettings });

  const { register, handleSubmit, reset, formState: { isSubmitting, errors, isDirty } } = useForm<
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

  if (settingsQuery.isLoading || !settingsQuery.data) return <LoadingBlock label="Loading site settings..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Site Settings" subtitle="Configure platform-level settings for platform name, support details, and feature toggles." />
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <p className="mb-4 text-xs font-semibold text-slate-500">
          Har field ke upar label diya gaya hai. Changes apply karne ke liye Save Settings zaroor click karein.
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

        </div>

        {saveError ? <p className="mt-4 text-sm font-semibold text-rose-600">{saveError}</p> : null}
        {saveSuccess ? <p className="mt-4 text-sm font-semibold text-emerald-700">{saveSuccess}</p> : null}

        <button type="submit" disabled={isSubmitting || mutation.isPending || !isDirty} className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting || mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

    </div>
  );
}
