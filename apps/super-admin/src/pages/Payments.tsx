import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDateTime } from '../utils/format';

function exportPaymentsCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;

  const headers = ['Order#', 'Store', 'Customer', 'Amount', 'Razorpay ID', 'Method', 'Status', 'Date'];

  const csvRows = rows.map((row) => [
    row.orderNumber,
    row.store,
    row.customer,
    row.amount,
    row.razorpayId,
    row.method,
    row.status,
    row.date,
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
  link.download = `super-admin-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const [storeId, setStoreId] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [storeId, status, method, startDate, endDate]);

  const storesQuery = useQuery({
    queryKey: ['super-admin-payment-stores'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const paymentsQuery = useQuery({
    queryKey: ['super-admin-payments', storeId, status, method, startDate, endDate, page],
    queryFn: () =>
      adminApi.payments({
        storeId,
        status,
        method,
        startDate,
        endDate,
        limit: 25,
        page,
      }),
  });

  if (paymentsQuery.isLoading) return <LoadingBlock label="Loading payments..." />;

  const payments = paymentsQuery.data?.data || [];
  const pagination = paymentsQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const exportRows =
    payments.map((payment) => ({
      orderNumber: payment.orderNumber,
      store: payment.store.name,
      customer: payment.customer.name,
      amount: payment.amount,
      razorpayId: payment.razorpayId,
      method: payment.method,
      status: payment.status,
      date: formatDateTime(payment.createdAt),
    })) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Payments"
        subtitle="Cross-store payment records with method and status filters."
        action={
          <button
            onClick={() => exportPaymentsCsv(exportRows)}
            className="rounded-2xl border border-primary-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-700"
          >
            Export CSV
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Total Captured</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{currencyFormatter.format(paymentsQuery.data?.summary.totalCaptured || 0)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Total Failed</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{currencyFormatter.format(paymentsQuery.data?.summary.totalFailed || 0)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Total Refunded</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{currencyFormatter.format(paymentsQuery.data?.summary.totalRefunded || 0)}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-5">
        <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All stores</option>
          {storesQuery.data?.data.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All statuses</option>
          {['pending', 'captured', 'failed', 'refunded'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All methods</option>
          {['razorpay', 'cod'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>

      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary-100 bg-white lg:block">
        <table className="min-w-full">
          <thead className="bg-primary-50/70 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-3">S.No.</th>
              <th className="px-4 py-3">Order#</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Razorpay ID</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr key={payment.id} className="border-t border-primary-100">
                <td className="px-4 py-3 text-sm font-black text-slate-500">{(page - 1) * 25 + index + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-900">{payment.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{payment.store.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{payment.customer.name}</td>
                <td className="px-4 py-3 text-sm font-black text-primary-700">{currencyFormatter.format(payment.amount)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{payment.razorpayId}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    payment.method === 'cod' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>{payment.method === 'cod' ? 'COD' : 'Razorpay'}</span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    payment.status === 'captured' ? 'bg-emerald-100 text-emerald-700' :
                    payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{payment.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(payment.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {payments.map((payment, index) => (
          <div key={payment.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                #{(page - 1) * 25 + index + 1}
              </span>
              <span className="text-lg font-black text-slate-900">{payment.orderNumber}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{payment.store.name} · {payment.customer.name}</p>
            <p className="mt-1 text-sm text-slate-500">{payment.razorpayId}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                payment.status === 'captured' ? 'bg-emerald-100 text-emerald-700' :
                payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>{payment.status}</span>
              <span className="text-sm font-black text-primary-700">{currencyFormatter.format(payment.amount)}</span>
            </div>
          </div>
        ))}
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
