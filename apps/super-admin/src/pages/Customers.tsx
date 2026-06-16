import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowUpDown, TrendingUp, DollarSign, User, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Customer } from '../types/admin';
import { currencyFormatter, formatDate } from '../utils/format';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  isActive: z.boolean(),
});

type CustomerFormInput = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Filters and Sorting States
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'orders' | 'spend' | 'lastOrder' | 'dateJoined' | 'name'>('lastOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals & Details State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Alerts
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const customersQuery = useQuery({
    queryKey: ['admin-customers', debouncedSearch, statusFilter, sortBy, sortOrder],
    queryFn: () =>
      adminApi.customers({
        search: debouncedSearch,
        isActive: statusFilter === 'all' ? undefined : statusFilter,
        sortBy,
        sortOrder,
        limit: 100,
      }),
  });

  const customers = customersQuery.data?.data || [];

  // Find selected customer within react query data so it reacts to updates automatically
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Calculate high-level insights locally
  const insights = useMemo(() => {
    if (!customers.length) return null;
    const topBuyer = [...customers].sort((a, b) => b.orderCount - a.orderCount)[0];
    const topSpender = [...customers].sort((a, b) => b.totalSpend - a.totalSpend)[0];

    const productCounts: Record<string, number> = {};
    customers.forEach((c) => {
      if (c.mostBoughtProduct && c.mostBoughtProduct !== '-') {
        productCounts[c.mostBoughtProduct] = (productCounts[c.mostBoughtProduct] || 0) + c.orderCount;
      }
    });
    const topPopularProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      topBuyer,
      topSpender,
      topPopularProduct,
    };
  }, [customers]);

  // react-hook-form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile: '',
      isActive: true,
    },
  });

  // Reset form when edit state changes
  useEffect(() => {
    if (editingCustomer) {
      reset({
        name: editingCustomer.name,
        email: editingCustomer.email || '',
        mobile: editingCustomer.mobile,
        isActive: editingCustomer.isActive ?? true,
      });
    }
  }, [editingCustomer, reset]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormInput) => {
      if (!editingCustomer) throw new Error('No customer selected');
      return adminApi.updateCustomer(editingCustomer.id, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setSuccessMsg('Customer updated successfully.');
      setErrorMsg('');
      setEditingCustomer(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err) => {
      setSuccessMsg('');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update customer');
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setSuccessMsg('Customer deleted successfully.');
      setErrorMsg('');
      setDeletingCustomer(null);
      setSelectedCustomerId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err) => {
      setSuccessMsg('');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete customer');
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  if (customersQuery.isLoading && !customersQuery.data) {
    return <LoadingBlock label="Loading customers..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Customers" subtitle="View customer statistics, manage account status, and check purchase patterns." />

      {/* Insights Banner */}
      {insights && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-primary-50 p-3 text-primary-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Frequent Buyer</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{insights.topBuyer?.name || '-'}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {insights.topBuyer?.orderCount || 0} orders · Product: {insights.topBuyer?.mostBoughtProduct || '-'}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Highest Spender</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{insights.topSpender?.name || '-'}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Spend: {insights.topSpender ? currencyFormatter.format(insights.topSpender.totalSpend) : '-'}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Total Customers</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{customers.length}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Popular: {insights.topPopularProduct}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters form - prevents Enter reloads */}
      <form onSubmit={(e) => e.preventDefault()} className="rounded-[1.5rem] border border-primary-100 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or mobile..."
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 whitespace-nowrap">Status:</span>
            <div className="flex bg-primary-50 rounded-xl p-1 border border-primary-100">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                    statusFilter === status
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 whitespace-nowrap">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="lastOrder">Last Order</option>
              <option value="orders">Orders Count</option>
              <option value="spend">Total Spend</option>
              <option value="dateJoined">Date Joined</option>
              <option value="name">Name</option>
            </select>

            {/* Toggle Sort Order */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="rounded-xl border border-primary-100 bg-primary-50 p-2 text-slate-500 hover:bg-primary-100 transition"
              title="Toggle Sort Order"
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
        </div>
      </form>

      {/* Alert Banners */}
      {successMsg && (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition">
          {errorMsg}
        </div>
      )}

      {/* Customers List Grid */}
      <div className="grid gap-4">
        {customers.length === 0 ? (
          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-8 text-center text-slate-500 font-semibold">
            No customers match your criteria.
          </div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer.id}
              className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition hover:bg-primary-50/40"
            >
              <button
                type="button"
                onClick={() => setSelectedCustomerId(customer.id)}
                className="flex-1 text-left flex flex-col gap-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-black text-slate-900">{customer.name}</span>
                  {customer.orderCount >= 5 && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-700">
                      🔥 Frequent Buyer
                    </span>
                  )}
                  {!customer.isActive && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {customer.mobile} · {customer.email || 'No email'}
                </p>

                <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap">
                  <span>
                    Orders: <strong className="text-slate-700">{customer.orderCount}</strong>
                  </span>
                  <span>
                    Spent: <strong className="text-primary-700">{currencyFormatter.format(customer.totalSpend)}</strong>
                  </span>
                  {customer.mostBoughtProduct && customer.mostBoughtProduct !== '-' && (
                    <span>
                      Most bought: <strong className="text-slate-700">{customer.mostBoughtProduct}</strong>
                    </span>
                  )}
                </div>
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(customer)}
                  className="rounded-xl border border-primary-100 bg-white p-2.5 text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition"
                  title="Edit Customer"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingCustomer(customer)}
                  className="rounded-xl border border-primary-100 bg-white p-2.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Delete Customer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-primary-100 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Customer Detail</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedCustomer.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-primary-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-500">Contact & Status</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <p>
                      <span className="font-black text-slate-900">Mobile:</span> {selectedCustomer.mobile}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">Email:</span> {selectedCustomer.email || '-'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">Status:</span> {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">ID:</span> {selectedCustomer.id}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-500">Location Details</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <p>
                      <span className="font-black text-slate-900">Area:</span> {selectedCustomer.area || '-'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">District:</span> {selectedCustomer.district || '-'}
                    </p>
                    {selectedCustomer.savedAddress && (
                      <div className="mt-2 rounded-2xl bg-primary-50/50 p-3">
                        <p className="font-black text-slate-900">Saved Address:</p>
                        <p className="mt-1 leading-relaxed">
                          {selectedCustomer.savedAddress.street},{' '}
                          {selectedCustomer.savedAddress.landmark && `${selectedCustomer.savedAddress.landmark}, `}
                          {selectedCustomer.savedAddress.city}, {selectedCustomer.savedAddress.state} -{' '}
                          {selectedCustomer.savedAddress.pincode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-500">Purchase History</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <p>
                      <span className="font-black text-slate-900">Total Orders:</span> {selectedCustomer.orderCount}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">Last Order:</span> {formatDate(selectedCustomer.lastOrderDate)}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">Total Spend:</span> {currencyFormatter.format(selectedCustomer.totalSpend)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-500">Purchasing Insights</p>
                  <div className="mt-2 space-y-3">
                    <div className="rounded-2xl border border-primary-100 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Most Bought Product</p>
                      <p className="mt-1 text-sm font-black text-primary-900">{selectedCustomer.mostBoughtProduct || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-primary-100 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Most Bought Category</p>
                      <p className="mt-1 text-sm font-black text-primary-900">{selectedCustomer.mostBoughtCategory || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Row in Detail Modal */}
            <div className="mt-6 flex justify-end gap-3 border-t border-primary-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingCustomer(selectedCustomer)}
                className="cursor-pointer rounded-2xl border border-primary-100 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-[0.15em] text-primary-700 hover:bg-primary-50 transition"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={() => setDeletingCustomer(selectedCustomer)}
                className="cursor-pointer rounded-2xl border border-primary-100 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-[0.15em] text-rose-600 hover:bg-rose-50 transition"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-[2rem] border border-primary-100 bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black text-slate-900">Edit Customer</h2>
            <p className="mt-1 text-sm text-slate-500">Update customer details below.</p>

            <form onSubmit={handleSubmit((values) => updateMutation.mutate(values))} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Name</label>
                <input
                  {...register('name')}
                  placeholder="Customer name"
                  className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                    errors.name ? 'border-rose-300' : 'border-primary-100'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
                <input
                  {...register('mobile')}
                  placeholder="Mobile number"
                  maxLength={10}
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                  }}
                  className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                    errors.mobile ? 'border-rose-300' : 'border-primary-100'
                  }`}
                />
                {errors.mobile && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.mobile.message}</p>}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email Address</label>
                <input
                  {...register('email')}
                  placeholder="email@example.com (optional)"
                  className={`w-full rounded-2xl border bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                    errors.email ? 'border-rose-300' : 'border-primary-100'
                  }`}
                />
                {errors.email && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email.message}</p>}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
                <div>
                  <p className="text-sm font-black text-slate-900">Active Status</p>
                  <p className="text-xs text-slate-500">Enable or disable this customer's account.</p>
                </div>
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-5 w-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary-500 py-3 text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200 transition"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 cursor-pointer rounded-2xl border border-primary-100 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-primary-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[2rem] border border-primary-100 bg-white p-6 shadow-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <ShieldAlert size={28} />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900">Delete Customer</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <strong className="text-slate-900">{deletingCustomer.name}</strong>?
            </p>

            {deletingCustomer.orderCount > 0 ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-left text-xs text-rose-700 space-y-1">
                <p className="font-bold">⚠️ Cannot Delete Customer</p>
                <p>
                  This customer has <strong className="text-rose-950">{deletingCustomer.orderCount} orders</strong> in the
                  system. Database integrity prevents deletion of active accounts.
                </p>
                <p className="font-semibold mt-1">Recommended Action:</p>
                <p>Close this dialog and click Edit to deactivate their account instead.</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">This action is permanent. All customer history will be removed.</p>
            )}

            <div className="mt-6 flex gap-3">
              {deletingCustomer.orderCount === 0 && (
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deletingCustomer.id)}
                  className="flex-1 cursor-pointer rounded-2xl bg-rose-600 py-3 text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-200 transition"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="flex-1 cursor-pointer rounded-2xl border border-primary-100 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-primary-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
