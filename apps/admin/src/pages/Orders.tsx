import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatAddress, formatDateTime } from '../utils/format';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('confirmed');
  const [note, setNote] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['admin-orders', status, paymentMethod, search, startDate, endDate],
    queryFn: () => adminApi.orders({ status, paymentMethod, search, startDate, endDate, limit: 100 }),
  });
  const orderDetailQuery = useQuery({
    queryKey: ['admin-order-detail', selectedOrderId],
    queryFn: () => adminApi.orderDetail(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: () => adminApi.updateOrderStatus(selectedOrderId!, { status: nextStatus, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-order-detail', selectedOrderId] });
      setNote('');
    },
  });

  const detail = orderDetailQuery.data;
  const isOrderModalOpen = Boolean(selectedOrderId);

  if (ordersQuery.isLoading) return <LoadingBlock label="Loading orders..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" subtitle="Track payments, update status, and inspect customer order details." />

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-5">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All statuses</option>
          {['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All payment methods</option>
          {['razorpay', 'cod'].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>

      <div className="grid gap-4">
        {ordersQuery.data?.data.map((order) => (
          <button key={order.id} onClick={() => { setSelectedOrderId(order.id); setNextStatus(order.status); }} className="rounded-[1.5rem] border border-primary-100 bg-white p-4 text-left">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {order.userId?.name || 'Customer'} · {formatDateTime(order.createdAt)}
                </p>
              </div>
              <div className="grid gap-2 text-left md:text-right">
                <span className="text-sm font-black uppercase tracking-[0.15em] text-primary-700">{order.status}</span>
                <span className="text-sm font-semibold text-slate-500">{order.paymentStatus}</span>
                <span className="text-lg font-black text-slate-900">{currencyFormatter.format(order.totalAmount)}</span>
              </div>
            </div>
          </button>
        ))}
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
                        <div>
                          <p className="font-black text-slate-900">{item.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.variantLabel} · {item.qty} qty</p>
                        </div>
                        <p className="font-black text-primary-700">{currencyFormatter.format(item.price * item.qty)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
                  <h3 className="text-lg font-black text-slate-900">Customer Details</h3>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <p><span className="font-black text-slate-900">Name:</span> {detail.userId?.name || '-'}</p>
                    <p><span className="font-black text-slate-900">Mobile:</span> {detail.userId?.mobile || detail.shippingAddress?.mobile || '-'}</p>
                    <p><span className="font-black text-slate-900">Email:</span> {detail.userId?.email || '-'}</p>
                    <p><span className="font-black text-slate-900">Address:</span> {formatAddress(detail.shippingAddress || detail.userId?.savedAddress)}</p>
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
