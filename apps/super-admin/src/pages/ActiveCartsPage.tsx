import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Phone,
  MessageCircle,
  Eye,
  Trash2,
  Clock,
  Smartphone,
  Store,
  Globe,
  User,
  TrendingUp,
  X,
  Package,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDateTime } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';
import type { ActiveCart } from '../types/admin';

export function ActiveCartsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 400);

  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'dealer' | 'user' | 'guest'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'user_app' | 'dealer_app' | 'user_web'>('all');
  const [timeRange, setTimeRange] = useState<'all' | '1h' | '24h' | 'abandoned'>('all');
  const [page, setPage] = useState(1);

  // Selected cart for detail modal
  const [selectedCart, setSelectedCart] = useState<ActiveCart | null>(null);

  // Active Carts Query with 15s auto-refetch for live updates
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-active-carts', page, userTypeFilter, sourceFilter, timeRange, debouncedSearch],
    queryFn: () =>
      adminApi.activeCarts({
        page,
        limit: 20,
        userType: userTypeFilter === 'all' ? undefined : userTypeFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        timeRange: timeRange === 'all' ? undefined : timeRange,
        search: debouncedSearch.trim() || undefined,
        status: 'active',
      }),
    refetchInterval: 15000, // Live poll every 15s
  });

  const deleteMutation = useMutation({
    mutationFn: (cartId: string) => adminApi.deleteActiveCart(cartId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-carts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-active-cart-count'] });
      if (selectedCart) setSelectedCart(null);
    },
  });

  const carts = data?.data || [];
  const summary = data?.summary || {
    totalActiveCarts: 0,
    totalPotentialRevenue: 0,
    totalActiveItems: 0,
    dealerCarts: 0,
    dealerRevenue: 0,
    userCarts: 0,
    userRevenue: 0,
    guestCarts: 0,
    guestRevenue: 0,
  };

  const totalPages = data?.pagination?.totalPages || 1;

  // Helper to format time relative
  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diffMins = Math.floor((now - then) / 60000);

    if (diffMins < 1) return 'Active just now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  };

  const isRecent = (dateStr: string) => {
    if (!dateStr) return false;
    const diffMins = (new Date().getTime() - new Date(dateStr).getTime()) / 60000;
    return diffMins <= 15;
  };

  // Generate WhatsApp message for cart recovery
  const getWhatsAppLink = (cart: ActiveCart) => {
    const rawPhone = cart.customerPhone || cart.userId?.mobile || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const name = cart.customerName || cart.userId?.name || 'Sir/Madam';
    const firstItem = cart.items?.[0]?.productName || 'products';
    const otherCount = (cart.items?.length || 1) - 1;
    const itemsDescription = otherCount > 0 ? `${firstItem} aur ${otherCount} anya products` : firstItem;

    const message = encodeURIComponent(
      `Namaste ${name} ji! 🙏\n\nHumne dekha aapne Vaniki Crop par apne cart mein *${itemsDescription}* (Total: ${currencyFormatter.format(
        cart.subtotal,
      )}) add kiya hua hai.\n\nKya aapko order place karne mein koi madad chahiye ya payment mein koi issue aa raha hai? Hum aapki sahayata ke liye yahan hain!`
    );

    return `https://wa.me/${phoneWithCountry}?text=${message}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with live pulse */}
      <PageHeader
        title="Live Active Carts"
        subtitle="Real-time visibility into active customer & dealer carts across User App, Dealers Play App, and Web Store"
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Live Sync (15s)
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin text-primary-500' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Active Carts */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Active Carts</span>
            <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.totalActiveCarts}</span>
            <span className="text-xs font-semibold text-slate-500">{summary.totalActiveItems} total items</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Currently awaiting checkout</p>
        </div>

        {/* Potential Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Potential Revenue</span>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">
              {currencyFormatter.format(summary.totalPotentialRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-600">Unconverted cart value</p>
        </div>

        {/* Dealer Active Carts */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Authorized Dealers</span>
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <Store size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.dealerCarts}</span>
            <span className="text-xs font-bold text-amber-700">
              {currencyFormatter.format(summary.dealerRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Dealers Play App & B2B portal</p>
        </div>

        {/* Retail Farmers / Users */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/30 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Retail Farmers / Users</span>
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
              <User size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.userCarts}</span>
            <span className="text-xs font-bold text-blue-700">
              {currencyFormatter.format(summary.userRevenue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">User App & Online Store</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Left: User Type Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setUserTypeFilter('all');
              setPage(1);
            }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              userTypeFilter === 'all'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Carts ({summary.totalActiveCarts})
          </button>
          <button
            onClick={() => {
              setUserTypeFilter('dealer');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              userTypeFilter === 'dealer'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Store size={13} />
            Dealers Only ({summary.dealerCarts})
          </button>
          <button
            onClick={() => {
              setUserTypeFilter('user');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              userTypeFilter === 'user'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <User size={13} />
            Retail Users ({summary.userCarts})
          </button>
          <button
            onClick={() => {
              setUserTypeFilter('guest');
              setPage(1);
            }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              userTypeFilter === 'guest'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Guests ({summary.guestCarts})
          </button>
        </div>

        {/* Right: Search & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as any);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="user_app">📱 User Mobile App</option>
            <option value="dealer_app">🏬 Dealers Play App</option>
            <option value="user_web">💻 Web Browser</option>
          </select>

          {/* Time Filter */}
          <select
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value as any);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="all">All Timelines</option>
            <option value="1h">Active &lt; 1 Hour</option>
            <option value="24h">Active &lt; 24 Hours</option>
            <option value="abandoned">Abandoned (&gt; 1 Hr)</option>
          </select>

          {/* Search box */}
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search customer, phone, product..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingBlock label="Loading live active carts..." />
      ) : carts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="rounded-full bg-slate-100 p-4 text-slate-400">
            <ShoppingBag size={32} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">No Active Carts Found</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {searchTerm || userTypeFilter !== 'all' || sourceFilter !== 'all' || timeRange !== 'all'
              ? 'No carts match the selected filters. Try clearing your search or filter options.'
              : 'There are currently no active carts in the system. Carts will show here live when users add products.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {carts.map((cart) => {
            const customerName =
              cart.customerName || cart.userId?.name || (cart.userType === 'guest' ? 'Guest Visitor' : 'Customer');
            const customerPhone = cart.customerPhone || cart.userId?.mobile || '';
            const isDealer = cart.userType === 'dealer';
            const recent = isRecent(cart.lastActiveAt);

            return (
              <div
                key={cart._id}
                className="group relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md lg:flex-row lg:items-center lg:justify-between"
              >
                {/* Left: Customer & Platform */}
                <div className="flex items-start gap-3.5 min-w-[280px]">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold ${
                      isDealer
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : cart.userType === 'user'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {isDealer ? <Store size={22} /> : cart.userType === 'user' ? <User size={22} /> : <User size={20} />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900">{customerName}</h4>
                      {isDealer ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Dealer 🏪
                        </span>
                      ) : cart.userType === 'user' ? (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                          Farmer / User 🌾
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Guest 👤
                        </span>
                      )}

                      {/* Source Badge */}
                      <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {cart.source === 'dealer_app' ? (
                          <>
                            <Store size={10} className="text-amber-600" />
                            Dealers Play App
                          </>
                        ) : cart.source === 'user_app' ? (
                          <>
                            <Smartphone size={10} className="text-blue-600" />
                            User Mobile App
                          </>
                        ) : (
                          <>
                            <Globe size={10} className="text-emerald-600" />
                            Web Store
                          </>
                        )}
                      </span>
                    </div>

                    {/* Contact & Store Info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {customerPhone ? (
                        <a
                          href={`tel:${customerPhone}`}
                          className="font-medium text-slate-700 hover:text-primary-600"
                        >
                          📞 {customerPhone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No phone recorded</span>
                      )}

                      {cart.dealerBusinessName && (
                        <span className="font-semibold text-amber-900">
                          🏬 {cart.dealerBusinessName}
                        </span>
                      )}

                      {cart.storeId?.city && (
                        <span>📍 {cart.storeId.city}, {cart.storeId.state}</span>
                      )}
                    </div>

                    {/* Last Active Timestamp */}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                      <span className="flex items-center gap-1 font-medium text-slate-500">
                        <Clock size={11} />
                        {getRelativeTime(cart.lastActiveAt)}
                      </span>
                      {recent && (
                        <span className="flex items-center gap-1 font-bold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Active Now
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Cart Items Preview */}
                <div className="flex-1 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Cart Items ({cart.totalItems})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(cart.items || []).slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5"
                      >
                        {item.image ? (
                          <img
                            src={resolveMediaUrl(item.image)}
                            alt={item.productName}
                            className="h-8 w-8 rounded-lg object-cover bg-white"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400">
                            <Package size={14} />
                          </div>
                        )}
                        <div className="max-w-[140px] truncate text-xs">
                          <p className="truncate font-bold text-slate-800">{item.productName}</p>
                          <p className="text-[10px] text-slate-500">
                            {item.variantLabel} • <span className="font-bold text-slate-700">x{item.qty}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {(cart.items || []).length > 3 && (
                      <span className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">
                        +{cart.items.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Subtotal & Actions */}
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cart Total</p>
                    <p className="text-lg font-black text-emerald-700">{currencyFormatter.format(cart.subtotal)}</p>
                    {cart.couponCode && (
                      <p className="text-[10px] font-bold text-primary-600">Coupon: {cart.couponCode}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* View Details */}
                    <button
                      onClick={() => setSelectedCart(cart)}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-primary-600"
                      title="View Cart Details"
                    >
                      <Eye size={16} />
                    </button>

                    {/* WhatsApp Cart Recovery */}
                    {customerPhone && (
                      <a
                        href={getWhatsAppLink(cart)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
                        title="Send WhatsApp Recovery Message"
                      >
                        <MessageCircle size={14} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}

                    {/* Direct Call */}
                    {customerPhone && (
                      <a
                        href={`tel:${customerPhone}`}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-600"
                        title="Call Customer"
                      >
                        <Phone size={15} />
                      </a>
                    )}

                    {/* Delete / Clear */}
                    <button
                      onClick={() => {
                        if (confirm(`Remove this abandoned cart from ${customerName}?`)) {
                          deleteMutation.mutate(cart._id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete Cart"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 rounded-2xl shadow-sm">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cart Detail Modal / Drawer */}
      {selectedCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cart Details: {selectedCart.customerName || selectedCart.userId?.name || 'Guest Visitor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Last active: {formatDateTime(selectedCart.lastActiveAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCart(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer & Store Info */}
              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-400">Customer Details</p>
                  <p className="mt-1 font-bold text-slate-800">
                    {selectedCart.customerName || selectedCart.userId?.name || 'Guest'}
                  </p>
                  <p className="text-slate-600">Phone: {selectedCart.customerPhone || selectedCart.userId?.mobile || 'N/A'}</p>
                  <p className="text-slate-600">Email: {selectedCart.customerEmail || selectedCart.userId?.email || 'N/A'}</p>
                  <p className="text-slate-600">Type: <span className="font-bold uppercase">{selectedCart.userType}</span></p>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-400">Platform & Activity</p>
                  <p className="mt-1 text-slate-800">
                    Source: <span className="font-bold uppercase">{selectedCart.source.replace('_', ' ')}</span>
                  </p>
                  {selectedCart.dealerBusinessName && (
                    <p className="text-slate-800 font-semibold">Store: {selectedCart.dealerBusinessName}</p>
                  )}
                  {selectedCart.ip && <p className="text-slate-500">IP: {selectedCart.ip}</p>}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Products in Cart ({selectedCart.totalItems} items)
                </h4>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {(selectedCart.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={resolveMediaUrl(item.image)}
                            alt={item.productName}
                            className="h-12 w-12 rounded-xl object-cover bg-slate-100 border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                            <Package size={20} />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.productName}</p>
                          <p className="text-xs text-slate-500">Pack: {item.variantLabel}</p>
                          <p className="text-xs text-slate-600">
                            {currencyFormatter.format(item.price)} × {item.qty} units
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">
                          {currencyFormatter.format(item.price * item.qty)}
                        </p>
                        {item.mrp > item.price && (
                          <p className="text-[11px] text-slate-400 line-through">
                            MRP: {currencyFormatter.format(item.mrp * item.qty)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2 text-sm bg-slate-50">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">
                    {currencyFormatter.format(selectedCart.subtotal)}
                  </span>
                </div>
                {selectedCart.couponCode && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon ({selectedCart.couponCode})</span>
                    <span>-{currencyFormatter.format(selectedCart.couponDiscount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-900">
                  <span>Total Cart Value</span>
                  <span className="text-emerald-700">
                    {currencyFormatter.format(selectedCart.subtotal - (selectedCart.couponDiscount || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 p-5 bg-slate-50/50 rounded-b-3xl">
              <button
                onClick={() => {
                  if (confirm('Delete this cart record?')) {
                    deleteMutation.mutate(selectedCart._id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} />
                Delete Cart
              </button>

              <div className="flex items-center gap-2">
                {(selectedCart.customerPhone || selectedCart.userId?.mobile) && (
                  <>
                    <a
                      href={`tel:${selectedCart.customerPhone || selectedCart.userId?.mobile}`}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Phone size={14} />
                      Call
                    </a>
                    <a
                      href={getWhatsAppLink(selectedCart)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 active:scale-95"
                    >
                      <MessageCircle size={15} />
                      Recover on WhatsApp
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ActiveCartsPage;
