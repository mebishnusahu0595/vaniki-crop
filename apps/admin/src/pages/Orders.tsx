import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatAddress, formatDateTime } from '../utils/format';
import { resolveMediaUrl } from '../utils/media';

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('confirmed');
  const [note, setNote] = useState('');
  const [inventorySearch, setInventorySearch] = useState(searchParams.get('inventory') || '');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedProductName, setRequestedProductName] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [requestedPack, setRequestedPack] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, number>>({});

  const ordersQuery = useQuery({
    queryKey: ['admin-orders', status, paymentMethod, debouncedSearch, startDate, endDate],
    queryFn: () =>
      adminApi.orders({
        status,
        paymentMethod,
        search: debouncedSearch,
        startDate,
        endDate,
        limit: 100,
      }),
    placeholderData: (previousData) => previousData,
  });

  const orderDetailQuery = useQuery({
    queryKey: ['admin-order-detail', selectedOrderId],
    queryFn: () => adminApi.orderDetail(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  const inventoryQuery = useQuery({
    queryKey: ['admin-dealer-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  const requestQuery = useQuery({
    queryKey: ['admin-product-requests'],
    queryFn: () => adminApi.productRequests({ limit: 30 }),
  });

  useEffect(() => {
    const nextInventoryQuery = searchParams.get('inventory') || '';
    if (nextInventoryQuery !== inventorySearch) {
      setInventorySearch(nextInventoryQuery);
    }
  }, [inventorySearch, searchParams]);

  const filteredInventory = useMemo(() => {
    const rows = inventoryQuery.data || [];
    const searchValue = inventorySearch.trim().toLowerCase();
    if (!searchValue) return rows;

    return rows.filter((product) => {
      return product.name.toLowerCase().includes(searchValue)
        || product.slug.toLowerCase().includes(searchValue);
    });
  }, [inventoryQuery.data, inventorySearch]);

  useEffect(() => {
    if (!inventoryQuery.data) return;

    const nextDraft: Record<string, number> = {};
    for (const product of inventoryQuery.data) {
      for (const variant of product.variants) {
        nextDraft[`${product.id}:${variant.id}`] = variant.quantity;
      }
    }

    setInventoryDraft(nextDraft);
  }, [inventoryQuery.data]);

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

  const updateStatusMutation = useMutation({
    mutationFn: () => adminApi.updateOrderStatus(selectedOrderId!, { status: nextStatus, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-order-detail', selectedOrderId] });
      setNote('');
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: (entries: Array<{ productId: string; variantId: string; quantity: number }>) => adminApi.updateInventory(entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dealer-inventory'] });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: () =>
      adminApi.createProductRequest({
        productId: selectedProductId || undefined,
        productName: requestedProductName || undefined,
        requestedQuantity,
        requestedPack,
        notes: requestNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setSelectedProductId('');
      setRequestedProductName('');
      setRequestedQuantity(1);
      setRequestedPack('');
      setRequestNotes('');
    },
  });

  const detail = orderDetailQuery.data;
  const isOrderModalOpen = Boolean(selectedOrderId);

  if ((ordersQuery.isLoading && !ordersQuery.data) || inventoryQuery.isLoading || requestQuery.isLoading) {
    return <LoadingBlock label="Loading dealer workspace..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders & Inventory"
        subtitle="Update order status, refill dealer stock quantities, and send product requests to super admin."
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
                <div>
                  <p className="font-black text-slate-900">{product.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{product.slug}</p>
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

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Request Product</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Ask Super Admin for New Stock</h3>

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="request-existing-product"
                className="mb-2 block text-sm font-semibold tracking-[0.01em] text-slate-700"
              >
                Existing Product (Optional)
              </label>
              <select
                id="request-existing-product"
                value={selectedProductId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedProductId(nextId);
                  const selectedProduct = inventoryQuery.data?.find((product) => product.id === nextId);
                  if (selectedProduct) {
                    setRequestedProductName(selectedProduct.name);
                  }
                }}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              >
                <option value="">Select existing product (optional)</option>
                {inventoryQuery.data?.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="request-product-name"
                className="mb-2 block text-sm font-semibold tracking-[0.01em] text-slate-700"
              >
                Product Name
              </label>
              <input
                id="request-product-name"
                value={requestedProductName}
                onChange={(event) => setRequestedProductName(event.target.value)}
                placeholder="Product name"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor="request-quantity"
                  className="mb-2 block text-sm font-semibold tracking-[0.01em] text-slate-700"
                >
                  Quantity
                </label>
                <input
                  id="request-quantity"
                  type="number"
                  min={1}
                  value={requestedQuantity}
                  onChange={(event) => setRequestedQuantity(Math.max(1, Number(event.target.value) || 1))}
                  placeholder="Quantity"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                />
              </div>
              <div>
                <label
                  htmlFor="request-pack"
                  className="mb-2 block text-sm font-semibold tracking-[0.01em] text-slate-700"
                >
                  Pack Size
                </label>
                <input
                  id="request-pack"
                  value={requestedPack}
                  onChange={(event) => setRequestedPack(event.target.value)}
                  placeholder="Pack size (Liter/Gram)"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="request-notes"
                className="mb-2 block text-sm font-semibold tracking-[0.01em] text-slate-700"
              >
                Extra Details
              </label>
              <textarea
                id="request-notes"
                value={requestNotes}
                onChange={(event) => setRequestNotes(event.target.value)}
                placeholder="Extra details"
                className="min-h-[90px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <button
              type="button"
              disabled={createRequestMutation.isPending}
              onClick={() => createRequestMutation.mutate()}
              className="w-full rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white"
            >
              {createRequestMutation.isPending ? 'Sending...' : 'Send Product Request'}
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Requested Items</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Latest Product Requests</h3>

          <div className="mt-4 space-y-3">
            {requestQuery.data?.data.map((request) => (
              <div key={request.id} className="rounded-xl border border-primary-100 bg-primary-50/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{request.productName}</p>
                    <p className="text-xs text-slate-500">
                      Qty: {request.requestedQuantity} {request.requestedPack || ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-primary-700">
                    {request.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{request.notes || 'No note provided'}</p>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(request.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-5">
        <div>
          <label htmlFor="order-search" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Search Order
          </label>
          <input
            id="order-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order number"
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
        </div>
        <div>
          <label htmlFor="order-status" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Order Status
          </label>
          <select
            id="order-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          >
            <option value="">All statuses</option>
            {['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment-method" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Payment Method
          </label>
          <select
            id="payment-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          >
            <option value="">All payment methods</option>
            {['razorpay', 'cod'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="start-date" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
        </div>
      </div>

      {ordersQuery.isFetching ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Refreshing orders...</p>
      ) : null}

      <div className="grid gap-4">
        {ordersQuery.data?.data.map((order) => (
          <button
            key={order.id}
            onClick={() => {
              setSelectedOrderId(order.id);
              setNextStatus(order.status);
            }}
            className="rounded-[1.5rem] border border-primary-100 bg-white p-4 text-left"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {order.userId?.name || 'Customer'} · {formatDateTime(order.createdAt)} ·{' '}
                  {order.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}
                </p>
              </div>
              <div className="grid gap-2 text-left md:text-right">
                <span className="text-sm font-black uppercase tracking-[0.15em] text-primary-700">{order.status}</span>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  {order.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}
                </span>
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
              <button
                onClick={() => setSelectedOrderId(null)}
                className="rounded-2xl border border-primary-100 px-4 py-2 text-sm font-semibold text-slate-600"
              >
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
                        <div
                          key={`${item.productId}-${index}`}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-primary-100 bg-white p-4"
                        >
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
                              <p className="mt-1 text-sm text-slate-500">
                                {item.variantLabel} · {item.qty} qty
                              </p>
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
                      <p>
                        <span className="font-black text-slate-900">Name:</span> {detail.userId?.name || '-'}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Mobile:</span>{' '}
                        {detail.userId?.mobile || detail.shippingAddress?.mobile || '-'}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Email:</span> {detail.userId?.email || '-'}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Address:</span>{' '}
                        {formatAddress(detail.shippingAddress || detail.userId?.savedAddress)}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Service Mode:</span>{' '}
                        {detail.serviceMode === 'pickup' ? 'Pickup' : 'Delivery'}
                      </p>
                      <p>
                        <span className="font-black text-slate-900">Razorpay Payment ID:</span>{' '}
                        {detail.razorpayPaymentId || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                    <h3 className="text-lg font-black text-slate-900">Order Summary</h3>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-semibold text-slate-900">{currencyFormatter.format(detail.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coupon</span>
                        <span className="font-semibold text-slate-900">- {currencyFormatter.format(detail.couponDiscount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Delivery</span>
                        <span className="font-semibold text-slate-900">{currencyFormatter.format(detail.deliveryCharge)}</span>
                      </div>
                      <div className="flex justify-between border-t border-primary-100 pt-3">
                        <span className="font-black text-slate-900">Total</span>
                        <span className="font-black text-slate-900">{currencyFormatter.format(detail.totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
                    <h3 className="text-lg font-black text-slate-900">Status Update</h3>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label
                          htmlFor="update-status"
                          className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                        >
                          Next Status
                        </label>
                      <select
                        id="update-status"
                        value={nextStatus}
                        onChange={(event) => setNextStatus(event.target.value)}
                        className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                      >
                        {['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      </div>
                      <div>
                        <label
                          htmlFor="status-note"
                          className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                        >
                          Note
                        </label>
                      <textarea
                        id="status-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Optional note"
                        className="min-h-[90px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                      />
                      </div>
                      <button
                        onClick={() => updateStatusMutation.mutate()}
                        className="w-full rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white"
                      >
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
