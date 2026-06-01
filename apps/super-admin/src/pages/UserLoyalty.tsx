import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Customer } from '../types/admin';
import { formatDate } from '../utils/format';
import { Search, Award, Edit2, X, Plus, Minus, Check } from 'lucide-react';

export default function UserLoyaltyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Customer | null>(null);
  const [pointsInput, setPointsInput] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sortByPoints, setSortByPoints] = useState<'default' | 'asc' | 'desc'>('default');

  const customersQuery = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => adminApi.customers({ search, limit: 100 }),
  });

  const adjustPointsMutation = useMutation({
    mutationFn: ({ id, points }: { id: string; points: number }) =>
      adminApi.adjustCustomerLoyalty(id, points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setSuccessMsg('Loyalty points adjusted successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setSelectedUser(null);
      }, 1500);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to adjust points');
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  const openAdjustModal = (user: Customer) => {
    setSelectedUser(user);
    setPointsInput(String(user.loyaltyPoints ?? 0));
  };

  const handleQuickAdjust = (amount: number) => {
    const current = parseInt(pointsInput) || 0;
    setPointsInput(String(Math.max(0, current + amount)));
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const points = parseInt(pointsInput);
    if (isNaN(points) || points < 0) {
      setErrorMsg('Please enter a valid positive integer.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    adjustPointsMutation.mutate({ id: selectedUser.id, points });
  };

  if (customersQuery.isLoading) return <LoadingBlock label="Loading user loyalty list..." />;

  const rawCustomers = customersQuery.data?.data || [];
  const customers = [...rawCustomers].sort((a, b) => {
    const pointsA = a.loyaltyPoints ?? 0;
    const pointsB = b.loyaltyPoints ?? 0;
    if (sortByPoints === 'asc') return pointsA - pointsB;
    if (sortByPoints === 'desc') return pointsB - pointsA;
    return 0;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Loyalty Management"
        subtitle="View and manually adjust loyalty points, streaks, and check-in history for all users."
      />

      {/* Search & Sort Header */}
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or mobile number..."
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 pl-11 pr-4 py-3 font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">Sort By Points:</span>
          <select
            value={sortByPoints}
            onChange={(e) => setSortByPoints(e.target.value as 'default' | 'asc' | 'desc')}
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="default">Default</option>
            <option value="asc">Low to High</option>
            <option value="desc">High to Low</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => {
          const checkInCount = customer.checkInHistory?.length || 0;
          return (
            <div
              key={customer.id}
              className="relative overflow-hidden rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              {/* Coin background decoration */}
              <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                <Award size={100} className="text-amber-500" />
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{customer.name}</h3>
                  <p className="text-xs font-semibold text-slate-400">{customer.mobile}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-amber-50 border border-amber-100 px-3.5 py-2">
                  <img src="/coin.png" alt="coin" className="h-5 w-5 object-contain" />
                  <span className="text-sm font-black text-amber-700">{customer.loyaltyPoints ?? 0}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3.5">
                <div className="flex items-center justify-between text-xs border-b border-primary-50/50 pb-2">
                  <span className="font-bold text-slate-400">Total Spend</span>
                  <span className="font-extrabold text-slate-800">
                    ₹{customer.totalSpend?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-primary-50/50 pb-2">
                  <span className="font-bold text-slate-400">Total Check-Ins</span>
                  <span className="font-extrabold text-slate-800">{checkInCount} days</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="font-bold text-slate-400">Last Check-In</span>
                  <span className="font-extrabold text-slate-800">
                    {customer.lastCheckIn ? formatDate(customer.lastCheckIn) : 'Never'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openAdjustModal(customer)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3 text-xs font-black uppercase tracking-[0.15em] text-white hover:bg-primary-600 transition shadow-sm"
              >
                <Edit2 size={14} />
                Adjust Points
              </button>
            </div>
          );
        })}

        {customers.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <Award className="mx-auto text-slate-300 mb-3" size={48} />
            <p className="text-sm font-bold text-slate-400">No customers found.</p>
          </div>
        )}
      </div>

      {/* Adjust Points Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-50 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-6">
              <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100">
                <img src="/coin.png" alt="coin" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Points Adjustment</p>
                <h3 className="text-xl font-black text-slate-900">{selectedUser.name}</h3>
              </div>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-6">
              <div className="rounded-3xl bg-primary-50/50 p-5 text-center border border-primary-50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Balance</p>
                <p className="text-4xl font-black text-slate-900 mt-1 flex items-center justify-center gap-2">
                  <img src="/coin.png" alt="coin" className="h-8 w-8 object-contain" />
                  {selectedUser.loyaltyPoints ?? 0}
                </p>
              </div>

              {/* Direct Input */}
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  New Point Value
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-black text-slate-800 text-lg focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* Quick Adjustments */}
              <div>
                <p className="mb-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Quick Adjustments
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(10)}
                    className="flex items-center justify-center gap-0.5 rounded-xl border border-primary-100 bg-slate-50 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                  >
                    <Plus size={10} />10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(50)}
                    className="flex items-center justify-center gap-0.5 rounded-xl border border-primary-100 bg-slate-50 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                  >
                    <Plus size={10} />50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(-10)}
                    className="flex items-center justify-center gap-0.5 rounded-xl border border-primary-100 bg-slate-50 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                  >
                    <Minus size={10} />10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjust(-50)}
                    className="flex items-center justify-center gap-0.5 rounded-xl border border-primary-100 bg-slate-50 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                  >
                    <Minus size={10} />50
                  </button>
                </div>
              </div>

              {/* Success/Error States */}
              {successMsg && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 animate-in slide-in-from-top-2 duration-300">
                  <Check size={16} />
                  {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 animate-in slide-in-from-top-2 duration-300">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="w-1/3 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustPointsMutation.isPending}
                  className="flex-1 rounded-2xl bg-primary-500 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-600 shadow-md shadow-primary-500/10 disabled:opacity-60 transition"
                >
                  {adjustPointsMutation.isPending ? 'Saving...' : 'Save Adjustments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
