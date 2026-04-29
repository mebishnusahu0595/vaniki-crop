import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, User, Warehouse, Box } from 'lucide-react';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';
import type { ProductRequest } from '../types/admin';

const ACTION_STATUSES = ['approved', 'rejected', 'fulfilled'] as const;

type ActionStatus = (typeof ACTION_STATUSES)[number];

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ActionStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [selectedRequest, setSelectedRequest] = useState<ProductRequest | null>(null);

  const requestQuery = useQuery({
    queryKey: ['super-admin-product-requests', status],
    queryFn: () => adminApi.productRequests({ status: status || undefined, limit: 100 }),
  });

  const updateRequestMutation = useMutation({
    mutationFn: (payload: { id: string; status: ActionStatus; superAdminNote?: string }) =>
      adminApi.updateProductRequest(payload.id, {
        status: payload.status,
        superAdminNote: payload.superAdminNote,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-product-requests'] });
      setSelectedRequest(null);
    },
  });

  if (requestQuery.isLoading) {
    return <LoadingBlock label="Loading product requests..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Product Requests"
        subtitle="Review dealer requests and approve, reject, or mark them fulfilled."
      />

      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:w-[320px] outline-none focus:ring-2 focus:ring-primary-500 transition"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      <div className="grid gap-4">
        {requestQuery.data?.data.map((request) => {
          const nextStatus = statusDraft[request.id] || 'approved';
          const superAdminNote = noteDraft[request.id] || '';

          return (
            <div key={request.id} className="group rounded-[1.5rem] border border-primary-100 bg-white p-5 shadow-sm hover:border-primary-300 transition-all duration-300">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-slate-900">{request.productName}</p>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="rounded-full p-1 text-primary-500 hover:bg-primary-50 transition"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><User size={14} className="text-primary-500" /> {request.requestedBy?.name || 'Unknown'}</span>
                    <span className="flex items-center gap-1.5"><Warehouse size={14} className="text-primary-500" /> {request.store?.name || 'Unassigned'}</span>
                    <span className="flex items-center gap-1.5"><Box size={14} className="text-primary-500" /> {request.petiQuantity} Peti ({request.petiSize} {request.petiUnit})</span>
                  </div>
                  {request.productId && request.requestedPack && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 border border-amber-100">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Admin Price:</span>
                      <span className="text-sm font-black text-amber-900">
                        ₹{request.productId.variants.find(v => v.label === request.requestedPack)?.adminPrice || 'N/A'}
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-400 font-medium tracking-wide uppercase">
                    Garage: <span className="text-slate-600">{request.garageName || 'N/A'}</span> · Requested {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                    request.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    request.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {request.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[200px_1fr_auto]">
                <select
                  value={nextStatus}
                  onChange={(event) =>
                    setStatusDraft((prev) => ({
                      ...prev,
                      [request.id]: event.target.value as ActionStatus,
                    }))
                  }
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 transition"
                >
                  {ACTION_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>

                <input
                  value={superAdminNote}
                  onChange={(event) =>
                    setNoteDraft((prev) => ({
                      ...prev,
                      [request.id]: event.target.value,
                    }))
                  }
                  placeholder="Super Admin Note (Optional)"
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500 transition"
                />

                <button
                  type="button"
                  onClick={() => updateRequestMutation.mutate({ id: request.id, status: nextStatus, superAdminNote })}
                  disabled={updateRequestMutation.isPending}
                  className="rounded-2xl bg-slate-900 px-8 py-3 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-lg shadow-slate-200"
                >
                  {updateRequestMutation.isPending ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2.5rem] border border-primary-100 bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-500 p-2.5 text-white shadow-lg">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Full Details</p>
                  <h2 className="text-xl font-black text-slate-900 leading-none mt-1">Product Request</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-primary-100 p-2 text-slate-400 hover:bg-primary-50 transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-primary-50/50 p-4 border border-primary-50">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Product</p>
                  <p className="font-black text-slate-900">{selectedRequest.productName}</p>
                </div>
                <div className="rounded-2xl bg-primary-50/50 p-4 border border-primary-50">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Garage</p>
                  <p className="font-black text-slate-900">{selectedRequest.garageName || 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Request Quantity</p>
                    <p className="text-3xl font-black">{selectedRequest.petiQuantity} <span className="text-sm font-bold text-slate-400 uppercase">Peti</span></p>
                  </div>
                  <div className="text-right border-l border-white/10 pl-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Admin Price</p>
                    <p className="text-3xl font-black">
                      ₹{selectedRequest.productId?.variants.find(v => v.label === selectedRequest.requestedPack)?.adminPrice || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Dealer</p>
                  <p className="font-bold text-slate-900 leading-tight">{selectedRequest.requestedBy?.name}</p>
                  <p className="text-xs text-slate-500">{selectedRequest.requestedBy?.mobile}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Store</p>
                  <p className="font-bold text-slate-900 leading-tight">{selectedRequest.store?.name}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Dealer Notes</p>
                <div className="rounded-2xl bg-primary-50/30 p-4 border border-primary-50 italic text-sm text-slate-600">
                  "{selectedRequest.notes || 'No notes provided'}"
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedRequest(null)}
              className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800 transition shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
