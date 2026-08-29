import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Warehouse, Box, ChevronLeft, ChevronRight, FileText, Clock } from 'lucide-react';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime, currencyFormatter } from '../utils/format';
import type { ProductRequest } from '../types/admin';

const ACTION_STATUSES = ['approved', 'rejected', 'fulfilled'] as const;

type ActionStatus = (typeof ACTION_STATUSES)[number];

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ActionStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [generatingInvoiceKey, setGeneratingInvoiceKey] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status]);

  const requestQuery = useQuery({
    queryKey: ['super-admin-product-requests', status, page],
    queryFn: () => adminApi.productRequests({ status: status || undefined, limit: 50, page }),
  });

  // Group requests logically by batchId or by storeId + minute timestamp
  const groupedRequests = useMemo(() => {
    const rawList = requestQuery.data?.data || [];
    const map = new Map<string, {
      groupKey: string;
      batchId?: string;
      store: any;
      storeIdStr: string;
      requestedBy: any;
      garageName: string;
      createdAt: string;
      status: string;
      notes?: string;
      superAdminNote?: string;
      items: ProductRequest[];
    }>();

    rawList.forEach((req: any) => {
      const storeObj = req.store || (typeof req.storeId === 'object' ? req.storeId : null);
      const storeIdStr = req.store?.id || (typeof req.storeId === 'object' ? (req.storeId?.id || req.storeId?._id) : req.storeId) || 'unknown';
      const timeMinute = req.createdAt ? req.createdAt.slice(0, 16) : 'time';
      const key = req.batchId ? req.batchId : `${storeIdStr}_${timeMinute}_${req.garageName || ''}`;

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          batchId: req.batchId,
          store: storeObj || { name: 'Store' },
          storeIdStr,
          requestedBy: req.requestedBy,
          garageName: req.garageName || 'VANIKI GARAGE',
          createdAt: req.createdAt,
          status: req.status,
          notes: req.notes,
          superAdminNote: req.superAdminNote,
          items: [],
        });
      }
      map.get(key)!.items.push(req);
    });

    return Array.from(map.values());
  }, [requestQuery.data?.data]);

  const handleApproveBatchAndGenerateInvoice = async (group: any) => {
    const storeId = group.storeIdStr;
    if (!storeId || storeId === 'unknown') {
      alert('Cannot determine store ID for this request group.');
      return;
    }

    setGeneratingInvoiceKey(group.groupKey);
    try {
      // 1. Build items list for B2B Invoice
      const invoiceItems = group.items.map((item: any) => {
        const pQty = Number(item.petiQuantity || 1);
        const pSize = Number(item.petiSize || 12);
        const totalUnits = Number(item.requestedQuantity || (pQty * pSize) || pQty || 1);
        const unitPrice = Number(item.offerPrice || item.dealerPrice || item.price || 100);

        return {
          productName: item.productName || 'Product',
          hsnCode: item.hsnCode || '38089190',
          qty: totalUnits,
          price: unitPrice,
          taxRate: 18,
        };
      });

      // 2. Generate B2B Invoice
      await adminApi.createB2BInvoice({
        storeId,
        items: invoiceItems,
      });

      // 3. Mark all items in this group as approved
      await Promise.all(
        group.items.map((item: any) =>
          adminApi.updateProductRequest(item.id, {
            status: 'approved',
            superAdminNote: 'Approved and B2B Invoice Generated for Tally Auto-Sync',
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ['super-admin-product-requests'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
      alert(`✅ Success! B2B Invoice generated with ${invoiceItems.length} products and queued for instant Tally auto-sync!`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate invoice: ' + (err?.message || 'Unknown error'));
    } finally {
      setGeneratingInvoiceKey(null);
    }
  };

  const handleUpdateGroupStatus = async (group: any, newStatus: ActionStatus, note?: string) => {
    try {
      await Promise.all(
        group.items.map((item: any) =>
          adminApi.updateProductRequest(item.id, {
            status: newStatus,
            superAdminNote: note || undefined,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['super-admin-product-requests'] });
      alert(`Updated all ${group.items.length} items to ${newStatus.toUpperCase()}!`);
    } catch (err: any) {
      alert('Failed to update: ' + err?.message);
    }
  };

  if (requestQuery.isLoading) {
    return <LoadingBlock label="Loading product requests..." />;
  }

  const pagination = requestQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Product Requests"
        subtitle="Review dealer orders and approve, reject, or generate consolidated B2B Invoices for Tally."
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

      <div className="grid gap-6">
        {groupedRequests.map((group, groupIndex) => {
          const nextStatus = statusDraft[group.groupKey] || 'approved';
          const superAdminNote = noteDraft[group.groupKey] || '';
          
          let totalPetis = 0;
          let totalEstAmount = 0;

          group.items.forEach((item: any) => {
            const pQty = Number(item.petiQuantity || 1);
            const pSize = Number(item.petiSize || 12);
            const totalUnits = Number(item.requestedQuantity || (pQty * pSize) || pQty || 1);
            const unitPrice = Number(item.offerPrice || item.dealerPrice || item.price || 0);
            totalPetis += pQty;
            totalEstAmount += totalUnits * unitPrice;
          });

          const isPending = group.status === 'pending' || group.items.some((i: any) => i.status === 'pending');

          return (
            <div
              key={group.groupKey}
              className="group overflow-hidden rounded-[2rem] border border-primary-100 bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:border-primary-300 hover:shadow-lg"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-black text-white">
                      Order #{groupIndex + 1}
                    </span>
                    <span className="rounded-xl bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                      {group.items.length} Product{group.items.length > 1 ? 's' : ''} in Request
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Warehouse size={16} className="text-primary-500" />
                      {group.store?.name || 'Unassigned Store'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User size={16} className="text-primary-500" />
                      {group.requestedBy?.name || 'Store Admin'} ({group.requestedBy?.mobile || '-'})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      Garage: <strong className="text-slate-700">{group.garageName}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                      <Clock size={14} className="text-slate-400" />
                      {formatDateTime(group.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                      isPending
                        ? 'bg-amber-100 text-amber-700'
                        : group.status === 'fulfilled'
                        ? 'bg-emerald-100 text-emerald-700'
                        : group.status === 'approved'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {group.status}
                  </span>
                </div>
              </div>

              {/* Products Table */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Product Name</th>
                      <th className="pb-3 pr-4">Pack Size</th>
                      <th className="pb-3 pr-4">HSN</th>
                      <th className="pb-3 pr-4 text-center">Peti Qty</th>
                      <th className="pb-3 pr-4 text-right">Price / Offer</th>
                      <th className="pb-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((item: any, idx: number) => {
                      const pQty = Number(item.petiQuantity || 1);
                      const pSize = Number(item.petiSize || 12);
                      const totalUnits = Number(item.requestedQuantity || (pQty * pSize) || pQty || 1);
                      const unitPrice = Number(item.offerPrice || item.dealerPrice || item.price || 0);
                      const lineTotal = totalUnits * unitPrice;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 pr-4 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 pr-4 font-black text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-3 pr-4 text-xs font-bold text-slate-600">
                            {item.requestedPack || `${item.petiSize} ${item.petiUnit}`}
                          </td>
                          <td className="py-3 pr-4 text-xs font-mono text-slate-500">
                            {item.hsnCode || '38089190'}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-black text-primary-800">
                              <Box size={12} />
                              {item.petiQuantity} Peti ({item.petiSize} {item.petiUnit})
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {item.offerPrice ? (
                              <div>
                                <span className="font-black text-emerald-700">₹{item.offerPrice}</span>
                                {item.dealerPrice && (
                                  <span className="ml-1.5 text-xs text-slate-400 line-through">₹{item.dealerPrice}</span>
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-slate-900">₹{item.dealerPrice || item.price || 0}</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-black text-slate-900">
                            {currencyFormatter.format(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                      <td colSpan={4} className="py-3 pl-2 text-xs font-black uppercase text-slate-500">
                        Order Summary
                      </td>
                      <td className="py-3 text-center text-xs font-black text-slate-900">
                        {totalPetis} Petis Total
                      </td>
                      <td className="py-3 text-right text-xs font-black uppercase text-slate-400">
                        Est. Amount:
                      </td>
                      <td className="py-3 text-right text-base font-black text-primary-700">
                        {currencyFormatter.format(totalEstAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {group.notes && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs italic text-slate-600">
                  <strong>Dealer Note:</strong> "{group.notes}"
                </div>
              )}

              {/* Action Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={nextStatus}
                    onChange={(event) =>
                      setStatusDraft((prev) => ({
                        ...prev,
                        [group.groupKey]: event.target.value as ActionStatus,
                      }))
                    }
                    className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"
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
                        [group.groupKey]: event.target.value,
                      }))
                    }
                    placeholder="Admin Note (Optional)"
                    className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
                  />

                  <button
                    type="button"
                    onClick={() => handleUpdateGroupStatus(group, nextStatus, superAdminNote)}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition"
                  >
                    Update Status
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleApproveBatchAndGenerateInvoice(group)}
                  disabled={generatingInvoiceKey === group.groupKey}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                >
                  <FileText size={16} strokeWidth={2.5} />
                  <span>
                    {generatingInvoiceKey === group.groupKey
                      ? 'Generating Invoice & Syncing...'
                      : 'Approve & Generate B2B Invoice'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {groupedRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
            <div className="mb-6 rounded-full bg-white p-8 shadow-xl">
              <Box size={48} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900">No Product Requests Found</h3>
            <p className="mt-2 font-medium text-slate-500">All dealer requests have been processed.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
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
  );
}
