import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { currencyFormatter } from '../utils/format';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [actioningProductId, setActioningProductId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const productsQuery = useQuery({
    queryKey: ['admin-products', search, category],
    queryFn: () => adminApi.products({ search, category, limit: 100 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['admin-product-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append('isActive', String(isActive));
      return adminApi.updateProduct(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to update product status.');
    },
    onSettled: () => {
      setActioningProductId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to delete product.');
    },
    onSettled: () => {
      setActioningProductId(null);
    },
  });

  if (productsQuery.isLoading) return <LoadingBlock label="Loading products..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Create, edit, feature, or deactivate products for your store."
        action={
          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white"
          >
            <Plus size={16} />
            Add Product
          </Link>
        }
      />

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 md:grid-cols-[1fr_220px]">
        <input
          value={search}
          onChange={(event) => setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (event.target.value) next.set('search', event.target.value);
            else next.delete('search');
            return next;
          })}
          placeholder="Search by product name or tags"
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none"
        />
        <select
          value={category}
          onChange={(event) => setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (event.target.value) next.set('category', event.target.value);
            else next.delete('category');
            return next;
          })}
          className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none"
        >
          <option value="">All categories</option>
          {categoriesQuery.data?.data.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary-100 bg-white lg:block">
        <table className="min-w-full">
          <thead className="bg-primary-50/70">
            <tr className="text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Variants</th>
              <th className="px-5 py-4">Stock</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {productsQuery.data?.data.map((product) => {
              const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
              return (
                <tr key={product.id} className="border-t border-primary-100">
                  <td className="px-5 py-4">
                    <p className="font-black text-slate-900">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {product.variants[0] ? currencyFormatter.format(product.variants[0].price) : '-'}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{product.category?.name || '-'}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{product.variants.length}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{totalStock}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={async () => {
                        setActioningProductId(product.id);
                        await toggleActiveMutation.mutateAsync({ id: product.id, isActive: !product.isActive });
                      }}
                      disabled={actioningProductId === product.id}
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${
                        product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/products/${product.id}/edit`} className="rounded-xl border border-primary-100 p-2 text-slate-600 hover:text-slate-900">
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Deactivate ${product.name}?`)) return;
                          setActioningProductId(product.id);
                          await deleteMutation.mutateAsync(product.id);
                        }}
                        disabled={actioningProductId === product.id}
                        className="rounded-xl border border-rose-100 p-2 text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {productsQuery.data?.data.map((product) => (
          <div key={product.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{product.name}</p>
                <p className="mt-1 text-sm text-slate-500">{product.category?.name || 'Uncategorized'}</p>
              </div>
              <button
                onClick={async () => {
                  setActioningProductId(product.id);
                  await toggleActiveMutation.mutateAsync({ id: product.id, isActive: !product.isActive });
                }}
                disabled={actioningProductId === product.id}
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${
                  product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {product.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>{product.variants.length} variants</span>
              <span>{product.variants.reduce((sum, variant) => sum + variant.stock, 0)} total stock</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link to={`/products/${product.id}/edit`} className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Edit
              </Link>
              <button
                onClick={async () => {
                  if (!window.confirm(`Deactivate ${product.name}?`)) return;
                  setActioningProductId(product.id);
                  await deleteMutation.mutateAsync(product.id);
                }}
                disabled={actioningProductId === product.id}
                className="rounded-xl border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
