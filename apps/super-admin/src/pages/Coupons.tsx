import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Tag,
  Plus,
  Search,
  Check,
  Copy,
  Clock,
  Globe,
  Store as StoreIcon,
  BarChart3,
  Edit2,
  Trash2,
  Power,
  Users,
  X,
  Sparkles,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Coupon } from '../types/admin';
import { formatDate, currencyFormatter } from '../utils/format';

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(30, 'Code cannot exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/i, 'Code can only contain letters, numbers, hyphens and underscores'),
    type: z.enum(['percent', 'flat']).default('percent'),
    value: z.coerce.number().positive('Discount value must be greater than 0'),
    minOrderAmount: z.coerce.number().min(0).optional().default(0),
    maxDiscount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(1).optional().default(1000),
    perUserLimit: z.coerce.number().int().min(1).optional().default(1),
    expiryDate: z.string().optional(),
    isActive: z.boolean().default(true),
    storeScope: z.enum(['all', 'specific']).default('all'),
    applicableStores: z.array(z.string()).default([]),
  })
  .refine(
    (data) => {
      if (data.type === 'percent' && data.value > 100) return false;
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    },
  );

type CouponFormValues = z.input<typeof couponSchema>;

function getDefaultExpiryDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1); // 1 year ahead default
  return d.toISOString().slice(0, 10);
}

const defaultValues: CouponFormValues = {
  code: '',
  type: 'percent',
  value: undefined as unknown as number,
  minOrderAmount: 0,
  maxDiscount: undefined,
  usageLimit: 1000,
  perUserLimit: 1,
  expiryDate: getDefaultExpiryDate(),
  isActive: true,
  storeScope: 'all',
  applicableStores: [],
};

