import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Customer } from '../types/admin';
import { currencyFormatter, formatDate } from '../utils/format';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customersQuery = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => adminApi.customers({ search, limit: 100 }),
  });

  if (customersQuery.isLoading) return <LoadingBlock label="Loading customers..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="All Customers" subtitle="Read-only list of platform users across all stores." />
      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or mobile" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>

      <div className="grid gap-4">
        {customersQuery.data?.data.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => setSelectedCustomer(customer)}
            className="rounded-[1.5rem] border border-primary-100 bg-white p-4 text-left transition hover:bg-primary-50/40"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{customer.name}</p>
                <p className="mt-1 text-sm text-slate-500">{customer.mobile} · {customer.email || 'No email'}</p>
              </div>
              <div className="grid gap-1 text-left md:text-right">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{customer.isActive ? 'Active' : 'Inactive'}</p>
                <p className="text-sm font-semibold text-slate-600">{customer.orderCount} orders</p>
                <p className="text-sm font-semibold text-slate-600">Last order: {formatDate(customer.lastOrderDate)}</p>
                <p className="text-sm font-black text-primary-700">{currencyFormatter.format(customer.totalSpend)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-primary-100 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Customer Detail</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedCustomer.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3 rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4 text-sm text-slate-600">
              <p><span className="font-black text-slate-900">Customer ID:</span> {selectedCustomer.id}</p>
              <p><span className="font-black text-slate-900">Status:</span> {selectedCustomer.isActive ? 'Active' : 'Inactive'}</p>
              <p><span className="font-black text-slate-900">Mobile:</span> {selectedCustomer.mobile}</p>
              <p><span className="font-black text-slate-900">Email:</span> {selectedCustomer.email || '-'}</p>
              <p><span className="font-black text-slate-900">Total Orders:</span> {selectedCustomer.orderCount}</p>
              <p><span className="font-black text-slate-900">Last Order:</span> {formatDate(selectedCustomer.lastOrderDate)}</p>
              <p><span className="font-black text-slate-900">Total Spend:</span> {currencyFormatter.format(selectedCustomer.totalSpend)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
