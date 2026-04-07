import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDate } from '../utils/format';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const customersQuery = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => adminApi.customers({ search, limit: 100 }),
  });

  if (customersQuery.isLoading) return <LoadingBlock label="Loading customers..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Read-only list of customers who have ordered from this store." />
      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or mobile" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>

      <div className="grid gap-4">
        {customersQuery.data?.data.map((customer) => (
          <div key={customer.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{customer.name}</p>
                <p className="mt-1 text-sm text-slate-500">{customer.mobile} · {customer.email || 'No email'}</p>
              </div>
              <div className="grid gap-1 text-left md:text-right">
                <p className="text-sm font-semibold text-slate-600">{customer.orderCount} orders</p>
                <p className="text-sm font-semibold text-slate-600">Last order: {formatDate(customer.lastOrderDate)}</p>
                <p className="text-sm font-black text-primary-700">{currencyFormatter.format(customer.totalSpend)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
