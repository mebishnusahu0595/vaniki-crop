import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Info, User, Warehouse, Banknote, FileText, CheckCircle2, XCircle, 
  Download, Copy, Check, ExternalLink, Search, Store as StoreIcon,
  ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime, currencyFormatter } from '../utils/format';
import type { ProductRequest } from '../types/admin';

const ACTION_STATUSES = ['approved', 'rejected', 'fulfilled'] as const;
type ActionStatus = (typeof ACTION_STATUSES)[number];

export default function SettlementsPage() {
  const queryClient = useQueryClient();

  // Top Tab State: B2B Invoices vs Commission Settlements
  const [activeTab, setActiveTab] = useState<'b2b_invoices' | 'commission_settlements'>('b2b_invoices');

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: B2B INVOICE PAYMENT VERIFICATION STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [b2bStatus, setB2bStatus] = useState<string>('verification_pending');
  const [b2bSearch, setB2bSearch] = useState<string>('');
  const [b2bPage, setB2bPage] = useState<number>(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Query pending B2B count for header badge
  const pendingCountQuery = useQuery({
    queryKey: ['super-admin-b2b-pending-count'],
    queryFn: () => adminApi.getB2BInvoices({ paymentStatus: 'verification_pending', limit: 1 }),
    refetchInterval: 15000,
  });
  const pendingCount = pendingCountQuery.data?.pagination?.total ?? 0;

  // Query B2B Invoices list
  const b2bInvoicesQuery = useQuery({
    queryKey: ['super-admin-b2b-settlements', b2bStatus, b2bSearch, b2bPage],
    queryFn: () => adminApi.getB2BInvoices({
      paymentStatus: b2bStatus || undefined,
      search: b2bSearch || undefined,
      page: b2bPage,
      limit: 20,
    }),
  });

  const b2bInvoices = b2bInvoicesQuery.data?.data || [];
  const b2bPagination = b2bInvoicesQuery.data?.pagination;
  const b2bTotalPages = b2bPagination?.totalPages || 1;

  // Verify / Mark Paid Mutation
  const verifyB2BPaymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: 'paid' | 'unpaid' }) =>
      adminApi.verifyB2BInvoicePayment(id, { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to update payment status');
    },
  });

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      const blob = await adminApi.downloadB2BInvoice(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tax-Invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download invoice PDF');
    }
  };

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 2: COMMISSION SETTLEMENTS (Product Requests)
  // ──────────────────────────────────────────────────────────────────────────
  const [commStatus, setCommStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ActionStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [selectedRequest, setSelectedRequest] = useState<ProductRequest | null>(null);

  const commRequestQuery = useQuery({
    queryKey: ['super-admin-settlements', commStatus],
    queryFn: () => adminApi.productRequests({ 
      status: commStatus || undefined, 
      search: 'Settlement Request',
      limit: 100 
    }),
  });

  const updateRequestMutation = useMutation({
    mutationFn: (payload: { id: string; status: ActionStatus; superAdminNote?: string }) =>
      adminApi.updateProductRequest(payload.id, {
        status: payload.status,
        superAdminNote: payload.superAdminNote,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-settlements'] });
      setSelectedRequest(null);
    },
  });

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Payment Settlements"
        subtitle="Review and process dealer B2B invoice payments and commission payout settlements."
      />

      {/* Modern Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-3 border-b border-primary-100 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('b2b_invoices')}
          className={`flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
            activeTab === 'b2b_invoices'
              ? 'bg-slate-900 text-white shadow-slate-300'
              : 'bg-white text-slate-600 hover:bg-primary-50 border border-primary-100'
          }`}
        >
          <FileText size={16} className={activeTab === 'b2b_invoices' ? 'text-primary-400' : 'text-slate-400'} />
          <span>B2B Invoice Payments</span>
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {pendingCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commission_settlements')}
          className={`flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
            activeTab === 'commission_settlements'
              ? 'bg-slate-900 text-white shadow-slate-300'
              : 'bg-white text-slate-600 hover:bg-primary-50 border border-primary-100'
          }`}
        >
          <Banknote size={16} className={activeTab === 'commission_settlements' ? 'text-primary-400' : 'text-slate-400'} />
          <span>Commission Settlements</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: B2B INVOICE PAYMENT VERIFICATION VIEW                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'b2b_invoices' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border border-primary-100 bg-white p-4 shadow-sm">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: 'All Invoices', value: '' },
                { label: '⏳ Verification Pending', value: 'verification_pending', badge: pendingCount },
                { label: '✓ Paid / Verified', value: 'paid' },
                { label: '✕ Payment Due (Unpaid)', value: 'unpaid' },
              ].map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => {
                    setB2bStatus(pill.value);
                    setB2bPage(1);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                    b2bStatus === pill.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{pill.label}</span>
                  {pill.badge !== undefined && pill.badge > 0 && (
                    <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                      b2bStatus === pill.value ? 'bg-white text-primary-700' : 'bg-amber-500 text-white'
                    }`}>
                      {pill.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice or UTR..."
                value={b2bSearch}
                onChange={(e) => {
                  setB2bSearch(e.target.value);
                  setB2bPage(1);
                }}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50/50 pl-10 pr-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* List of Invoices */}
          {b2bInvoicesQuery.isLoading ? (
            <LoadingBlock label="Loading B2B invoice settlements..." />
          ) : b2bInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-primary-100 border-dashed text-center">
              <FileText size={48} className="text-slate-300 mb-3" />
              <h3 className="text-lg font-black text-slate-800">No B2B invoice settlements found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {b2bStatus === 'verification_pending' 
                  ? 'Great job! No pending payment verification proofs right now.'
                  : 'No invoices matching the selected filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {b2bInvoices.map((inv: any) => {
                const isPending = inv.paymentStatus === 'verification_pending';
                const isPaid = inv.paymentStatus === 'paid';
                const isUnpaid = inv.paymentStatus === 'unpaid';

                return (
                  <div
                    key={inv._id}
                    className={`rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-200 ${
                      isPending 
                        ? 'border-amber-300 ring-2 ring-amber-100' 
                        : isPaid 
                          ? 'border-emerald-200 hover:border-emerald-300' 
                          : 'border-primary-100 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      {/* Left: Invoice & Store Details */}
                      <div className="flex-1 min-w-[280px]">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-2xl p-3 ${
                            isPending ? 'bg-amber-500 text-white' : isPaid ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'
                          }`}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-black text-slate-900">{inv.invoiceNumber}</h3>
                              {isPending && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full animate-pulse">
                                  ⏳ Verification Pending
                                </span>
                              )}
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                                  ✓ Verified & Paid
                                </span>
                              )}
                              {isUnpaid && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-200 px-3 py-1 rounded-full">
                                  ✕ Payment Due
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-400 mt-0.5">
                              Dated {format(new Date(inv.invoiceDate), 'dd MMM yyyy')}
                            </p>
                          </div>
                        </div>

                        {/* Store Info */}
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-900">
                            <StoreIcon size={14} className="text-primary-600" />
                            {inv.storeId?.name || 'Assigned Store'}
                          </span>
                          {inv.storeId?.mobile && (
                            <span className="flex items-center gap-1 text-slate-500">
                              📞 {inv.storeId.mobile}
                            </span>
                          )}
                          {inv.destination && (
                            <span className="flex items-center gap-1 text-slate-500">
                              📍 {inv.destination}
                            </span>
                          )}
                        </div>

                        {/* Billed Items preview */}
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Billed Products ({inv.items?.length || 0})
                          </p>
                          {inv.items?.slice(0, 2).map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-slate-700">
                              <span className="font-semibold truncate pr-2">{item.productName}</span>
                              <span className="font-mono text-slate-500">{item.qty} pcs • ₹{Number(item.total).toFixed(2)}</span>
                            </div>
                          ))}
                          {inv.items?.length > 2 && (
                            <p className="text-[10px] font-bold text-primary-600 italic">
                              + {inv.items.length - 2} more items in invoice
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount & PDF Download */}
                      <div className="flex flex-col items-end gap-3 text-right">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Settlement</p>
                          <p className="text-2xl font-black text-slate-900">{currencyFormatter.format(inv.totalAmount)}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-600 transition shadow-sm"
                        >
                          <Download size={14} />
                          <span>{isPaid ? 'Download Paid PDF' : 'Download Invoice PDF'}</span>
                        </button>
                      </div>
                    </div>

                    {/* ───────────────────────────────────────────────────────── */}
                    {/* PAYMENT VERIFICATION PROOFS & ACTIONS BOX                */}
                    {/* ───────────────────────────────────────────────────────── */}
                    <div className={`mt-5 rounded-2xl p-4 border transition-all ${
                      isPending 
                        ? 'bg-amber-50/80 border-amber-200' 
                        : isPaid 
                          ? 'bg-emerald-50/70 border-emerald-200' 
                          : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* UTR and Proofs */}
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Bank Transaction / UTR:
                            </span>
                            {inv.paymentUtr ? (
                              <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 font-mono text-sm font-black text-slate-900 shadow-2xs">
                                <span>{inv.paymentUtr}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUtr(inv.paymentUtr)}
                                  className="text-slate-400 hover:text-slate-700 transition"
                                  title="Copy UTR"
                                >
                                  {copiedUtr === inv.paymentUtr ? (
                                    <Check size={14} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 italic">No UTR submitted yet</span>
                            )}

                            {inv.paymentSubmittedAt && (
                              <span className="text-[11px] font-semibold text-slate-500">
                                Submitted {formatDateTime(inv.paymentSubmittedAt)}
                              </span>
                            )}
                          </div>

                          {/* Screenshot Thumbnails */}
                          {inv.paymentScreenshots && inv.paymentScreenshots.length > 0 && (
                            <div className="pt-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                Submitted Payment Proofs ({inv.paymentScreenshots.length}) — Click to view:
                              </p>
                              <div className="flex flex-wrap gap-2.5">
                                {inv.paymentScreenshots.map((url: string, imgIdx: number) => (
                                  <button
                                    key={imgIdx}
                                    type="button"
                                    onClick={() => setPreviewImage(url)}
                                    className="group relative h-16 w-16 overflow-hidden rounded-xl border border-slate-300 bg-white hover:ring-2 hover:ring-primary-500 transition shadow-sm"
                                  >
                                    <img src={url} alt={`Proof ${imgIdx + 1}`} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                      <Eye size={16} className="text-white" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 bg-black/70 px-1 py-0.2 text-[8px] font-bold text-white rounded-tl">
                                      #{imgIdx + 1}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => verifyB2BPaymentMutation.mutate({ id: inv._id, paymentStatus: 'paid' })}
                                disabled={verifyB2BPaymentMutation.isPending}
                                className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 active:scale-95 transition disabled:opacity-50"
                              >
                                <CheckCircle2 size={16} />
                                <span>{verifyB2BPaymentMutation.isPending ? 'Verifying...' : '✓ Mark Paid / Verify'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Are you sure you want to reject this payment proof? Dealer will need to re-upload.')) {
                                    verifyB2BPaymentMutation.mutate({ id: inv._id, paymentStatus: 'unpaid' });
                                  }
                                }}
                                disabled={verifyB2BPaymentMutation.isPending}
                                className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100 active:scale-95 transition disabled:opacity-50"
                              >
                                <XCircle size={16} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {isPaid && (
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white px-3 py-2 rounded-xl border border-emerald-200">
                                <CheckCircle2 size={15} className="text-emerald-600" />
                                Payment Verified
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Revert payment status back to Unpaid?')) {
                                    verifyB2BPaymentMutation.mutate({ id: inv._id, paymentStatus: 'unpaid' });
                                  }
                                }}
                                disabled={verifyB2BPaymentMutation.isPending}
                                className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition underline"
                              >
                                Revert to Unpaid
                              </button>
                            </div>
                          )}

                          {isUnpaid && (
                            <button
                              type="button"
                              onClick={() => verifyB2BPaymentMutation.mutate({ id: inv._id, paymentStatus: 'paid' })}
                              disabled={verifyB2BPaymentMutation.isPending}
                              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B2B Invoices Pagination */}
          {b2bTotalPages > 1 && (
            <div className="flex items-center justify-between rounded-[1.8rem] border border-primary-100 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setB2bPage((p) => Math.max(p - 1, 1))}
                disabled={b2bPage === 1}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-primary-50 transition disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span className="text-xs font-bold text-slate-500">
                Page {b2bPage} of {b2bTotalPages}
              </span>

              <button
                type="button"
                onClick={() => setB2bPage((p) => Math.min(p + 1, b2bTotalPages))}
                disabled={b2bPage === b2bTotalPages}
                className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-primary-50 transition disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: COMMISSION SETTLEMENTS VIEW (Original Request Payouts)       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'commission_settlements' && (
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm">
            <select
              value={commStatus}
              onChange={(event) => setCommStatus(event.target.value)}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:w-[320px] outline-none focus:ring-2 focus:ring-primary-500 transition font-bold text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="fulfilled">Fulfilled</option>
            </select>
          </div>

          {commRequestQuery.isLoading ? (
            <LoadingBlock label="Loading commission settlements..." />
          ) : (
            <div className="grid gap-4">
              {commRequestQuery.data?.data.map((request) => {
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
                          <span className="flex items-center gap-1.5"><Banknote size={14} className="text-primary-500" /> {request.requestedQuantity} Orders</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {request.dealerPrice && (
                            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 border border-amber-100">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Total Settlement:</span>
                              <span className="text-sm font-black text-amber-900">₹{request.dealerPrice.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-400 font-medium tracking-wide uppercase">
                          Requested {formatDateTime(request.createdAt)}
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
                        placeholder="Settlement Process Note (Optional)"
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

              {commRequestQuery.data?.data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-primary-50 border-dashed">
                  <Banknote size={48} className="text-slate-200 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No settlement requests found</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* FULL-SIZE SCREENSHOT PREVIEW MODAL                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl rounded-3xl bg-white p-3 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Payment Proof Screenshot
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition"
                  title="Open in new tab"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh]">
              <img
                src={previewImage}
                alt="Payment Proof Full"
                className="w-full h-auto rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Commission Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2.5rem] border border-primary-100 bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-500 p-2.5 text-white shadow-lg">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Details</p>
                  <h2 className="text-xl font-black text-slate-900 leading-none mt-1">Settlement Request</h2>
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
              <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Total Amount</p>
                    <p className="text-3xl font-black text-primary-400">₹{selectedRequest.dealerPrice?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Total Orders</p>
                    <p className="text-3xl font-black">{selectedRequest.requestedQuantity}</p>
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
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Order Details</p>
                <div className="rounded-2xl bg-primary-50/30 p-4 border border-primary-50 text-sm text-slate-600 max-h-[150px] overflow-y-auto">
                  {selectedRequest.notes}
                </div>
              </div>

              {selectedRequest.superAdminNote && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-2 ml-1">Admin Response</p>
                  <div className="rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100 text-sm text-emerald-900 font-semibold">
                    {selectedRequest.superAdminNote}
                  </div>
                </div>
              )}
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
