import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BarChart3, Users, X, Info } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Coupon } from '../types/admin';
import { formatDate } from '../utils/format';

const couponSchema = z.object({
  code: z.string().min(3),
  type: z.enum(['percent', 'flat']),
  value: z.coerce.number().min(1),
  minOrderAmount: z.coerce.number().min(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().min(1),
  perUserLimit: z.coerce.number().min(1).default(1),
  expiryDate: z.string().min(1),
  isActive: z.boolean().default(true),
  applicableStores: z.array(z.string()).default([]),
});

type CouponFormInput = z.input<typeof couponSchema>;
type CouponFormOutput = z.output<typeof couponSchema>;

const couponDefaultValues: CouponFormInput = {
  code: '',
  type: 'percent',
  value: 0,
  minOrderAmount: 0,
  maxDiscount: 0,
  usageLimit: 1,
  perUserLimit: 1,
  expiryDate: '',
  isActive: true,
  applicableStores: [],
};

function toExpiryDateValue(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:59.000Z`;
  }
  return new Date(trimmed).toISOString();
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [viewingUsage, setViewingUsage] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const couponsQuery = useQuery({ queryKey: ['admin-coupons'], queryFn: adminApi.coupons });
  const storesQuery = useQuery({ queryKey: ['coupon-store-options'], queryFn: () => adminApi.stores({ limit: 200 }) });
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<
    CouponFormInput,
    undefined,
    CouponFormOutput
  >({
    resolver: zodResolver(couponSchema),
    defaultValues: couponDefaultValues,
  });

  useEffect(() => {
    if (!editing) {
      reset(couponDefaultValues);
      return;
    }

    reset({
      code: editing.code,
      type: editing.type,
      value: editing.value,
      minOrderAmount: editing.minOrderAmount,
      maxDiscount: editing.maxDiscount ?? 0,
      usageLimit: editing.usageLimit,
      perUserLimit: editing.perUserLimit || 1,
      expiryDate: editing.expiryDate.slice(0, 10),
      isActive: editing.isActive,
      applicableStores: (editing.applicableStores || []).map((store) => store.id),
    });
  }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: CouponFormOutput) => {
      setFormError('');
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
        expiryDate: toExpiryDateValue(values.expiryDate),
        applicableStores: values.applicableStores ?? [],
        maxDiscount: values.type === 'percent' ? values.maxDiscount : undefined,
      };

      return editing ? adminApi.updateCoupon(editing.id, payload) : adminApi.createCoupon(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setEditing(null);
      setFormError('');
      reset(couponDefaultValues);
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Unable to save coupon.');
    },
  });

  if (couponsQuery.isLoading) return <LoadingBlock label="Loading coupons..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Global Coupons" subtitle="Create coupons for all stores or target specific stores." />
        <form
          onSubmit={handleSubmit((values) => {
            setFormError('');
            mutation.mutate(values);
          })}
          className="mt-6 space-y-4"
        >
          <p className="text-xs font-semibold text-slate-500">
           
          </p>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Coupon Code</label>
            <input {...register('code')} placeholder="Code" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Discount Type</label>
              <select {...register('type')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Discount Value</label>
              <input type="number" {...register('value', { valueAsNumber: true })} placeholder="Value" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Minimum Order Amount</label>
              <input type="number" {...register('minOrderAmount', { valueAsNumber: true })} placeholder="Min Order" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Max Discount (percent type)</label>
              <input type="number" {...register('maxDiscount', { valueAsNumber: true })} placeholder="Max Discount" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Usage Limit (Global)</label>
                <input type="number" {...register('usageLimit', { valueAsNumber: true })} placeholder="Global Limit" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Per-User Limit</label>
                <input type="number" {...register('perUserLimit', { valueAsNumber: true })} placeholder="Limit per user" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Expiry Date</label>
              <input type="date" {...register('expiryDate')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Applicable Stores (leave empty for ALL stores)
            </label>
            <select
              multiple
              {...register('applicableStores')}
              className="min-h-[150px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
            >
              {storesQuery.data?.data.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Active coupon</span>
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? 'Update Coupon' : 'Create Coupon'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormError('');
                  reset(couponDefaultValues);
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
        {couponsQuery.data?.map((coupon) => (
          <div key={coupon.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{coupon.code}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {coupon.type} · global {coupon.usedCount}/{coupon.usageLimit} · user limit {coupon.perUserLimit} · expires {formatDate(coupon.expiryDate)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                  {(coupon.applicableStores?.length || 0) === 0
                    ? 'Applies to all stores'
                    : `Applies to ${coupon.applicableStores?.map((store) => store.name).join(', ')}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingUsage(coupon.id)}
                  className="rounded-xl border border-primary-100 bg-primary-50 p-2 text-primary-700 hover:bg-primary-100"
                  title="View Usage Statistics"
                >
                  <BarChart3 size={18} />
                </button>
                <button onClick={() => setEditing(coupon)} className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700">Edit</button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${coupon.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {coupon.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={async () => {
                  if (!window.confirm(`Deactivate ${coupon.code}?`)) return;
                  try {
                    await adminApi.deleteCoupon(coupon.id);
                    queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
                  } catch (error) {
                    window.alert(error instanceof Error ? error.message : 'Unable to deactivate coupon.');
                  }
                }}
                className="text-sm font-semibold text-rose-600"
              >
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>
      {viewingUsage && <UsageModal couponId={viewingUsage} onClose={() => setViewingUsage(null)} />}
    </div>
  );
}

function UsageModal({ couponId, onClose }: { couponId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['coupon-usage', couponId],
    queryFn: () => adminApi.couponUsage(couponId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-primary-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-primary-50 px-8 py-6">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Coupon Usage: <span className="text-primary-600">{data?.coupon.code || '...'}</span>
            </h3>
            <p className="text-sm font-medium text-slate-500">Detailed analytics and user usage history</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="animate-pulse font-black uppercase tracking-widest text-primary-300">Loading Stats...</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-primary-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary-600">
                    <BarChart3 size={14} />
                    Total Usage
                  </div>
                  <p className="mt-2 text-3xl font-black text-primary-900">
                    {data.totalUsageCount} <span className="text-sm font-medium text-primary-400">/ {data.coupon.usageLimit}</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600">
                    <Users size={14} />
                    Unique Users
                  </div>
                  <p className="mt-2 text-3xl font-black text-indigo-900">{data.uniqueUsersCount}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-600">
                    <Info size={14} />
                    Per-User Limit
                  </div>
                  <p className="mt-2 text-3xl font-black text-emerald-900">{data.coupon.perUserLimit}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-slate-500">User Usage List</h4>
                {data.userWiseUsage.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-primary-50">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-primary-50/50">
                        <tr>
                          <th className="px-6 py-4 font-black text-slate-700">User</th>
                          <th className="px-6 py-4 font-black text-slate-700 text-center">Uses</th>
                          <th className="px-6 py-4 font-black text-slate-700 text-right">Total Savings</th>
                          <th className="px-6 py-4 font-black text-slate-700 text-right">Last Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-50">
                        {data.userWiseUsage.map((usage) => (
                          <tr key={usage.userId} className="hover:bg-primary-50/20">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{usage.userName}</p>
                              <p className="text-xs text-slate-500">{usage.userMobile}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-black text-slate-700">
                                {usage.usageCount}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-emerald-600">
                              ₹{usage.totalSavings.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-500">
                              {formatDate(usage.lastUsed)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-primary-100 py-12 text-center">
                    <p className="font-semibold text-slate-400">This coupon hasn't been used by any users yet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-400">No usage data found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
