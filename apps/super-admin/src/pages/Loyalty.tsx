import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { Coins, Search, CheckCircle2, XCircle, Save, CheckSquare, Square } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_BASE_URL } from '../config/api';

function resolveMediaUrl(url?: string): string {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http')) return url;
  
  let base = '';
  if (API_BASE_URL.startsWith('http')) {
    try {
      base = new URL(API_BASE_URL).origin;
    } catch {
      base = '';
    }
  }
  
  if (!base && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vanikicrop.com')) {
      base = 'https://vanikicrop.com';
    } else {
      base = window.location.origin;
    }
  }
    
  const cleaned = url.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const path = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return `${base}${path}`;
}

const loyaltySchema = z.object({
  loyaltyPointRupeeValue: z.coerce.number().min(0, 'Point value cannot be negative'),
});

type LoyaltyFormInput = z.input<typeof loyaltySchema>;

export default function LoyaltyPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMaxPoints, setBulkMaxPoints] = useState<string>('');
  const [localMaxPoints, setLocalMaxPoints] = useState<Record<string, number>>({});

  const settingsQuery = useQuery({ 
    queryKey: ['super-admin-site-settings'], 
    queryFn: adminApi.siteSettings 
  });

  const productsQuery = useQuery({
    queryKey: ['admin-products-loyalty', searchTerm],
    queryFn: () => adminApi.products({ q: searchTerm, limit: 100 }),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<LoyaltyFormInput>({
    resolver: zodResolver(loyaltySchema),
    defaultValues: { loyaltyPointRupeeValue: 1 },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      reset({ loyaltyPointRupeeValue: settingsQuery.data.loyaltyPointRupeeValue || 1 });
    }
  }, [reset, settingsQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: (values: LoyaltyFormInput) => adminApi.updateSiteSettings(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-site-settings'] });
      setSaveSuccess('Loyalty value updated successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    },
    onError: (err) => setSaveError(err instanceof Error ? err.message : 'Update failed'),
  });

  const toggleProductLoyaltyMutation = useMutation({
    mutationFn: ({ id, eligible }: { id: string; eligible: boolean }) => {
      const payload = new FormData();
      payload.append('loyaltyPointEligible', String(eligible));
      return adminApi.updateProduct(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-loyalty'] });
    },
  });

  const updateProductMaxPointsMutation = useMutation({
    mutationFn: ({ id, maxPoints }: { id: string; maxPoints: number }) => {
      const payload = new FormData();
      payload.append('maxLoyaltyPoints', String(maxPoints));
      return adminApi.updateProduct(id, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-loyalty'] });
      setLocalMaxPoints(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, eligible, maxPoints }: { ids: string[]; eligible?: boolean; maxPoints?: number }) => {
      return Promise.all(ids.map(id => {
        const payload = new FormData();
        if (eligible !== undefined) payload.append('loyaltyPointEligible', String(eligible));
        if (maxPoints !== undefined) payload.append('maxLoyaltyPoints', String(maxPoints));
        return adminApi.updateProduct(id, payload);
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-loyalty'] });
      setSelectedIds([]);
      setBulkMaxPoints('');
    },
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (settingsQuery.isLoading) return <LoadingBlock label="Loading loyalty settings..." />;

  const products = productsQuery.data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Loyalty Management" 
        subtitle="Manage point values and product eligibility for the platform-wide loyalty system." 
      />

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-primary-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <Coins size={24} />
              </div>
              <h2 className="text-xl font-black text-slate-900">Point Value</h2>
            </div>

            <form onSubmit={handleSubmit((values) => updateSettingsMutation.mutate(values))} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">1 Point Value (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    {...register('loyaltyPointRupeeValue')} 
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 pl-8 pr-4 py-3 font-bold" 
                  />
                </div>
                <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-400">
                  This value determines how much discount 1 point provides at checkout.
                </p>
              </div>

              {saveSuccess && <p className="text-xs font-bold text-emerald-600">{saveSuccess}</p>}
              {saveError && <p className="text-xs font-bold text-rose-600">{saveError}</p>}

              <button 
                type="submit" 
                disabled={isSubmitting || !isDirty}
                className="w-full rounded-2xl bg-primary-500 py-3 text-sm font-black uppercase tracking-[0.15em] text-white disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Value'}
              </button>
            </form>
          </div>

          <div className="rounded-[1.75rem] border border-primary-100 bg-primary-900 p-6 text-white shadow-lg">
            <h3 className="text-lg font-black tracking-tight">System Summary</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm font-bold text-white/60">Active Products</span>
                <span className="text-xl font-black">{products.filter(p => p.loyaltyPointEligible).length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm font-bold text-white/60">Point Ratio</span>
                <span className="text-xl font-black">1 : ₹{settingsQuery.data?.loyaltyPointRupeeValue}</span>
              </div>
            </div>
          </div>
        </div>

          <div className="rounded-[1.75rem] border border-primary-100 bg-white shadow-sm overflow-hidden flex flex-col">
            {selectedIds.length > 0 && (
              <div className="bg-primary-900 p-4 flex flex-wrap items-center gap-4 animate-in slide-in-from-top duration-300">
                <span className="text-sm font-black text-white px-2">
                  {selectedIds.length} Products Selected
                </span>
                <div className="h-6 w-px bg-white/20" />
                <button
                  onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, eligible: true })}
                  className="rounded-xl bg-emerald-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/30 transition border border-emerald-500/30"
                >
                  Enable Loyalty
                </button>
                <button
                  onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, eligible: false })}
                  className="rounded-xl bg-rose-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-rose-400 hover:bg-rose-500/30 transition border border-rose-500/30"
                >
                  Disable Loyalty
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="number"
                    placeholder="Max Points"
                    value={bulkMaxPoints}
                    onChange={(e) => setBulkMaxPoints(e.target.value)}
                    className="w-32 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs font-bold text-white placeholder:text-white/40 outline-none focus:border-primary-400"
                  />
                  <button
                    disabled={!bulkMaxPoints}
                    onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, maxPoints: parseInt(bulkMaxPoints) })}
                    className="rounded-xl bg-primary-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-primary-400 disabled:opacity-50 transition shadow-lg shadow-primary-900/50"
                  >
                    Set Points
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-primary-50 bg-white sticky top-0 z-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-black text-slate-900">Product Eligibility</h2>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 py-2.5 pl-10 pr-4 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-primary-50 bg-primary-50/30">
                  <th className="px-6 py-4 w-10">
                    <button onClick={toggleSelectAll} className="text-primary-500 hover:text-primary-600 transition">
                      {selectedIds.length === products.length && products.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Product</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Eligibility</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Max Redeemable Points</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-50">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-primary-50/20 transition">
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelect(product.id)} className={cn("transition", selectedIds.includes(product.id) ? "text-primary-600" : "text-slate-300")}>
                          {selectedIds.includes(product.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={resolveMediaUrl(product.images?.[0]?.url)} 
                            className="h-10 w-10 rounded-lg object-cover bg-slate-100" 
                          />
                          <span className="text-sm font-bold text-slate-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleProductLoyaltyMutation.mutate({ 
                            id: product.id, 
                            eligible: !product.loyaltyPointEligible 
                          })}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition",
                            product.loyaltyPointEligible 
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          )}
                        >
                          {product.loyaltyPointEligible ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {product.loyaltyPointEligible ? 'Eligible' : 'Not Eligible'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={localMaxPoints[product.id] ?? product.maxLoyaltyPoints ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setLocalMaxPoints(prev => ({ ...prev, [product.id]: isNaN(val) ? 0 : val }));
                            }}
                            className="w-24 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {(localMaxPoints[product.id] !== undefined && localMaxPoints[product.id] !== product.maxLoyaltyPoints) && (
                            <button
                              onClick={() => updateProductMaxPointsMutation.mutate({ id: product.id, maxPoints: localMaxPoints[product.id] })}
                              className="rounded-xl bg-slate-900 p-2 text-white hover:bg-slate-800 transition shadow-md"
                            >
                              <Save size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-block rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                          product.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-bold text-slate-400">
                      {productsQuery.isLoading ? 'Loading products...' : 'No products found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
