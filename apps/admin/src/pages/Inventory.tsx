import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter } from '../utils/format';
import type { DealerInventoryProduct } from '../types/admin';

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [inventorySearch, setInventorySearch] = useState(searchParams.get('inventory') || '');
  const [prevInventoryParam, setPrevInventoryParam] = useState(searchParams.get('inventory'));

  const [inventoryDraft, setInventoryDraft] = useState<Record<string, number>>({});
  const [prevInventoryData, setPrevInventoryData] = useState<DealerInventoryProduct[] | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ['admin-dealer-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  // Sync state with URL params during render
  if (searchParams.get('inventory') !== prevInventoryParam) {
    setPrevInventoryParam(searchParams.get('inventory'));
    setInventorySearch(searchParams.get('inventory') || '');
  }

  // Sync draft with query data during render
  if (inventoryQuery.data && inventoryQuery.data !== prevInventoryData) {
    setPrevInventoryData(inventoryQuery.data);
    const nextDraft: Record<string, number> = {};
    for (const product of inventoryQuery.data) {
      for (const variant of product.variants) {
        nextDraft[`${product.id}:${variant.id}`] = variant.quantity;
      }
    }
    setInventoryDraft(nextDraft);
  }

  const filteredInventory = useMemo(() => {
    const rows = inventoryQuery.data || [];
    const searchValue = inventorySearch.trim().toLowerCase();
    if (!searchValue) return rows;

    return rows.filter((product) => {
      return product.name.toLowerCase().includes(searchValue)
        || product.slug.toLowerCase().includes(searchValue);
    });
  }, [inventoryQuery.data, inventorySearch]);

  const changedInventoryEntries = useMemo(() => {
    if (!inventoryQuery.data) {
      return [] as Array<{ productId: string; variantId: string; quantity: number }>;
    }

    const rows: Array<{ productId: string; variantId: string; quantity: number }> = [];
    for (const product of inventoryQuery.data) {
      for (const variant of product.variants) {
        const key = `${product.id}:${variant.id}`;
        const nextQty = inventoryDraft[key];
        const initialQty = variant.quantity;
        if (typeof nextQty === 'number' && nextQty !== initialQty) {
          rows.push({
            productId: product.id,
            variantId: variant.id,
            quantity: Math.max(0, nextQty),
          });
        }
      }
    }

    return rows;
  }, [inventoryDraft, inventoryQuery.data]);

  const updateInventoryMutation = useMutation({
    mutationFn: (entries: Array<{ productId: string; variantId: string; quantity: number }>) => adminApi.updateInventory(entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dealer-inventory'] });
    },
  });

  if (inventoryQuery.isLoading) {
    return <LoadingBlock label="Loading dealer inventory..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Management"
        subtitle="Refill dealer stock quantities and manage product availability for your store."
      />

      <section className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Dealer Inventory</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Refill Quantities</h3>
          </div>
          <button
            type="button"
            disabled={changedInventoryEntries.length === 0 || updateInventoryMutation.isPending}
            onClick={() => updateInventoryMutation.mutate(changedInventoryEntries)}
            className="rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {updateInventoryMutation.isPending ? 'Saving...' : `Save Quantity (${changedInventoryEntries.length})`}
          </button>
        </div>

        <div className="mt-4">
          <label
            htmlFor="inventory-search"
            className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
          >
            Search Inventory
          </label>
          <input
            id="inventory-search"
            value={inventorySearch}
            onChange={(event) => setInventorySearch(event.target.value)}
            placeholder="Search inventory products"
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
        </div>

        <div className="mt-4 space-y-4">
          {filteredInventory.map((product) => (
            <div key={product.id} className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-12 w-12 rounded-xl object-cover border border-primary-100"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
                      <span className="text-[10px] font-black text-primary-400">N/A</span>
                    </div>
                  )}
                  <div>
                    <p className="font-black text-slate-900">{product.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{product.slug}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {product.variants.map((variant) => {
                  const key = `${product.id}:${variant.id}`;
                  const quantity = inventoryDraft[key] ?? 0;

                  return (
                    <div key={variant.id} className="rounded-xl border border-primary-100 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{variant.label}</p>
                          <p className="text-xs text-slate-500">{currencyFormatter.format(variant.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setInventoryDraft((prev) => ({
                                ...prev,
                                [key]: Math.max(0, (prev[key] ?? 0) - 1),
                              }))
                            }
                            className="h-8 w-8 rounded-lg border border-primary-200 text-lg font-black text-primary-700"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={quantity}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              setInventoryDraft((prev) => ({
                                ...prev,
                                [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                              }));
                            }}
                            className="w-20 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-center text-sm font-black text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setInventoryDraft((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))}
                            className="h-8 w-8 rounded-lg border border-primary-200 text-lg font-black text-primary-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredInventory.length === 0 ? (
            <p className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-600">
              No inventory product matched this search.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
