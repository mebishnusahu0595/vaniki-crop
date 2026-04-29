import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Info, Package, Truck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';
import type { DealerProductRequest } from '../types/admin';

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedProductName, setRequestedProductName] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [requestedPack, setRequestedPack] = useState('');
  const [garageName, setGarageName] = useState('');
  const [petiQuantity, setPetiQuantity] = useState(1);
  const [petiSize, setPetiSize] = useState(12);
  const [petiUnit, setPetiUnit] = useState<'Liter' | 'Kg'>('Liter');
  const [requestNotes, setRequestNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<DealerProductRequest | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ['admin-dealer-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  const requestQuery = useQuery({
    queryKey: ['admin-product-requests'],
    queryFn: () => adminApi.productRequests({ limit: 50 }),
  });

  const createRequestMutation = useMutation({
    mutationFn: () =>
      adminApi.createProductRequest({
        productId: selectedProductId || undefined,
        productName: requestedProductName || undefined,
        requestedQuantity,
        requestedPack,
        garageName,
        petiQuantity,
        petiSize,
        petiUnit,
        notes: requestNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setSelectedProductId('');
      setRequestedProductName('');
      setRequestedQuantity(1);
      setRequestedPack('');
      setGarageName('');
      setPetiQuantity(1);
      setPetiSize(12);
      setPetiUnit('Liter');
      setRequestNotes('');
    },
  });

  if (inventoryQuery.isLoading || requestQuery.isLoading) {
    return <LoadingBlock label="Loading product requests..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Product Requests"
        subtitle="Manage your inventory by requesting new stock from the super admin."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-primary-100 p-2.5 text-primary-600">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">New Request</p>
              <h3 className="text-xl font-black text-slate-900">Ask Super Admin</h3>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="garage-name" className="mb-2 block text-sm font-bold text-slate-700">
                Garage Name (Kahan se aaye material)
              </label>
              <input
                id="garage-name"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
                placeholder="Enter garage name"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 focus:ring-2 focus:ring-primary-500 outline-none transition"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="request-existing-product" className="mb-2 block text-sm font-bold text-slate-700">
                  Select Product
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
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
                >
                  <option value="">Choose product</option>
                  {inventoryQuery.data?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="request-product-name" className="mb-2 block text-sm font-bold text-slate-700">
                  Product Name (Manual)
                </label>
                <input
                  id="request-product-name"
                  value={requestedProductName}
                  onChange={(event) => setRequestedProductName(event.target.value)}
                  placeholder="Or enter name manually"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
                />
              </div>

              {selectedProductId && (
                <div className="md:col-span-2">
                  <label htmlFor="request-pack" className="mb-2 block text-sm font-bold text-slate-700">
                    Select Pack Size (Variant)
                  </label>
                  <select
                    id="request-pack"
                    value={requestedPack}
                    onChange={(e) => setRequestedPack(e.target.value)}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
                  >
                    <option value="">Choose pack</option>
                    {inventoryQuery.data?.find(p => p.id === selectedProductId)?.variants.map(v => (
                      <option key={v.id} value={v.label}>{v.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedProductId && (
                <div className="md:col-span-2 rounded-2xl bg-slate-900 p-4 border border-slate-800 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-3">Product Pricing Information</p>
                  <div className="grid gap-3">
                    {inventoryQuery.data?.find(p => p.id === selectedProductId)?.variants.map(v => (
                      <div key={v.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-xs font-bold text-slate-300">{v.label}</span>
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-primary-500">Price</p>
                          <p className="text-xs font-black text-primary-400">
                            ₹{v.adminPrice || v.price}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-primary-50/50 p-4 border border-primary-100">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-primary-600 mb-4">Peti Details (Box/Case)</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">Peti Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={petiQuantity}
                    onChange={(e) => setPetiQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">Peti Size</label>
                  <input
                    type="number"
                    min={1}
                    value={petiSize}
                    onChange={(e) => setPetiSize(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">Unit</label>
                  <select
                    value={petiUnit}
                    onChange={(e) => setPetiUnit(e.target.value as 'Liter' | 'Kg')}
                    className="w-full rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <option value="Liter">Liter</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-primary-700">
                Total Request: {petiQuantity * petiSize} {petiUnit}s ({petiQuantity} Peti × {petiSize} {petiUnit})
              </p>
            </div>

            <div>
              <label htmlFor="request-notes" className="mb-2 block text-sm font-bold text-slate-700">
                Additional Notes
              </label>
              <textarea
                id="request-notes"
                value={requestNotes}
                onChange={(event) => setRequestNotes(event.target.value)}
                placeholder="Any special instructions..."
                className="min-h-[100px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>

            <button
              type="button"
              disabled={createRequestMutation.isPending || !garageName || !requestedProductName}
              onClick={() => createRequestMutation.mutate()}
              className="w-full rounded-2xl bg-primary-500 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {createRequestMutation.isPending ? 'Sending...' : 'Send Product Request'}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-600">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-500">History</p>
              <h3 className="text-xl font-black text-slate-900">Recent Requests</h3>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {requestQuery.data?.data.map((request) => (
              <button
                key={request.id}
                onClick={() => setSelectedRequest(request)}
                className="w-full group rounded-2xl border border-primary-50 bg-primary-50/20 p-4 text-left hover:border-primary-200 hover:bg-primary-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900 group-hover:text-primary-700 transition">{request.productName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {request.petiQuantity} Peti × {request.petiSize} {request.petiUnit}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400 font-medium">
                      Garage: {request.garageName} · {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                    request.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    request.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {request.status}
                  </span>
                </div>
              </button>
            ))}
            {requestQuery.data?.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Package size={48} strokeWidth={1} />
                <p className="mt-4 font-bold uppercase tracking-widest text-xs">No requests yet</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2.5rem] border border-primary-100 bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-500 p-2.5 text-white shadow-lg shadow-primary-500/30">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Request Details</p>
                  <h2 className="text-xl font-black text-slate-900 leading-none mt-1">Product Info</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-primary-100 p-2 text-slate-400 hover:bg-primary-50 hover:text-slate-900 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-primary-50/50 p-4 border border-primary-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Product</p>
                  <p className="font-black text-slate-900">{selectedRequest.productName}</p>
                </div>
                <div className="rounded-2xl bg-primary-50/50 p-4 border border-primary-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Garage</p>
                  <p className="font-black text-slate-900">{selectedRequest.garageName || 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Request Quantity</p>
                    <p className="text-2xl font-black">{selectedRequest.petiQuantity} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Peti</span></p>
                  </div>
                  <div className="text-right border-l border-white/10 pl-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Total Volume</p>
                    <p className="text-2xl font-black">{Number(selectedRequest.petiQuantity || 0) * Number(selectedRequest.petiSize || 0)} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{selectedRequest.petiUnit}</span></p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Dealer Notes</p>
                  <div className="rounded-2xl bg-primary-50/30 p-4 border border-primary-50 italic text-sm text-slate-600">
                    "{selectedRequest.notes || 'No notes provided'}"
                  </div>
                </div>

                {selectedRequest.superAdminNote && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2 ml-1">Super Admin Response</p>
                    <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100 text-sm text-amber-900 font-semibold">
                      {selectedRequest.superAdminNote}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedRequest(null)}
              className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
