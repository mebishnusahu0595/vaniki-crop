import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDate } from '../utils/format';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { Copy, Gift, Users } from 'lucide-react';

export default function ReferralsPage() {
  const user = useAdminAuthStore((state) => state.user);
  const referralsQuery = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => adminApi.referrals({ limit: 100 }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Referral code copied to clipboard!');
  };

  if (referralsQuery.isLoading) return <LoadingBlock label="Loading referrals..." />;

  const referrals = referralsQuery.data?.data || [];

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Referrals & Loyalty"
        subtitle="Refer new users to Vaniki Crop and earn loyalty points for every successful sign-up."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Referral Card */}
        <div className="overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white shadow-sm">
          <div className="bg-slate-900 p-6 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-2xl bg-primary-500 p-2.5 text-white shadow-lg shadow-primary-500/30">
                <Gift size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Share & Earn</p>
                <h3 className="text-xl font-black">Your Referral Code</h3>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-white/10 p-4 border border-white/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Unique Code</p>
                <p className="text-3xl font-black tracking-widest text-primary-400">{user?.referralCode || '...'}</p>
              </div>
              <button
                onClick={() => copyToClipboard(user?.referralCode || '')}
                className="rounded-xl bg-primary-500 p-3 text-white transition hover:bg-primary-600 active:scale-95"
              >
                <Copy size={20} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm leading-relaxed text-slate-500">
              Give this code to new users. When they sign up using your code, you will earn <span className="font-bold text-primary-600">1 Loyalty Point</span>.
            </p>
          </div>
        </div>

        {/* Loyalty Points Card */}
        <div className="overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white shadow-sm">
          <div className="bg-amber-50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-2xl bg-amber-500 p-2.5 text-white shadow-lg shadow-amber-500/30">
                <img src="/coin.png" alt="Coins" className="h-5 w-5 object-contain brightness-0 invert" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Loyalty Balance</p>
                <h3 className="text-xl font-black text-amber-900">Total Points Earned</h3>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-amber-600">{user?.loyaltyPoints || 0}</span>
              <span className="text-lg font-bold text-amber-400 uppercase tracking-widest">Points</span>
            </div>
          </div>
          <div className="p-6 border-t border-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">Total Referrals</p>
                <p className="text-xl font-black text-slate-900">{referrals.length}</p>
              </div>
              <div className="h-10 w-px bg-slate-100" />
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500">Conversion Rate</p>
                <p className="text-xl font-black text-primary-600">100%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <Users size={18} className="text-primary-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Referred Users List</h3>
        </div>

        <div className="grid gap-4">
          {referrals.map((record: any) => (
            <div
              key={record.id}
              className="group rounded-[2rem] border border-primary-100 bg-white p-5 transition hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-xl font-black text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                      {record.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">{record.name}</h4>
                      <p className="text-xs font-bold text-slate-400">Joined {formatDate(record.joinedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:flex md:items-center md:gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Purchases</p>
                    <p className="text-sm font-black text-slate-900">{record.orderCount} Orders</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Buy</p>
                    <p className="text-sm font-black text-primary-600">{currencyFormatter.format(record.totalSpend)}</p>
                  </div>
                  <div className="col-span-2 space-y-1 md:col-auto md:min-w-[180px]">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">What they buy</p>
                    <div className="rounded-xl bg-primary-50 px-3 py-1.5 border border-primary-100">
                      <p className="truncate text-xs font-black text-primary-700">{record.mostBoughtProduct}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {referrals.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-primary-100 py-20 text-slate-400">
              <Users size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-[0.2em]">No referrals yet</p>
              <p className="mt-2 text-xs">Share your code to start growing your network!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
