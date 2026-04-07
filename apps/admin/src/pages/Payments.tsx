import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDateTime } from '../utils/format';

export default function PaymentsPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const paymentsQuery = useQuery({
    queryKey: ['admin-payments', status, method, startDate, endDate],
    queryFn: () => adminApi.payments({ status, method, startDate, endDate, limit: 100 }),
  });

  if (paymentsQuery.isLoading) return <LoadingBlock label="Loading payments..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Store-specific Razorpay payment records and statuses." />
      <div className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-white p-4 lg:grid-cols-4">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
          <option value="">All statuses</option>
          {['pending', 'captured', 'failed', 'refunded'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={method} onChange={(event) => setMethod(event.target.value)} placeholder="Method" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
      </div>
      <div className="grid gap-4">
        {paymentsQuery.data?.data.map((payment) => (
          <div key={payment.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black text-slate-900">{payment.razorpayPaymentId || payment.razorpayOrderId || payment.id}</p>
                <p className="mt-1 text-sm text-slate-500">{payment.method || 'Unknown method'} · {formatDateTime(payment.createdAt)}</p>
              </div>
              <div className="grid gap-1 text-left md:text-right">
                <span className="text-lg font-black text-primary-700">{currencyFormatter.format(payment.amount)}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{payment.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
