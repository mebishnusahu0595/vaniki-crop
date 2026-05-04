import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle2, Circle, Loader2, IndianRupee, Clock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { formatDateTime, currencyFormatter } from '../utils/format';

export default function SettlementPage() {
  const queryClient = useQueryClient();
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const eligibleOrdersQuery = useQuery({
    queryKey: ['admin-settlement-eligible'],
    queryFn: adminApi.getSettlementEligibleOrders,
  });

  const createSettlementMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.createSettlementRequest(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-eligible'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setSelectedOrderIds(new Set());
      alert('Settlement request sent to Super Admin successfully!');
    },
  });

  const toggleOrder = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const selectAll = () => {
    if (selectedOrderIds.size === eligibleOrdersQuery.data?.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(eligibleOrdersQuery.data?.map(o => o._id)));
    }
  };

  const totalAmount = Array.from(selectedOrderIds).reduce((sum, id) => {
    const order = eligibleOrdersQuery.data?.find(o => o._id === id);
    return sum + (order?.totalAmount || 0);
  }, 0);

  if (eligibleOrdersQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Payment Settlement"
        subtitle="Select delivered orders to request payment settlement from the Super Admin."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
             <button 
               onClick={selectAll}
               className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700"
             >
               {selectedOrderIds.size === eligibleOrdersQuery.data?.length ? 'Deselect All' : 'Select All Eligible'}
             </button>
             <p className="text-xs font-bold text-slate-400">
               {eligibleOrdersQuery.data?.length || 0} Orders Eligible
             </p>
          </div>

          <div className="grid gap-3">
            {eligibleOrdersQuery.data?.map((order) => (
              <button
                key={order._id}
                onClick={() => toggleOrder(order._id)}
                className={`flex items-center gap-4 rounded-[2rem] border p-5 text-left transition-all ${
                  selectedOrderIds.has(order._id) 
                    ? 'border-primary-500 bg-primary-50/50 shadow-md' 
                    : 'border-slate-100 bg-white hover:border-primary-200'
                }`}
              >
                <div className={`rounded-full p-1 ${selectedOrderIds.has(order._id) ? 'text-primary-600' : 'text-slate-300'}`}>
                  {selectedOrderIds.has(order._id) ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900">{order.orderNumber}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">Delivered</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {formatDateTime(order.createdAt)} · {order.items?.length || 0} Items
                  </p>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black text-slate-900">{currencyFormatter.format(order.totalAmount)}</p>
                </div>
              </button>
            ))}

            {eligibleOrdersQuery.data?.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                <Clock size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No pending settlements</h3>
                <p className="mt-2 text-slate-500">All delivered orders have been requested or processed.</p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky top-6 h-fit space-y-6">
          <div className="rounded-[2.5rem] border border-primary-100 bg-slate-900 p-8 text-white shadow-2xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-primary-500 p-2.5 text-white shadow-lg shadow-primary-500/30">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Settlement</p>
                <h3 className="text-xl font-black">Summary</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/10 pb-4">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Selected Orders</span>
                <span className="text-xl font-black">{selectedOrderIds.size}</span>
              </div>
              <div className="pt-2">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Claim Amount</p>
                <div className="flex items-center gap-2 text-3xl font-black text-primary-400">
                  <IndianRupee size={24} />
                  {totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <button
              onClick={() => createSettlementMutation.mutate(Array.from(selectedOrderIds))}
              disabled={selectedOrderIds.size === 0 || createSettlementMutation.isPending}
              className="mt-8 w-full rounded-2xl bg-primary-500 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 transition active:scale-95"
            >
              {createSettlementMutation.isPending ? 'Processing...' : 'Request Settlement'}
            </button>
          </div>

          <div className="rounded-[2rem] border border-primary-100 bg-white p-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">How it works</h4>
            <ul className="space-y-3">
              <li className="flex gap-3 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-black text-primary-600">1</span>
                Select delivered orders you want to settle.
              </li>
              <li className="flex gap-3 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-black text-primary-600">2</span>
                Submit the request to the Super Admin.
              </li>
              <li className="flex gap-3 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-black text-primary-600">3</span>
                Super Admin will verify and process the payment physically.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
