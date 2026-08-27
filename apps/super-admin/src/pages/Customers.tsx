import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowUpDown,
  TrendingUp,
  DollarSign,
  User,
  Edit2,
  Trash2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Globe,
  ExternalLink,
  Users,
  Compass,
} from 'lucide-react';
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
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  isActive: z.boolean(),
  loyaltyPoints: z.number().min(0, 'Loyalty points must be at least 0'),
});

type CustomerFormInput = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const queryClient = useQueryClient();

  // Active Tab: Registered Customers vs Live App/Web Visitors
  const [activeTab, setActiveTab] = useState<'customers' | 'visitors'>('customers');

  // Customer Search & Filter States
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'orders' | 'spend' | 'lastOrder' | 'dateJoined' | 'name'>('lastOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Visitor Search & Filter States
  const [visitorSearch, setVisitorSearch] = useState('');
  const debouncedVisitorSearch = useDebouncedValue(visitorSearch, 300);
  const [visitorFilter, setVisitorFilter] = useState<'all' | 'registered' | 'visitor'>('all');
  const [coordsOnlyFilter, setCoordsOnlyFilter] = useState(false);
  const [visitorPage, setVisitorPage] = useState(1);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    setVisitorPage(1);
  }, [debouncedVisitorSearch, visitorFilter, coordsOnlyFilter]);

  // Modals & Details State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Alerts
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Customers Query
  const customersQuery = useQuery({
    queryKey: ['admin-customers', debouncedSearch, statusFilter, sortBy, sortOrder, page],
    queryFn: () =>
      adminApi.customers({
        search: debouncedSearch,
        isActive: statusFilter === 'all' ? undefined : statusFilter,
        sortBy,
        sortOrder,
        limit: 25,
        page,
      }),
  });

  const customers = customersQuery.data?.data || [];
  const pagination = customersQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  // 2. Visitors & Leads Telemetry Query
  const visitorsQuery = useQuery({
    queryKey: ['admin-visitors', debouncedVisitorSearch, visitorFilter, coordsOnlyFilter, visitorPage],
    queryFn: () =>
      adminApi.visitors({
        search: debouncedVisitorSearch,
        isRegistered: visitorFilter === 'all' ? undefined : visitorFilter,
        hasCoordinates: coordsOnlyFilter ? 'true' : undefined,
        limit: 25,
        page: visitorPage,
      }),
  });

  const visitors = visitorsQuery.data?.data || [];
  const visitorPagination = visitorsQuery.data?.pagination;
  const visitorTotalPages = visitorPagination?.totalPages || 1;

  const handlePrevPage = () => setPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setPage((prev) => Math.min(prev + 1, totalPages));

  const handleVisitorPrevPage = () => setVisitorPage((prev) => Math.max(prev - 1, 1));
  const handleVisitorNextPage = () => setVisitorPage((prev) => Math.min(prev + 1, visitorTotalPages));

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: CustomerFormInput) => adminApi.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setIsCreatingCustomer(false);
      setSuccessMsg('Customer created successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to create customer');
      setTimeout(() => setErrorMsg(''), 4000);
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerFormInput> }) =>
      adminApi.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setEditingCustomer(null);
      setSuccessMsg('Customer updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to update customer');
      setTimeout(() => setErrorMsg(''), 4000);
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setDeletingCustomer(null);
      setSuccessMsg('Customer deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to delete customer');
      setTimeout(() => setErrorMsg(''), 4000);
    },
  });

  if (customersQuery.isLoading && !customers.length && visitorsQuery.isLoading && !visitors.length) {
    return <LoadingBlock label="Loading customer & visitor intelligence..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Intelligence & Live Visitor Telemetry"
        subtitle="Track registered customers, auto-captured GPS coordinates, live IP addresses, and app/web leads."
        action={
          <button
            type="button"
            onClick={() => {
              reset({
                name: '',
                email: '',
                mobile: '',
                password: '',
                isActive: true,
                loyaltyPoints: 0,
              });
              setIsCreatingCustomer(true);
            }}
            className="cursor-pointer rounded-2xl bg-primary-600 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-primary-700 transition shadow-sm"
          >
            Create Customer
          </button>
        }
      />

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

      {/* Main Tab Switcher */}
      <div className="flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'customers'
              ? 'bg-white text-primary-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users size={16} />
          <span>Registered Customers ({pagination?.total || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('visitors')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'visitors'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Compass size={16} />
          <span>App & Web Visitors / GPS Leads ({visitorPagination?.total || 0})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REGISTERED CUSTOMERS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
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
                  <p className="text-base font-black text-slate-900 mt-0.5">{pagination?.total || 0}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Popular: {insights.topPopularProduct}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <form onSubmit={(e) => e.preventDefault()} className="rounded-[1.5rem] border border-primary-100 bg-white p-4 space-y-4 shadow-2xs">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, mobile, email, village, or IP..."
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

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

          {/* Customers List Grid */}
          <div className="grid gap-3.5">
            {customers.length === 0 ? (
              <div className="rounded-[1.5rem] border border-primary-100 bg-white p-8 text-center text-slate-500 font-semibold">
                No customers match your search criteria.
              </div>
            ) : (
              customers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition hover:bg-primary-50/30 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className="flex-1 text-left flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                        #{(page - 1) * 25 + index + 1}
                      </span>
                      <span className="text-base font-black text-slate-900">{customer.name}</span>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                        📱 {customer.mobile}
                      </span>

                      {customer.ip && customer.ip !== '-' ? (
                        <span className="rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 text-[11px] font-mono font-bold flex items-center gap-1">
                          <Globe size={11} /> {customer.ip}
                        </span>
                      ) : null}

                      {customer.coordinates ? (
                        <a
                          href={customer.mapsUrl || `https://www.google.com/maps?q=${customer.coordinates.latitude},${customer.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 px-2 py-0.5 text-[11px] font-black hover:bg-emerald-200 transition"
                        >
                          <MapPin size={11} className="text-emerald-700" />
                          <span>GPS: {customer.coordinates.latitude.toFixed(4)}, {customer.coordinates.longitude.toFixed(4)}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : null}

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

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap mt-0.5">
                      <span>
                        📍 Area: <strong className="text-slate-800">{customer.area || customer.district || '-'}</strong>, {customer.state || 'CG'} {customer.pincode ? `(${customer.pincode})` : ''}
                      </span>
                      <span>
                        Orders: <strong className="text-slate-800">{customer.orderCount}</strong>
                      </span>
                      <span>
                        Spent: <strong className="text-primary-700">{currencyFormatter.format(customer.totalSpend)}</strong>
                      </span>
                      <span>
                        Loyalty: <strong className="text-amber-700">🪙 {customer.loyaltyPoints || 0} pts</strong>
                      </span>
                    </div>
                  </button>

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

          {/* Customers Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={page === 1}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition ${
                      page === p
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-white border border-primary-100 text-slate-600 hover:bg-primary-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={page === totalPages}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: APP & WEB VISITORS / LIVE GPS LEADS                                */}
      {/* ========================================================================= */}
      {activeTab === 'visitors' && (
        <div className="space-y-6">
          {/* Visitor Filter Bar */}
          <form onSubmit={(e) => e.preventDefault()} className="rounded-[1.5rem] border border-primary-100 bg-white p-4 space-y-4 shadow-2xs">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <input
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Search visitors by IP, city, state, pincode, mobile, or visitor ID..."
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 whitespace-nowrap">Filter:</span>
                <div className="flex bg-primary-50 rounded-xl p-1 border border-primary-100">
                  {(['all', 'registered', 'visitor'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVisitorFilter(type)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                        visitorFilter === type
                          ? 'bg-white text-emerald-800 shadow-sm font-black'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {type === 'all' ? 'All Leads' : type === 'registered' ? 'Registered' : 'Guests / Unregistered'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCoordsOnlyFilter((prev) => !prev)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition flex items-center gap-1.5 border ${
                  coordsOnlyFilter
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-primary-50 text-slate-700 border-primary-100 hover:bg-primary-100'
                }`}
              >
                <MapPin size={14} />
                <span>GPS Located Only</span>
              </button>
            </div>
          </form>

          {/* Visitors Grid */}
          <div className="grid gap-3.5">
            {visitors.length === 0 ? (
              <div className="rounded-[1.5rem] border border-primary-100 bg-white p-8 text-center text-slate-500 font-semibold">
                No visitor telemetry found for this filter.
              </div>
            ) : (
              visitors.map((visitor, index) => (
                <div
                  key={visitor.id}
                  className="rounded-[1.5rem] border border-primary-100 bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition hover:bg-slate-50 shadow-2xs"
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                        #{(visitorPage - 1) * 25 + index + 1}
                      </span>

                      {visitor.userName ? (
                        <span className="text-base font-black text-slate-900">{visitor.userName}</span>
                      ) : (
                        <span className="text-sm font-bold text-slate-700 font-mono">
                          Visitor #{visitor.visitorId?.slice(-6) || 'Unknown'}
                        </span>
                      )}

                      {visitor.userMobile ? (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                          📱 {visitor.userMobile}
                        </span>
                      ) : null}

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          visitor.isRegistered
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {visitor.isRegistered ? '✓ Registered Customer' : '• Guest Visitor / Lead'}
                      </span>

                      <span className="rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 text-[11px] font-mono font-bold flex items-center gap-1">
                        <Globe size={11} /> IP: {visitor.ip}
                      </span>

                      {visitor.coordinates ? (
                        <a
                          href={visitor.mapsUrl || `https://www.google.com/maps?q=${visitor.coordinates.latitude},${visitor.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-black hover:bg-emerald-700 transition shadow-2xs"
                        >
                          <MapPin size={11} />
                          <span>Map: {visitor.coordinates.latitude.toFixed(4)}, {visitor.coordinates.longitude.toFixed(4)}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">GPS pending</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap mt-0.5">
                      {visitor.location?.district || visitor.location?.city || visitor.location?.state ? (
                        <span>
                          📍 Location: <strong className="text-slate-800">
                            {visitor.location?.formattedAddress || `${visitor.location?.district || visitor.location?.city || ''}, ${visitor.location?.state || ''} ${visitor.location?.pincode ? `(${visitor.location.pincode})` : ''}`}
                          </strong>
                        </span>
                      ) : null}

                      <span>
                        📱 Device: <strong className="text-slate-700">{visitor.device?.platform || 'Web'}</strong> ({visitor.device?.os || 'Device'})
                      </span>

                      <span>
                        Visits: <strong className="text-emerald-700">{visitor.visitCount || 1} times</strong>
                      </span>

                      <span>
                        Last Active: <strong className="text-slate-700">{formatDate(visitor.lastSeen)}</strong>
                      </span>
                    </div>

                    {visitor.recentPages && visitor.recentPages.length > 0 ? (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-slate-400">Pages:</span>
                        {visitor.recentPages.slice(-4).map((p: string, idx: number) => (
                          <span key={idx} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Visitors Pagination */}
          {visitorTotalPages > 1 && (
            <div className="flex items-center justify-between rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={handleVisitorPrevPage}
                disabled={visitorPage === 1}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: visitorTotalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setVisitorPage(p)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition ${
                      visitorPage === p
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-white border border-primary-100 text-slate-600 hover:bg-primary-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleVisitorNextPage}
                disabled={visitorPage === visitorTotalPages}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 hover:bg-primary-50 transition disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

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
                      <span className="font-black text-slate-900">IP Address:</span> {selectedCustomer.ip || '-'}
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
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-500">Location & GPS</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <p>
                      <span className="font-black text-slate-900">Area / Village:</span> {selectedCustomer.area || '-'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">District:</span> {selectedCustomer.district || '-'}
                    </p>
                    <p>
                      <span className="font-black text-slate-900">State:</span> {selectedCustomer.state || '-'} {selectedCustomer.pincode ? `(${selectedCustomer.pincode})` : ''}
                    </p>

                    {selectedCustomer.coordinates ? (
                      <div className="mt-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
                        <p className="font-black text-emerald-900 flex items-center gap-1.5">
                          <MapPin size={14} className="text-emerald-700" />
                          GPS Coordinates:
                        </p>
                        <p className="mt-1 text-xs font-mono font-bold text-emerald-800">
                          Lat: {selectedCustomer.coordinates.latitude}, Lng: {selectedCustomer.coordinates.longitude}
                        </p>
                        <a
                          href={selectedCustomer.mapsUrl || `https://www.google.com/maps?q=${selectedCustomer.coordinates.latitude},${selectedCustomer.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-800 transition"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : null}
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
          </div>
        </div>
      ) : null}

      {/* Create / Edit Customer Modal */}
      {(isCreatingCustomer || editingCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-[2rem] border border-primary-100 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-900">
              {isCreatingCustomer ? 'Create New Customer' : 'Edit Customer'}
            </h2>
            <form
              onSubmit={handleSubmit((data) => {
                if (isCreatingCustomer) {
                  createCustomerMutation.mutate(data);
                } else if (editingCustomer) {
                  updateCustomerMutation.mutate({ id: editingCustomer.id, data });
                }
              })}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Full Name</label>
                <input
                  {...register('name')}
                  defaultValue={editingCustomer?.name}
                  placeholder="Enter full name"
                  className="mt-1 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {errors.name && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Mobile Number</label>
                <input
                  {...register('mobile')}
                  defaultValue={editingCustomer?.mobile}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="mt-1 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {errors.mobile && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.mobile.message}</p>}
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Email Address (Optional)</label>
                <input
                  {...register('email')}
                  defaultValue={editingCustomer?.email}
                  placeholder="email@example.com"
                  className="mt-1 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {errors.email && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.email.message}</p>}
              </div>

              {isCreatingCustomer && (
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Password</label>
                  <input
                    {...register('password')}
                    type="password"
                    placeholder="Temporary password (min 6 chars)"
                    className="mt-1 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {errors.password && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.password.message}</p>}
                </div>
              )}

              <div>
                <label className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Loyalty Points</label>
                <input
                  type="number"
                  {...register('loyaltyPoints', { valueAsNumber: true })}
                  defaultValue={editingCustomer?.loyaltyPoints || 0}
                  className="mt-1 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {errors.loyaltyPoints && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.loyaltyPoints.message}</p>}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  {...register('isActive')}
                  defaultChecked={editingCustomer ? editingCustomer.isActive : true}
                  className="h-4 w-4 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700">
                  Account Active & Enabled
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCustomer(false);
                    setEditingCustomer(null);
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-primary-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isCreatingCustomer ? 'Create Customer' : 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert size={24} />
              <h2 className="text-lg font-black text-slate-900">Delete Customer</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deletingCustomer.name}</strong> ({deletingCustomer.mobile})? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteCustomerMutation.mutate(deletingCustomer.id)}
                disabled={deleteCustomerMutation.isPending}
                className="rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleteCustomerMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
