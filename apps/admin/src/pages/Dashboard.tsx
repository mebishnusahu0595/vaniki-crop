import { useState } from 'react';
import { BarChart3, Boxes, IndianRupee, PackageCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { StatCard } from '../components/StatCard';
import { adminApi } from '../utils/api';
import { currencyFormatter, formatDate, formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const analyticsQuery = useQuery({
    queryKey: ['admin-dashboard', range],
    queryFn: () => adminApi.analytics(range),
  });

  if (analyticsQuery.isLoading || !analyticsQuery.data) {
    return <LoadingBlock label="Loading dashboard..." />;
  }

  const { stats, revenueSeries, recentOrders, topProducts } = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of today’s store performance, recent orders, and best-selling products."
        action={
          <div className="inline-flex rounded-2xl border border-primary-100 bg-white p-1">
            {(['7d', '30d'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setRange(option)}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                  range === option ? 'bg-primary-500 text-white' : 'text-slate-500'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today’s Revenue" value={currencyFormatter.format(stats.todayRevenue)} icon={<IndianRupee size={20} />} />
        <StatCard label="Today’s Orders" value={String(stats.todayOrders)} icon={<PackageCheck size={20} />} />
        <StatCard label="Pending Orders" value={String(stats.pendingOrders)} icon={<BarChart3 size={20} />} />
        <StatCard label="Total Products" value={String(stats.totalProducts)} icon={<Boxes size={20} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="min-w-0 rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Revenue Trend</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Daily revenue and order pattern</h2>
            </div>
          </div>
          <div className="mt-6 h-[320px] min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#2D6A4F" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Orders Mix</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">Order count by day</h2>
          <div className="mt-6 h-[320px] min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="orders" fill="#52B788" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Recent Orders</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Last 10 orders</h2>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-primary-100 bg-primary-50/50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.userId?.name || 'Customer'} · {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-black text-primary-700">{currencyFormatter.format(order.totalAmount)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{order.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                        order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{order.paymentStatus}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                        order.paymentMethod === 'cod' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>{order.paymentMethod === 'cod' ? 'COD' : 'Razorpay'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Top Products</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Best sellers by revenue</h2>
          </div>
          <div className="space-y-3">
            {topProducts.map((product) => (
              <div key={product.productId} className="rounded-2xl border border-primary-100 bg-primary-50/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.sold} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-primary-700">{currencyFormatter.format(product.revenue)}</p>
                    <p className="mt-1 text-xs text-slate-500">Updated {formatDate(new Date().toISOString())}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
