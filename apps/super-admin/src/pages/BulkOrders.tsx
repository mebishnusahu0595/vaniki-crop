import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Box, Check, ChevronLeft, ChevronRight, PackageCheck, Search, Sparkles } from 'lucide-react';
import { adminApi } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { currencyFormatter } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';

export default function BulkOrdersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Local state for inline edited MOQ values: { [productId]: number }
  const [moqDrafts, setMoqDrafts] = useState<Record<string, number>>({});
  const [savedProductId, setSavedProductId] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['admin-bulk-products', search, category, page],
    queryFn: () => adminApi.products({ search, category, limit: 25, page }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-product-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });

  const updateMoqMutation = useMutation({
    mutationFn: async ({ id, moq }: { id: string; moq: number }) => {
      return adminApi.updateProductMoq(id, moq);
    },
    onSuccess: (data) => {
      setSavedProductId(data.id);
      setTimeout(() => setSavedProductId(null), 2000);
      queryClient.invalidateQueries({ queryKey: ['admin-bulk-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to update minimum order quantity.');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (moq: number) => {
      return adminApi.bulkUpdateMoq(moq);
    },
    onSuccess: (data: any) => {
      window.alert(`Successfully updated MOQ to ${data?.moq || 10} for all ${data?.count || 'active'} products!`);
      queryClient.invalidateQueries({ queryKey: ['admin-bulk-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to update products MOQ.');
    },
  });

  const pagination = productsQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const handlePageChange = (newPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (newPage > 1) next.set('page', String(newPage));
      else next.delete('page');
      return next;
    });
  };

  const handleMoqChange = (id: string, value: string) => {
    const parsed = parseInt(value, 10);
    setMoqDrafts((prev) => ({
      ...prev,
      [id]: isNaN(parsed) ? 1 : Math.max(1, parsed),
    }));
  };

  const handleSaveMoq = (product: any) => {
    const newMoq = moqDrafts[product.id] ?? product.moq ?? 1;
    updateMoqMutation.mutate({ id: product.id, moq: newMoq });
  };

  const products = productsQuery.data?.data || [];
  const totalProducts = pagination?.total || products.length;
  const bulkReadyCount = products.filter((p) => (p.moq || 1) > 1).length;

  if (productsQuery.isLoading) return <LoadingBlock label="Loading bulk ordering catalogue..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Bulk Ordering & MOQ"
          subtitle="Set Minimum Order Quantity (MOQ) per product for the Vaniki Dealers Play app."
        />
        <button
          type="button"
          disabled={bulkUpdateMutation.isPending}
          onClick={() => {
            if (window.confirm('Set Minimum Bulk Order Quantity to 10 for ALL products?')) {
              bulkUpdateMutation.mutate(10);
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1B4332] px-5 py-3 text-sm font-black text-white hover:bg-emerald-900 active:scale-95 transition-all shadow-sm shrink-0"
        >
          <Sparkles size={16} />
          {bulkUpdateMutation.isPending ? 'Updating All to 10...' : 'Set All Products MOQ to 10'}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-primary-100 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Box size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Total Products</p>
              <p className="text-2xl font-black text-slate-900">{totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <PackageCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Configured with Bulk MOQ (&gt;1)</p>
              <p className="text-2xl font-black text-emerald-700">{bulkReadyCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Dealers Play App</p>
              <p className="text-sm font-bold text-slate-700">Enforces MOQ on Checkout</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search products by name, tag, or SKU..."
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (val) next.set('search', val);
                else next.delete('search');
                next.delete('page');
                return next;
              });
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value;
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (val) next.set('category', val);
                else next.delete('category');
                next.delete('page');
                return next;
              });
            }}
            className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-700 focus:border-primary-500 focus:bg-white focus:outline-none"
          >
            <option value="">All Categories</option>
            {categoriesQuery.data?.data?.map((cat) => (
              <option key={cat.id} value={cat.slug || cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table with MOQ Column */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-4 pl-6 pr-3">Product</th>
                <th className="py-4 px-3">Category</th>
                <th className="py-4 px-3">Pricing (Per Unit)</th>
                <th className="py-4 px-3">Peti / Packaging</th>
                <th className="py-4 px-3 w-56">Min Order Quantity (MOQ)</th>
                <th className="py-4 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    No products found matching your filters.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const primaryImg = product.images?.find((img) => img.isPrimary) || product.images?.[0];
                  const currentMoq = moqDrafts[product.id] ?? product.moq ?? 1;
                  const isModified = moqDrafts[product.id] !== undefined && moqDrafts[product.id] !== (product.moq ?? 1);
                  const isSaved = savedProductId === product.id;
                  const defaultVariant = product.variants?.[0];

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Product Name & Image */}
                      <td className="py-4 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                            {primaryImg ? (
                              <img
                                src={resolveMediaUrl(primaryImg.url, primaryImg.publicId)}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <Box size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 leading-snug">{product.name}</p>
                            <p className="text-xs text-slate-400">{product.slug}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-3">
                        <span className="inline-flex rounded-xl bg-primary-50 px-2.5 py-1 text-xs font-black text-primary-700">
                          {product.category?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="py-4 px-3">
                        {defaultVariant ? (
                          <div>
                            <p className="font-black text-slate-900">{currencyFormatter.format(defaultVariant.price)}</p>
                            {defaultVariant.mrp > defaultVariant.price && (
                              <p className="text-xs text-slate-400 line-through">
                                {currencyFormatter.format(defaultVariant.mrp)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No variants</span>
                        )}
                      </td>

                      {/* Peti Size & Variant Specs */}
                      <td className="py-4 px-3">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 border border-emerald-200">
                            1 Peti = {product.petiSize || 10} {product.petiUnit || 'Units'}
                          </span>
                          {product.variants && product.variants.length > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-500">
                              {product.variants.map((v: any, vIdx: number) => {
                                const pcsInPeti = v.petiSize || (v.label?.includes('500') ? 20 : v.label?.includes('250') ? 40 : v.label?.includes('100') ? 80 : 10);
                                return (
                                  <span key={vIdx} className="font-semibold">
                                    • {v.label}: <strong className="text-slate-700">{pcsInPeti} pcs/peti</strong>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* MOQ / Peti Selection */}
                      <td className="py-4 px-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={currentMoq}
                              onChange={(e) => handleMoqChange(product.id, e.target.value)}
                              className={`w-24 rounded-xl border px-3 py-1.5 text-center text-sm font-black focus:outline-none focus:ring-2 ${
                                isModified
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-400/20'
                                  : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-primary-500 focus:ring-primary-500/20'
                              }`}
                            />
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-black text-slate-700">Units Min</span>
                              <span className="text-[10px] font-bold text-emerald-700">
                                ≈ {Math.max(1, Math.round(currentMoq / (product.petiSize || 10)))} Peti(s)
                              </span>
                            </div>
                          </div>

                          {/* Quick Peti Presets */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {[1, 2, 5, 10].map((petiCount) => {
                              const calculatedUnits = petiCount * (product.petiSize || 10);
                              return (
                                <button
                                  key={petiCount}
                                  type="button"
                                  onClick={() =>
                                    setMoqDrafts((prev) => ({
                                      ...prev,
                                      [product.id]: calculatedUnits,
                                    }))
                                  }
                                  className={`rounded-lg px-2 py-0.5 text-[10px] font-black transition-colors ${
                                    currentMoq === calculatedUnits
                                      ? 'bg-emerald-700 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title={`${petiCount} Peti = ${calculatedUnits} Units`}
                                >
                                  {petiCount} Peti
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 pl-3 pr-6 text-right">
                        {isSaved ? (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                            <Check size={14} /> Saved!
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={updateMoqMutation.isPending}
                            onClick={() => handleSaveMoq(product)}
                            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                              isModified
                                ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {updateMoqMutation.isPending ? 'Saving...' : isModified ? 'Update MOQ' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs font-bold text-slate-500">
              Page <span className="font-black text-slate-900">{page}</span> of{' '}
              <span className="font-black text-slate-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
