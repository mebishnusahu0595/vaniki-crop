import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Warehouse, Box, ChevronLeft, ChevronRight, FileText, Clock, Download } from 'lucide-react';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime, currencyFormatter } from '../utils/format';
import type { ProductRequest } from '../types/admin';

const ACTION_STATUSES = ['approved', 'rejected', 'fulfilled'] as const;

type ActionStatus = (typeof ACTION_STATUSES)[number];

function getProductDisplayName(item: any): string {
  const pObj = typeof item.productId === 'object' ? item.productId : null;
  const brand = pObj?.name?.trim();
  const tech = pObj?.shortDescription?.trim();
  const rawName = item.productName?.trim() || '';

  if (brand && tech) {
    if (brand.toLowerCase() === tech.toLowerCase()) return brand;
    if (rawName.includes('(') && rawName.includes(')')) return rawName;
    return `${brand} (${tech})`;
  }
  if (brand && rawName && brand.toLowerCase() !== rawName.toLowerCase()) {
    if (!rawName.includes('(')) {
      return `${brand} (${rawName})`;
    }
  }
  return rawName || brand || tech || 'Product';
}

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ActionStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [approvingGroup, setApprovingGroup] = useState<any | null>(null);
  const [approvalForm, setApprovalForm] = useState<{
    invoiceNumber: string;
    invoiceDate: string;
    buyerOrderNo: string;
    buyerOrderDate: string;
    dispatchDocNo: string;
    dispatchDate: string;
    despatchedThrough: string;
    destination: string;
    termsOfDelivery: string;
    paymentTerms: string;
    items: Array<{
      requestId: string;
      productName: string;
      hsnCode: string;
      qty: number;
      price: number;
      taxRate: number;
    }>;
  }>({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    buyerOrderNo: '',
    buyerOrderDate: new Date().toISOString().split('T')[0],
    dispatchDocNo: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    despatchedThrough: 'Vaniki Fleet / Transport',
    destination: '',
    termsOfDelivery: 'Door Delivery',
    paymentTerms: 'Immediate / On Delivery',
    items: [],
  });

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

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingInvoiceId(invoiceId);
    try {
      const blob = await adminApi.downloadB2BInvoice(invoiceId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download invoice: ' + (err?.message || 'Unknown error'));
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleOpenApprovalModal = (group: any) => {
    const today = new Date().toISOString().split('T')[0];
    const generatedInvNo = `VANIKI-B2B-${Math.floor(1000 + Math.random() * 9000)}`;
    const storeDest = group.store?.address?.city || group.store?.address?.state || 'Ambagarh Chauki';

    const initialItems = group.items.map((item: any) => {
      const pQty = Number(item.petiQuantity || 1);
      const pSize = Number(item.petiSize || 12);
      const totalUnits = Number(item.requestedQuantity || (pQty * pSize) || pQty || 1);
      const unitPrice = Number(item.offerPrice || item.dealerPrice || item.price || 100);

      return {
        requestId: item.id,
        productName: getProductDisplayName(item),
        hsnCode: item.hsnCode || '38089190',
        qty: totalUnits,
        price: unitPrice,
        taxRate: 18,
      };
    });

    setApprovalForm({
      invoiceNumber: generatedInvNo,
      invoiceDate: today,
      buyerOrderNo: group.batchId || `REQ-${group.items[0]?.id?.slice(-6).toUpperCase() || 'ORD'}`,
      buyerOrderDate: group.createdAt ? new Date(group.createdAt).toISOString().split('T')[0] : today,
      dispatchDocNo: `LR-${Math.floor(1000 + Math.random() * 9000)}`,
      dispatchDate: today,
      despatchedThrough: 'Vaniki Fleet / Transport',
      destination: storeDest,
      termsOfDelivery: 'Door Delivery',
      paymentTerms: 'Immediate / On Delivery',
      items: initialItems,
    });

    setApprovingGroup(group);
  };

  const handleConfirmApprovalAndInvoice = async () => {
    if (!approvingGroup) return;
    const storeId = approvingGroup.storeIdStr;
    if (!storeId || storeId === 'unknown') {
      alert('Cannot determine store ID for this request group.');
      return;
    }

    setIsSubmittingApproval(true);
    try {
      // 1. Create B2B Invoice with all transport & item details
      const createdInvoice = await adminApi.createB2BInvoice({
        storeId,
        invoiceNumber: approvalForm.invoiceNumber,
        invoiceDate: approvalForm.invoiceDate,
        buyerOrderNo: approvalForm.buyerOrderNo,
        buyerOrderDate: approvalForm.buyerOrderDate,
        dispatchDocNo: approvalForm.dispatchDocNo,
        dispatchDate: approvalForm.dispatchDate,
        despatchedThrough: approvalForm.despatchedThrough,
        destination: approvalForm.destination,
        termsOfDelivery: approvalForm.termsOfDelivery,
        paymentTerms: approvalForm.paymentTerms,
        items: approvalForm.items.map((i) => ({
          productName: i.productName,
          hsnCode: i.hsnCode,
          qty: Number(i.qty),
          price: Number(i.price),
          taxRate: Number(i.taxRate),
        })),
      } as any);

      const invoiceId = createdInvoice?._id || createdInvoice?.id;

      // 2. Mark all items in this group as approved
      await Promise.all(
        approvingGroup.items.map((item: any) =>
          adminApi.updateProductRequest(item.id, {
            status: 'approved',
            invoiceId: invoiceId || undefined,
            superAdminNote: `Approved with Invoice ${approvalForm.invoiceNumber} and queued for Tally sync`,
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ['super-admin-product-requests'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
      setApprovingGroup(null);
      alert(`✅ Success! Invoice ${approvalForm.invoiceNumber} created and synced to Tally!`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate invoice: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmittingApproval(false);
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
                            {getProductDisplayName(item)}
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

                <div className="flex flex-wrap items-center gap-3">
                  {(() => {
                    const linkedInvoice = group.items.find((i: any) => i.invoiceId)?.invoiceId || (group.items[0] as any)?.invoiceId;
                    const invoiceIdStr = typeof linkedInvoice === 'object' ? (linkedInvoice?.id || linkedInvoice?._id) : linkedInvoice;
                    const invoiceNumStr = typeof linkedInvoice === 'object' ? (linkedInvoice?.invoiceNumber || 'B2B') : 'B2B';

                    return (
                      <>
                        {invoiceIdStr && (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(invoiceIdStr, invoiceNumStr)}
                            disabled={downloadingInvoiceId === invoiceIdStr}
                            className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-md hover:bg-slate-800 active:scale-95 transition"
                          >
                            <Download size={15} strokeWidth={2.5} />
                            <span>{downloadingInvoiceId === invoiceIdStr ? 'Downloading...' : 'Download Invoice PDF'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenApprovalModal(group)}
                          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition"
                        >
                          <FileText size={16} strokeWidth={2.5} />
                          <span>{invoiceIdStr ? 'Re-Generate / Edit Invoice' : 'Approve & Generate B2B Invoice'}</span>
                        </button>
                      </>
                    );
                  })()}
                </div>
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

      {/* Approval & Dispatch Details Review Modal */}
      {approvingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-primary-100 bg-white p-8 md:p-10 shadow-2xl animate-in fade-in zoom-in duration-200 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-lg shadow-emerald-500/20">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Tally Auto-Sync Approval</p>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">Review & Confirm B2B Invoice</h2>
                </div>
              </div>
              <button
                onClick={() => setApprovingGroup(null)}
                disabled={isSubmittingApproval}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-6">
              {/* Store & Dealer Summary Banner */}
              <div className="grid gap-4 md:grid-cols-3 rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Store</p>
                  <p className="font-black text-slate-900 mt-0.5">{approvingGroup.store?.name || 'Store'}</p>
                  <p className="text-xs text-slate-500">{approvingGroup.store?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dealer Admin</p>
                  <p className="font-bold text-slate-800 mt-0.5">{approvingGroup.requestedBy?.name || 'Bishnu prasad sahu'}</p>
                  <p className="text-xs text-slate-500">{approvingGroup.requestedBy?.mobile || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Garage / Batch</p>
                  <p className="font-bold text-slate-800 mt-0.5">{approvingGroup.garageName}</p>
                  <p className="text-xs font-mono text-emerald-700 font-bold">{approvalForm.buyerOrderNo}</p>
                </div>
              </div>

              {/* Items Summary & Editable Prices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    📦 Products in Invoice ({approvalForm.items.length})
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">HSN</th>
                        <th className="p-3 text-right">Qty (Units)</th>
                        <th className="p-3 text-right">Price / Unit</th>
                        <th className="p-3 text-right">Tax Rate</th>
                        <th className="p-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {approvalForm.items.map((item, idx) => {
                        const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-black text-slate-900">{item.productName}</td>
                            <td className="p-3">
                              <input
                                value={item.hsnCode}
                                onChange={(e) => {
                                  const updated = [...approvalForm.items];
                                  updated[idx].hsnCode = e.target.value;
                                  setApprovalForm({ ...approvalForm, items: updated });
                                }}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => {
                                  const updated = [...approvalForm.items];
                                  updated[idx].qty = Number(e.target.value);
                                  setApprovalForm({ ...approvalForm, items: updated });
                                }}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 text-right outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  const updated = [...approvalForm.items];
                                  updated[idx].price = Number(e.target.value);
                                  setApprovalForm({ ...approvalForm, items: updated });
                                }}
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 text-right outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </td>
                            <td className="p-3 text-right font-bold text-slate-600">18% GST</td>
                            <td className="p-3 text-right font-black text-slate-900">
                              {currencyFormatter.format(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 🚚 Transport & Dispatch Details Box */}
              <div className="rounded-2xl border border-primary-100 bg-primary-50/20 p-6 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-primary-700 flex items-center gap-2">
                  🚚 Transport & Dispatch Parameters (Printed on Tally Invoice)
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Invoice Number</label>
                    <input
                      value={approvalForm.invoiceNumber}
                      onChange={(e) => setApprovalForm({ ...approvalForm, invoiceNumber: e.target.value })}
                      placeholder="e.g. VANIKI-B2B-1001"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Invoice Date</label>
                    <input
                      type="date"
                      value={approvalForm.invoiceDate}
                      onChange={(e) => setApprovalForm({ ...approvalForm, invoiceDate: e.target.value })}
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Buyer Order No.</label>
                    <input
                      value={approvalForm.buyerOrderNo}
                      onChange={(e) => setApprovalForm({ ...approvalForm, buyerOrderNo: e.target.value })}
                      placeholder="Order / Batch ID"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Buyer Order Date</label>
                    <input
                      type="date"
                      value={approvalForm.buyerOrderDate}
                      onChange={(e) => setApprovalForm({ ...approvalForm, buyerOrderDate: e.target.value })}
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Despatch Doc / LR No.</label>
                    <input
                      value={approvalForm.dispatchDocNo}
                      onChange={(e) => setApprovalForm({ ...approvalForm, dispatchDocNo: e.target.value })}
                      placeholder="e.g. LR-9842"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Delivery Note Date</label>
                    <input
                      type="date"
                      value={approvalForm.dispatchDate}
                      onChange={(e) => setApprovalForm({ ...approvalForm, dispatchDate: e.target.value })}
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Despatched Through / Transport</label>
                    <input
                      value={approvalForm.despatchedThrough}
                      onChange={(e) => setApprovalForm({ ...approvalForm, despatchedThrough: e.target.value })}
                      placeholder="e.g. Vaniki Fleet / VRL"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Destination</label>
                    <input
                      value={approvalForm.destination}
                      onChange={(e) => setApprovalForm({ ...approvalForm, destination: e.target.value })}
                      placeholder="e.g. Ambagarh Chauki"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Terms of Delivery</label>
                    <input
                      value={approvalForm.termsOfDelivery}
                      onChange={(e) => setApprovalForm({ ...approvalForm, termsOfDelivery: e.target.value })}
                      placeholder="e.g. Door Delivery"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Mode / Terms of Payment</label>
                    <input
                      value={approvalForm.paymentTerms}
                      onChange={(e) => setApprovalForm({ ...approvalForm, paymentTerms: e.target.value })}
                      placeholder="e.g. Immediate / 30 Days"
                      className="w-full rounded-xl border border-primary-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Total Calculation Display */}
              {(() => {
                const totalGross = approvalForm.items.reduce((acc, i) => acc + (Number(i.qty || 0) * Number(i.price || 0)), 0);
                const taxable = totalGross / 1.18;
                const cgst = (totalGross - taxable) / 2;
                const sgst = (totalGross - taxable) / 2;

                return (
                  <div className="flex flex-wrap items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Total Invoice Amount</p>
                      <p className="text-3xl font-black mt-0.5">{currencyFormatter.format(totalGross)}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Taxable: {currencyFormatter.format(taxable)} | CGST 9%: {currencyFormatter.format(cgst)} | SGST 9%: {currencyFormatter.format(sgst)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setApprovingGroup(null)}
                        disabled={isSubmittingApproval}
                        className="rounded-2xl border border-white/20 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmApprovalAndInvoice}
                        disabled={isSubmittingApproval}
                        className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-8 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-slate-950 font-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50"
                      >
                        <FileText size={16} strokeWidth={3} />
                        <span>{isSubmittingApproval ? 'Creating & Syncing to Tally...' : 'Confirm & Sync to Tally'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
