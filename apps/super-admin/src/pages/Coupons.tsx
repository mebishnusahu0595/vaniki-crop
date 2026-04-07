import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
  expiryDate: '',
  isActive: true,
  applicableStores: [],
};

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Coupon | null>(null);
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
      expiryDate: editing.expiryDate.slice(0, 10),
      isActive: editing.isActive,
      applicableStores: (editing.applicableStores || []).map((store) => store.id),
    });
  }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: CouponFormOutput) =>
      editing
        ? adminApi.updateCoupon(editing.id, {
            ...values,
            expiryDate: new Date(values.expiryDate).toISOString(),
          })
        : adminApi.createCoupon({
            ...values,
            expiryDate: new Date(values.expiryDate).toISOString(),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setEditing(null);
      reset(couponDefaultValues);
    },
  });

  if (couponsQuery.isLoading) return <LoadingBlock label="Loading coupons..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Global Coupons" subtitle="Create coupons for all stores or target specific stores." />
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="mt-6 space-y-4">
          <input {...register('code')} placeholder="Code" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div className="grid gap-3 md:grid-cols-2">
            <select {...register('type')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
              <option value="percent">Percent</option>
              <option value="flat">Flat</option>
            </select>
            <input type="number" {...register('value', { valueAsNumber: true })} placeholder="Value" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" {...register('minOrderAmount', { valueAsNumber: true })} placeholder="Min Order" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" {...register('maxDiscount', { valueAsNumber: true })} placeholder="Max Discount" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" {...register('usageLimit', { valueAsNumber: true })} placeholder="Usage Limit" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="date" {...register('expiryDate')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
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
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              {editing ? 'Update Coupon' : 'Create Coupon'}
            </button>
            {editing ? <button type="button" onClick={() => { setEditing(null); reset(couponDefaultValues); }} className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600">Cancel</button> : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {couponsQuery.data?.map((coupon) => (
          <div key={coupon.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{coupon.code}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {coupon.type} · used {coupon.usedCount}/{coupon.usageLimit} · expires {formatDate(coupon.expiryDate)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                  {(coupon.applicableStores?.length || 0) === 0
                    ? 'Applies to all stores'
                    : `Applies to ${coupon.applicableStores?.map((store) => store.name).join(', ')}`}
                </p>
              </div>
              <button onClick={() => setEditing(coupon)} className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700">Edit</button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${coupon.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {coupon.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={async () => {
                  if (!window.confirm(`Deactivate ${coupon.code}?`)) return;
                  await adminApi.deleteCoupon(coupon.id);
                  queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
                }}
                className="text-sm font-semibold text-rose-600"
              >
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
