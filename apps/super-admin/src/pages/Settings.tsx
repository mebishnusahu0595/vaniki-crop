import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';

const settingsSchema = z.object({
  platformName: z.string().trim().min(2, 'Platform name must be at least 2 characters'),
  supportEmail: z.string().trim().email('Enter a valid support email').or(z.literal('')),
  supportPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter valid support phone (10 to 15 digits)').or(z.literal('')),
  homepageHeadline: z.string().max(220, 'Homepage headline can be up to 220 characters').optional(),
  defaultDeliveryRadius: z.coerce.number().min(0, 'Delivery radius cannot be negative'),
  freeDeliveryThreshold: z.coerce.number().min(0, 'Free delivery threshold cannot be negative'),
  standardDeliveryCharge: z.coerce.number().min(0, 'Delivery charge cannot be negative'),
  allowGuestCheckout: z.boolean().default(false),
  metaTitle: z.string().max(160, 'Meta title can be up to 160 characters').optional(),
  metaDescription: z.string().max(300, 'Meta description can be up to 300 characters').optional(),
  loyaltyPointRupeeValue: z.coerce.number().min(0, 'Point value cannot be negative'),
  garageNames: z.array(z.string().trim().min(1, 'Garage name is required')).default([]),
  street: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  state: z.string().trim().optional().or(z.literal('')),
  pincode: z.string().trim().optional().or(z.literal('')),
  panNumber: z.string().trim().toUpperCase().optional().or(z.literal('')),
  gstNumber: z.string().trim().toUpperCase().optional().or(z.literal('')),
});

type SettingsFormInput = z.input<typeof settingsSchema>;
type SettingsFormOutput = z.output<typeof settingsSchema>;

const settingsDefaultValues: SettingsFormInput = {
  platformName: '',
  supportEmail: '',
  supportPhone: '',
  homepageHeadline: '',
  defaultDeliveryRadius: 10,
  freeDeliveryThreshold: 200,
  standardDeliveryCharge: 50,
  allowGuestCheckout: false,
  metaTitle: '',
  metaDescription: '',
  loyaltyPointRupeeValue: 1,
  garageNames: [],
  street: '',
  city: '',
  state: '',
  pincode: '',
  panNumber: '',
  gstNumber: '',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const settingsQuery = useQuery({ queryKey: ['super-admin-site-settings'], queryFn: adminApi.siteSettings });

  const { register, handleSubmit, reset, control, formState: { isSubmitting, errors, isDirty } } = useForm<
    SettingsFormInput,
    undefined,
    SettingsFormOutput
  >({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsDefaultValues,
  });

  const { fields: garageFields, append: appendGarage, remove: removeGarage } = useFieldArray({
    control,
    name: 'garageNames' as never,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;

    reset({
      platformName: settingsQuery.data.platformName,
      supportEmail: settingsQuery.data.supportEmail || '',
      supportPhone: settingsQuery.data.supportPhone || '',
      homepageHeadline: settingsQuery.data.homepageHeadline || '',
      defaultDeliveryRadius: settingsQuery.data.defaultDeliveryRadius,
      freeDeliveryThreshold: settingsQuery.data.freeDeliveryThreshold,
      standardDeliveryCharge: settingsQuery.data.standardDeliveryCharge,
      allowGuestCheckout: settingsQuery.data.allowGuestCheckout,
      metaTitle: settingsQuery.data.metaTitle || '',
      metaDescription: settingsQuery.data.metaDescription || '',
      loyaltyPointRupeeValue: settingsQuery.data.loyaltyPointRupeeValue || 1,
      garageNames: settingsQuery.data.garageNames || [],
      street: settingsQuery.data.address?.street || '',
      city: settingsQuery.data.address?.city || '',
      state: settingsQuery.data.address?.state || '',
      pincode: settingsQuery.data.address?.pincode || '',
      panNumber: settingsQuery.data.panNumber || '',
      gstNumber: settingsQuery.data.gstNumber || '',
    });
  }, [reset, settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: SettingsFormOutput) => {
      const payload = {
        ...values,
        address: {
          street: values.street,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
        },
      };
      return adminApi.updateSiteSettings(payload);
    },
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
      <PageHeader title="Site Settings" subtitle="Configure platform-level settings, garage names, support details, and feature toggles." />
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <p className="mb-4 text-xs font-semibold text-slate-500">
         
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
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Free Delivery Threshold (Rs.)</label>
            <input type="number" {...register('freeDeliveryThreshold', { valueAsNumber: true })} placeholder="Free delivery above this amount" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.freeDeliveryThreshold ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.freeDeliveryThreshold ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.freeDeliveryThreshold.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Standard Delivery Charge (Rs.)</label>
            <input type="number" {...register('standardDeliveryCharge', { valueAsNumber: true })} placeholder="Charge if below threshold" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.standardDeliveryCharge ? 'border-rose-300' : 'border-primary-100'}`} />
            {errors.standardDeliveryCharge ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.standardDeliveryCharge.message}</p> : null}
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

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600 border-b border-primary-100 pb-2">Loyalty Points</h3>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Loyalty Point Value (Rupees)</label>
            <input type="number" step="0.01" {...register('loyaltyPointRupeeValue', { valueAsNumber: true })} placeholder="Rupee value of 1 point" className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 ${errors.loyaltyPointRupeeValue ? 'border-rose-300' : 'border-primary-100'}`} />
            <p className="mt-1 text-[10px] font-bold text-slate-400">Value of 1 loyalty point in INR. (e.g. 1 point = 1 Rupee)</p>
            {errors.loyaltyPointRupeeValue ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.loyaltyPointRupeeValue.message}</p> : null}
          </div>

          <div className="md:col-span-2 mt-4">
            <div className="flex items-center justify-between border-b border-primary-100 pb-2 mb-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600">Garages</h3>
              <button
                type="button"
                onClick={() => appendGarage('')}
                className="flex items-center gap-1.5 rounded-xl bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-100 transition"
              >
                <Plus size={14} />
                Add Garage
              </button>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {garageFields.map((field, index) => (
                <div key={field.id} className="relative flex items-center">
                  <input
                    {...register(`garageNames.${index}` as never)}
                    placeholder="Garage Name"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeGarage(index)}
                    className="absolute right-3 text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {garageFields.length === 0 && (
                <p className="col-span-full text-sm italic text-slate-400">No garages added yet.</p>
              )}
            </div>
            {errors.garageNames && <p className="mt-2 text-xs font-semibold text-rose-600">Please enter valid garage names</p>}
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-600 border-b border-primary-100 pb-2 mb-4">Platform Tax Details (B2B Invoices)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Street Address</label>
                <input {...register('street')} placeholder="Street" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">City</label>
                <input {...register('city')} placeholder="City" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">State</label>
                <input {...register('state')} placeholder="State" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Pincode</label>
                <input {...register('pincode')} placeholder="Pincode" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">PAN Number</label>
                <input {...register('panNumber')} placeholder="PAN" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">GST Registration No.</label>
                <input {...register('gstNumber')} placeholder="GSTIN" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
            </div>
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
