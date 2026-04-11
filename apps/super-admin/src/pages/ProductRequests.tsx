import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime } from '../utils/format';

const ACTION_STATUSES = ['approved', 'rejected', 'fulfilled'] as const;

type ActionStatus = (typeof ACTION_STATUSES)[number];

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ActionStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

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
    },
  });

  if (requestQuery.isLoading) {
    return <LoadingBlock label="Loading product requests..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Requests"
        subtitle="Review dealer requests and approve, reject, or mark them fulfilled."
      />

      <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:w-[320px]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      <div className="space-y-4">
        {requestQuery.data?.data.map((request) => {
          const nextStatus = statusDraft[request.id] || 'approved';
          const superAdminNote = noteDraft[request.id] || '';

          return (
            <div key={request.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-900">{request.productName}</p>
                  <p className="text-sm text-slate-500">
                    Dealer: {request.requestedBy?.name || 'Unknown'} · Store: {request.store?.name || 'Unassigned'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Qty: {request.requestedQuantity} {request.requestedPack || ''} · {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary-700">
                  {request.status}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/40 p-3 text-sm text-slate-600">
                <p>
                  <span className="font-black text-slate-900">Dealer Note:</span> {request.notes || 'No details provided'}
                </p>
                <p className="mt-2">
                  <span className="font-black text-slate-900">Super Admin Note:</span> {request.superAdminNote || '-'}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <select
                  value={nextStatus}
                  onChange={(event) =>
                    setStatusDraft((prev) => ({
                      ...prev,
                      [request.id]: event.target.value as ActionStatus,
                    }))
                  }
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                >
                  {ACTION_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
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
                  placeholder="Optional admin note"
                  className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                />

                <button
                  type="button"
                  onClick={() => updateRequestMutation.mutate({ id: request.id, status: nextStatus, superAdminNote })}
                  disabled={updateRequestMutation.isPending}
                  className="rounded-2xl bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white"
                >
                  Update
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