function toExpiryDateISO(value?: string): string {
  if (!value || !value.trim()) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:59.000Z`;
  }
  return new Date(trimmed).toISOString();
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [viewingUsageId, setViewingUsageId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'percent' | 'flat'>('all');
  const [storeSearch, setStoreSearch] = useState('');
  const [formSubmitError, setFormSubmitError] = useState('');

  const couponsQuery = useQuery({ queryKey: ['admin-coupons'], queryFn: adminApi.coupons });
  const storesQuery = useQuery({ queryKey: ['coupon-store-options'], queryFn: () => adminApi.stores({ limit: 300 }) });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues,
  });

  const watchType = watch('type');
  const watchStoreScope = watch('storeScope');
  const watchApplicableStores = watch('applicableStores') || [];

  useEffect(() => {
    if (editingCoupon) {
      const hasStores = (editingCoupon.applicableStores || []).length > 0;
      reset({
        code: editingCoupon.code,
        type: editingCoupon.type,
        value: editingCoupon.value,
        minOrderAmount: editingCoupon.minOrderAmount,
        maxDiscount: editingCoupon.maxDiscount ?? 0,
        usageLimit: editingCoupon.usageLimit,
        perUserLimit: editingCoupon.perUserLimit || 1,
        expiryDate: editingCoupon.expiryDate.slice(0, 10),
        isActive: editingCoupon.isActive,
        storeScope: hasStores ? 'specific' : 'all',
        applicableStores: (editingCoupon.applicableStores || []).map((s) => s.id),
      });
      setFormSubmitError('');
      setIsModalOpen(true);
    }
  }, [editingCoupon, reset]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormSubmitError('');
    reset({
      ...defaultValues,
      expiryDate: getDefaultExpiryDate(),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setFormSubmitError('');
    reset(defaultValues);
  };

  const saveMutation = useMutation({
    mutationFn: (values: CouponFormValues) => {
      setFormSubmitError('');
      const payload = {
        code: values.code.trim().toUpperCase(),
        type: values.type,
        value: Number(values.value),
        minOrderAmount: Number(values.minOrderAmount || 0),
        maxDiscount: values.type === 'percent' && values.maxDiscount ? Number(values.maxDiscount) : undefined,
        usageLimit: Number(values.usageLimit),
        perUserLimit: Number(values.perUserLimit || 1),
        expiryDate: toExpiryDateISO(values.expiryDate),
        isActive: values.isActive ?? true,
        applicableStores: values.storeScope === 'all' ? [] : (values.applicableStores || []),
      };

      return editingCoupon
        ? adminApi.updateCoupon(editingCoupon.id, payload)
        : adminApi.createCoupon(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      closeModal();
    },
    onError: (err) => {
      setFormSubmitError(err instanceof Error ? err.message : 'Unable to save coupon. Please check fields.');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateCoupon(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Failed to update coupon status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Failed to delete coupon');
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const allCoupons = couponsQuery.data || [];
  const allStores = storesQuery.data?.data || [];

  // Summary Metrics
  const stats = useMemo(() => {
    const total = allCoupons.length;
    const now = new Date();
    const active = allCoupons.filter((c) => c.isActive && new Date(c.expiryDate) > now).length;
    const expired = allCoupons.filter((c) => new Date(c.expiryDate) <= now).length;
    const totalUsage = allCoupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    const globalCount = allCoupons.filter((c) => !c.applicableStores || c.applicableStores.length === 0).length;

    return { total, active, expired, totalUsage, globalCount };
  }, [allCoupons]);

  // Filtered List
  const filteredCoupons = useMemo(() => {
    const now = new Date();
    return allCoupons.filter((coupon) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = coupon.code.toLowerCase().includes(q);
        const storeMatch = coupon.applicableStores?.some((s) => s.name.toLowerCase().includes(q));
        if (!codeMatch && !storeMatch) return false;
      }

      // Status
      const isExpired = new Date(coupon.expiryDate) <= now;
      if (statusFilter === 'active' && (!coupon.isActive || isExpired)) return false;
      if (statusFilter === 'inactive' && coupon.isActive) return false;
      if (statusFilter === 'expired' && !isExpired) return false;

      // Type
      if (typeFilter !== 'all' && coupon.type !== typeFilter) return false;

      return true;
    });
  }, [allCoupons, searchQuery, statusFilter, typeFilter]);

  // Filtered Stores in Modal
  const filteredModalStores = useMemo(() => {
    if (!storeSearch.trim()) return allStores;
    const q = storeSearch.toLowerCase();
    return allStores.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.address?.city || '').toLowerCase().includes(q),
    );
  }, [allStores, storeSearch]);

  const handleSelectAllStores = () => {
    setValue('applicableStores', allStores.map((s) => s.id), { shouldValidate: true });
  };

  const handleDeselectAllStores = () => {
    setValue('applicableStores', [], { shouldValidate: true });
  };

  const toggleSingleStore = (storeId: string) => {
    const current = watchApplicableStores;
    if (current.includes(storeId)) {
      setValue('applicableStores', current.filter((id) => id !== storeId), { shouldValidate: true });
    } else {
      setValue('applicableStores', [...current, storeId], { shouldValidate: true });
    }
  };

  if (couponsQuery.isLoading && !couponsQuery.data) return <LoadingBlock label="Loading coupons..." />;

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Promo Codes & Discounts"
          subtitle="Create, configure, and monitor discount coupons across all stores or specific locations."
        />
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2.5 rounded-2xl bg-primary-600 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-primary-500/25 transition-all hover:bg-primary-700 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          <span>Create Coupon</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Coupons</span>
            <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
              <Tag size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">{stats.total}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {stats.globalCount} apply to <span className="font-bold text-primary-700">All Stores</span>
          </p>
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Active Live</span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <Sparkles size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-700">{stats.active}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Currently redeemable by users</p>
        </div>

        <div className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Total Redemptions</span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-indigo-900">{stats.totalUsage}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Orders completed with discount</p>
        </div>

        <div className="rounded-[2rem] border border-amber-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Expired</span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Clock size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-amber-700">{stats.expired}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Past validity date</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-primary-100 bg-white p-4 shadow-sm">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by coupon code or store..."
            className="w-full rounded-2xl border border-primary-100 bg-primary-50/50 py-3 pl-11 pr-4 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-primary-50 p-1">
          {(['all', 'active', 'expired', 'inactive'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                statusFilter === st
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 rounded-2xl bg-primary-50 p-1">
          {(['all', 'percent', 'flat'] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setTypeFilter(tp)}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                typeFilter === tp
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tp === 'percent' ? '% Percent' : tp === 'flat' ? '₹ Flat' : 'All Types'}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCoupons.map((coupon) => {
          const isExpired = new Date(coupon.expiryDate) <= new Date();
          const isGlobal = !coupon.applicableStores || coupon.applicableStores.length === 0;
          const usagePercent = Math.min(100, Math.round(((coupon.usedCount || 0) / coupon.usageLimit) * 100));

          return (
            <div
              key={coupon.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border bg-white p-7 shadow-sm transition-all hover:shadow-xl ${
                !coupon.isActive || isExpired
                  ? 'border-slate-200 opacity-80'
                  : 'border-primary-100 hover:border-primary-300'
              }`}
            >
              {/* Card Header with Discount Badge & Status */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        coupon.type === 'percent'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {coupon.type === 'percent' ? (
                        <span className="text-base font-black">{coupon.value}%</span>
                      ) : (
                        <span className="text-sm font-black">₹{coupon.value}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {coupon.type === 'percent' ? 'Percentage OFF' : 'Flat Discount'}
                      </span>
                      <p className="text-lg font-black text-slate-900">
                        {coupon.type === 'percent' ? `${coupon.value}% OFF` : `₹${coupon.value} FLAT`}
                      </p>
                    </div>
                  </div>

                  {/* Status Pill */}
                  {isExpired ? (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                      Expired
                    </span>
                  ) : coupon.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Coupon Code Strip with Copy */}
                <div className="mt-6 flex items-center justify-between rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 p-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Coupon Code</span>
                    <p className="font-mono text-base font-black tracking-wider text-primary-800">{coupon.code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(coupon.code)}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-primary-700 shadow-sm hover:bg-primary-100 transition"
                    title="Copy code"
                  >
                    {copiedCode === coupon.code ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Details / Constraints */}
                <div className="mt-6 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-400">Min Order:</span>
                    <span className="font-bold text-slate-800">
                      {coupon.minOrderAmount > 0 ? currencyFormatter.format(coupon.minOrderAmount) : 'No Minimum'}
                    </span>
                  </div>

                  {coupon.type === 'percent' && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-400">Max Cap:</span>
                      <span className="font-bold text-slate-800">
                        {coupon.maxDiscount ? currencyFormatter.format(coupon.maxDiscount) : 'No Limit'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-400">Per User Limit:</span>
                    <span className="font-bold text-slate-800">
                      {coupon.perUserLimit || 1} {coupon.perUserLimit === 1 ? 'time' : 'times'} / user
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-400">Valid Until:</span>
                    <span className="font-bold text-slate-800">{formatDate(coupon.expiryDate)}</span>
                  </div>

                  {/* Scope Badge */}
                  <div className="pt-2">
                    {isGlobal ? (
                      <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 border border-emerald-100">
                        <Globe size={14} className="text-emerald-600" />
                        <span>All Stores (Global Network)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 border border-amber-100">
                        <StoreIcon size={14} className="text-amber-600" />
                        <span className="truncate">
                          {coupon.applicableStores?.length} Store(s):{' '}
                          {coupon.applicableStores?.map((s) => s.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                      <span>Redeemed</span>
                      <span>
                        {coupon.usedCount || 0} / {coupon.usageLimit} ({usagePercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent >= 90
                            ? 'bg-rose-500'
                            : usagePercent >= 50
                            ? 'bg-amber-500'
                            : 'bg-primary-500'
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setViewingUsageId(coupon.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100 transition"
                  title="View Analytics"
                >
                  <BarChart3 size={14} />
                  <span>Stats</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleStatusMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })
                    }
                    className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      coupon.isActive
                        ? 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-800'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                    title={coupon.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <Power size={13} />
                    <span>{coupon.isActive ? 'Pause' : 'Activate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingCoupon(coupon)}
                    className="flex items-center gap-1 rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs font-bold text-primary-700 hover:bg-primary-50"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete coupon ${coupon.code}?`)) {
                        deleteMutation.mutate(coupon.id);
                      }
                    }}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Delete Coupon"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCoupons.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
            <div className="mb-4 rounded-full bg-white p-6 shadow-md text-slate-300">
              <Tag size={40} />
            </div>
            <h3 className="text-lg font-black text-slate-900">No coupons found</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try clearing your filters or search terms.'
                : 'Create your first discount coupon to get started.'}
            </p>
            <button
              onClick={openCreateModal}
              className="mt-5 rounded-2xl bg-primary-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-primary-500/20"
            >
              + Create Coupon Now
            </button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT COUPON MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white p-8 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                  <Tag size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Promo Coupon'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    Configure discount rules, usage limits, and store applicability
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="mt-6 space-y-6">
              {formSubmitError && (
                <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700 border border-rose-200">
                  <AlertCircle size={16} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {/* Coupon Code & Discount Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Coupon Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    {...register('code')}
                    placeholder="e.g. MONSOON50 or KRISHI20"
                    className="w-full uppercase font-mono tracking-wider rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.code && <p className="mt-1 text-xs font-bold text-rose-600">{errors.code.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Discount Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...register('type')}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  >
                    <option value="percent">Percentage (%) Discount</option>
                    <option value="flat">Flat Rupee (₹) Discount</option>
                  </select>
                  {errors.type && <p className="mt-1 text-xs font-bold text-rose-600">{errors.type.message}</p>}
                </div>
              </div>

              {/* Discount Value & Max Discount */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    {watchType === 'percent' ? 'Discount Percentage (%)' : 'Flat Discount (₹)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('value', { valueAsNumber: true })}
                    placeholder={watchType === 'percent' ? 'e.g. 15 for 15%' : 'e.g. 100 for ₹100'}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.value && <p className="mt-1 text-xs font-bold text-rose-600">{errors.value.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    {watchType === 'percent' ? 'Max Discount Cap (₹) (Optional)' : 'Max Discount (N/A for Flat)'}
                  </label>
                  <input
                    type="number"
                    disabled={watchType === 'flat'}
                    {...register('maxDiscount', { valueAsNumber: true })}
                    placeholder="e.g. 500 (leave blank for no limit)"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition disabled:opacity-40"
                  />
                  {errors.maxDiscount && (
                    <p className="mt-1 text-xs font-bold text-rose-600">{errors.maxDiscount.message}</p>
                  )}
                </div>
              </div>

              {/* Min Order & Expiry Date */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Minimum Order Amount (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    {...register('minOrderAmount', { valueAsNumber: true })}
                    placeholder="0 for no minimum"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.minOrderAmount && (
                    <p className="mt-1 text-xs font-bold text-rose-600">{errors.minOrderAmount.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Expiry Date <span className="text-slate-400 font-normal">(Optional - defaults to 1 year)</span>
                  </label>
                  <input
                    type="date"
                    {...register('expiryDate')}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.expiryDate && (
                    <p className="mt-1 text-xs font-bold text-rose-600">{errors.expiryDate.message}</p>
                  )}
                </div>
              </div>

              {/* Usage Limit & Per-User Limit */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Total Global Usage Limit <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    {...register('usageLimit', { valueAsNumber: true })}
                    placeholder="default 1000 redemptions"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.usageLimit && (
                    <p className="mt-1 text-xs font-bold text-rose-600">{errors.usageLimit.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Per-User Limit <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    {...register('perUserLimit', { valueAsNumber: true })}
                    placeholder="default 1 per customer"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition"
                  />
                  {errors.perUserLimit && (
                    <p className="mt-1 text-xs font-bold text-rose-600">{errors.perUserLimit.message}</p>
                  )}
                </div>
              </div>

              {/* STORE SELECTION: ALL STORES VS SPECIFIC STORES */}
              <div className="rounded-[2rem] border border-primary-100 bg-primary-50/40 p-5 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">
                    Applicable Stores
                  </label>

                  {/* Scope Selector Pills */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setValue('storeScope', 'all');
                        setValue('applicableStores', []);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-2xl p-3.5 text-xs font-black uppercase tracking-wider transition ${
                        watchStoreScope === 'all'
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Globe size={16} />
                      <span>All Stores (Global)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue('storeScope', 'specific')}
                      className={`flex items-center justify-center gap-2 rounded-2xl p-3.5 text-xs font-black uppercase tracking-wider transition ${
                        watchStoreScope === 'specific'
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <StoreIcon size={16} />
                      <span>Specific Stores</span>
                    </button>
                  </div>
                </div>

                {/* Specific Store Checkbox Selector */}
                {watchStoreScope === 'specific' && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={storeSearch}
                          onChange={(e) => setStoreSearch(e.target.value)}
                          placeholder="Search stores..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllStores}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-200"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllStores}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-200"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {filteredModalStores.map((store) => {
                        const isChecked = watchApplicableStores.includes(store.id);
                        return (
                          <label
                            key={store.id}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                              isChecked ? 'bg-primary-50 text-primary-900 border border-primary-200' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSingleStore(store.id)}
                                className="h-4 w-4 rounded accent-primary-600"
                              />
                              <span>{store.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">{store.address?.city || ''}</span>
                          </label>
                        );
                      })}
                      {filteredModalStores.length === 0 && (
                        <p className="py-4 text-center text-xs font-bold text-slate-400">No stores match search.</p>
                      )}
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
                      <span>Selected: {watchApplicableStores.length} stores</span>
                      {errors.applicableStores && (
                        <span className="text-rose-600">{errors.applicableStores.message}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 cursor-pointer">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-800">Coupon Active Status</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    Enable or disable this coupon immediately for checkout
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-5 w-5 rounded-lg accent-primary-600 cursor-pointer"
                />
              </label>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || saveMutation.isPending}
                  className="flex items-center gap-2 rounded-2xl bg-primary-600 px-8 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? 'Saving...'
                    : editingCoupon
                    ? 'Update Coupon'
                    : 'Save & Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USAGE ANALYTICS MODAL */}
      {viewingUsageId && <UsageModal couponId={viewingUsageId} onClose={() => setViewingUsageId(null)} />}
    </div>
  );
}

function UsageModal({ couponId, onClose }: { couponId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['coupon-usage', couponId],
    queryFn: () => adminApi.couponUsage(couponId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-primary-50 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Coupon Analytics: <span className="text-primary-600">{data?.coupon?.code || '...'}</span>
              </h3>
              <p className="text-xs font-medium text-slate-500">Detailed usage statistics and customer redemptions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <p className="animate-pulse font-black uppercase tracking-widest text-primary-300">Loading Stats...</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[2rem] bg-primary-50/70 p-6 border border-primary-100">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary-700">
                    <BarChart3 size={16} />
                    Total Redemptions
                  </div>
                  <p className="mt-3 text-3xl font-black text-primary-950">
                    {data.totalUsageCount}{' '}
                    <span className="text-sm font-medium text-primary-600">/ {data.coupon.usageLimit}</span>
                  </p>
                </div>

                <div className="rounded-[2rem] bg-indigo-50/70 p-6 border border-indigo-100">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-700">
                    <Users size={16} />
                    Unique Customers
                  </div>
                  <p className="mt-3 text-3xl font-black text-indigo-950">{data.uniqueUsersCount}</p>
                </div>

                <div className="rounded-[2rem] bg-emerald-50/70 p-6 border border-emerald-100">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                    <Tag size={16} />
                    Per-User Limit
                  </div>
                  <p className="mt-3 text-3xl font-black text-emerald-950">
                    {data.coupon.perUserLimit || 1}{' '}
                    <span className="text-sm font-medium text-emerald-600">orders / user</span>
                  </p>
                </div>
              </div>

              {/* User-Wise Usage Table */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 mb-4">
                  Customer Redemptions History
                </h4>
                {data.userWiseUsage && data.userWiseUsage.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Times Used</th>
                          <th className="px-4 py-3">Total Savings</th>
                          <th className="px-4 py-3">Last Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                        {data.userWiseUsage.map((userUsage, idx) => (
                          <tr key={userUsage.userId || idx} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 text-slate-900">{userUsage.userName || 'Customer'}</td>
                            <td className="px-4 py-3 text-slate-500">{userUsage.userMobile || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-primary-50 px-2 py-0.5 text-primary-700 font-black">
                                {userUsage.usageCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-emerald-700 font-black">
                              {currencyFormatter.format(userUsage.totalSavings || 0)}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{formatDate(userUsage.lastUsed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                    <p className="text-xs font-bold text-slate-400">No customers have redeemed this coupon yet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-rose-600">Failed to load statistics.</p>
          )}
        </div>
      </div>
    </div>
  );
}
