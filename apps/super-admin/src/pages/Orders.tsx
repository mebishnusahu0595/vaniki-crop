import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatAddress, formatDateTime } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';

function exportOrdersCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;

  const headers = [
    'Order Number',
    'Store',
    'Customer',
    'Status',
    'Fulfillment',
    'Payment Status',
    'Payment Method',
    'Amount',
    'Created At',
  ];

  const csvRows = rows.map((row) => [
    row.orderNumber,
    row.store,
    row.customer,
    row.status,
    row.serviceMode,
    row.paymentStatus,
    row.paymentMethod,
    row.amount,
    row.createdAt,
  ]);

  const csv = [headers, ...csvRows]
    .map((line) =>
      line
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `super-admin-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const today = new Date().toLocaleDateString('en-CA');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('confirmed');
  const [note, setNote] = useState('');

  const storesQuery = useQuery({
    queryKey: ['super-admin-order-stores'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const ordersQuery = useQuery({
    queryKey: ['super-admin-orders', storeId, status, paymentStatus, debouncedSearch, startDate, endDate],
    queryFn: () =>
      adminApi.orders({
        storeId,
        status,
        paymentStatus,
        search: debouncedSearch,
        startDate,
        endDate,
        limit: 100,
      }),
    placeholderData: (previousData) => previousData,
  });

  const orderDetailQuery = useQuery({
    queryKey: ['super-admin-order-detail', selectedOrderId],
    queryFn: () => adminApi.orderDetail(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: () => adminApi.updateOrderStatus(selectedOrderId!, { status: nextStatus, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-order-detail', selectedOrderId] });
      setNote('');
    },
  });

  const detail = orderDetailQuery.data;
  const isOrderModalOpen = Boolean(selectedOrderId);

  if (ordersQuery.isLoading && !ordersQuery.data) return <LoadingBlock label="Loading orders..." />;

  const exportRows =
    ordersQuery.data?.data.map((order) => ({
      orderNumber: order.orderNumber,
      store: order.storeId?.name || 'Unknown Store',
      customer: order.userId?.name || 'Customer',
      status: order.status,
      serviceMode: order.serviceMode === 'pickup' ? 'Pickup' : 'Delivery',
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      amount: order.totalAmount,
      createdAt: formatDateTime(order.createdAt),
    })) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Orders"
        subtitle="Cross-store order monitoring with status controls, filters, and export support."
        action={
          <button
            onClick={() => exportOrdersCsv(exportRows)}
            className="rounded-2xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-700"
          >
            Export CSV
          </button>
        }
      />

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-6">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All stores</option>
          {storesQuery.data?.data.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All statuses</option>
          {['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All payment statuses</option>
          {['pending', 'paid', 'failed', 'refunded'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>

      {ordersQuery.isFetching ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Refreshing orders...</p>
      ) : null}

      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary-100 bg-white lg:block">
        <table className="min-w-full">
          <thead className="bg-primary-50/70 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {ordersQuery.data?.data.map((order) => (
              <tr
                key={order.id}
                onClick={() => {
                  setSelectedOrderId(order.id);
                  setNextStatus(order.status);
                }}
                className="cursor-pointer border-t border-primary-100 hover:bg-primary-50/50"
              >
                <td className="px-4 py-3 text-sm font-black text-slate-900">{order.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{order.storeId?.name || 'Unknown Store'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{order.userId?.name || 'Customer'}</td>
                <td className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-700">{order.status}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600">{order.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{order.paymentStatus}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-900">{currencyFormatter.format(order.totalAmount)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordersQuery.data?.data.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg font-black text-slate-400">
              {startDate === today && endDate === today ? 'No orders today' : 'No orders found for the selected period'}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:hidden">
        {ordersQuery.data?.data.map((order) => (
          <button
            key={order.id}
            onClick={() => {
              setSelectedOrderId(order.id);
              setNextStatus(order.status);
            }}
            className="rounded-[1.5rem] border border-primary-100 bg-white p-4 text-left"
          >
            <p className="text-lg font-black text-slate-900">{order.orderNumber}</p>
            <p className="mt-1 text-sm text-slate-500">{order.storeId?.name || 'Unknown Store'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {order.userId?.name || 'Customer'} · {order.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-primary-700">{order.status}</span>
              <span className="text-sm font-black text-slate-900">{currencyFormatter.format(order.totalAmount)}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>{order.paymentStatus}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                order.paymentMethod === 'cod' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>{order.paymentMethod === 'cod' ? 'COD' : 'Razorpay'}</span>
            </div>
          </button>
        ))}
        {ordersQuery.data?.data.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50/30 py-12 text-center">
            <p className="text-lg font-black text-slate-400">
              {startDate === today && endDate === today ? 'No orders today' : 'No orders found for the selected period'}
            </p>
          </div>
        )}
      </div>

      {isOrderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-primary-100 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Order Detail</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{detail?.orderNumber || 'Loading order...'}</h2>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600">
                Close
              </button>
            </div>

            {orderDetailQuery.isLoading || !detail ? (
              <div className="mt-6">
                <LoadingBlock label="Loading order details..." />
              </div>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
                  <h3 className="text-lg font-black text-slate-900">Items</h3>
                  <div className="mt-4 space-y-3">
                    {detail.items.map((item, index) => (
                      <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-4 rounded-2xl border border-primary-100 bg-white p-4">
                        <div className="flex min-w-0 items-start gap-3">
                          {item.image ? (
                            <img
                              src={resolveMediaUrl(item.image)}
                              alt={item.productName}
                              loading="lazy"
                              className="h-12 w-12 rounded-xl border border-primary-100 bg-primary-50 object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-primary-200 bg-primary-50 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                              N/A
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-black text-slate-900">{item.productName}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.variantLabel} · {item.qty} qty</p>
                          </div>
                        </div>
                        <p className="font-black text-primary-700">{currencyFormatter.format(item.price * item.qty)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
                  <h3 className="text-lg font-black text-slate-900">Customer Details</h3>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <p><span className="font-black text-slate-900">Store:</span> {detail.storeId?.name || '-'}</p>
                    <p><span className="font-black text-slate-900">Name:</span> {detail.userId?.name || '-'}</p>
                    <p><span className="font-black text-slate-900">Mobile:</span> {detail.userId?.mobile || detail.shippingAddress?.mobile || '-'}</p>
                    <p><span className="font-black text-slate-900">Email:</span> {detail.userId?.email || '-'}</p>
                    <p><span className="font-black text-slate-900">Address:</span> {formatAddress(detail.shippingAddress || detail.userId?.savedAddress)}</p>
                    <p><span className="font-black text-slate-900">Service Mode:</span> {detail.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                    <p><span className="font-black text-slate-900">Payment Method:</span>{' '}
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        detail.paymentMethod === 'cod' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>{detail.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</span>
                    </p>
                    <p><span className="font-black text-slate-900">Payment Status:</span>{' '}
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        detail.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        detail.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        detail.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{detail.paymentStatus}</span>
                    </p>
                    <p><span className="font-black text-slate-900">Razorpay Payment ID:</span> {detail.razorpayPaymentId || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-900">Order Summary</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-900">{currencyFormatter.format(detail.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Coupon</span><span className="font-semibold text-slate-900">- {currencyFormatter.format(detail.couponDiscount)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-semibold text-slate-900">{currencyFormatter.format(detail.deliveryCharge)}</span></div>
                    <div className="flex justify-between border-t border-primary-100 pt-3"><span className="font-black text-slate-900">Total</span><span className="font-black text-slate-900">{currencyFormatter.format(detail.totalAmount)}</span></div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-900">Status Update</h3>
                  <div className="mt-4 space-y-3">
                    <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                      {['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className="min-h-[90px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
                    <button onClick={() => updateStatusMutation.mutate()} className="w-full rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
                      Update Status
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
                  <h3 className="text-lg font-black text-slate-900">Timeline</h3>
                  <div className="mt-4 space-y-4">
                    {detail.statusHistory.map((entry) => (
                      <div key={`${entry.status}-${entry.timestamp}`} className="flex gap-3">
                        <div className="mt-2 h-3 w-3 rounded-full bg-primary-500" />
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">{entry.status}</p>
                          <p className="mt-1 text-sm text-slate-500">{entry.note || 'Updated'}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatDateTime(entry.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
