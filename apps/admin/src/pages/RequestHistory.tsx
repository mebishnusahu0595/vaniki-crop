import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Info, Package } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';
import type { DealerProductRequest } from '../types/admin';

export default function RequestHistoryPage() {
  const [selectedRequest, setSelectedRequest] = useState<DealerProductRequest | null>(null);

  const requestQuery = useQuery({
    queryKey: ['admin-product-requests'],
    queryFn: () => adminApi.productRequests({ limit: 50 }),
  });

  if (requestQuery.isLoading) {
    return <LoadingBlock label="Loading request history..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Request History"
        subtitle="View and track all your previous product requests."
      />

      <section className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-500">History</p>
            <h3 className="text-xl font-black text-slate-900">Recent Requests</h3>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Package size={48} strokeWidth={1} />
              <p className="mt-4 font-bold uppercase tracking-widest text-xs">No requests yet</p>
            </div>
          )}
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
