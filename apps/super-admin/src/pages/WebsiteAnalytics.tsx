import { useMemo } from 'react';
import { Eye, Users, Box, TrendingUp, Globe, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
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

export default function WebsiteAnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ['super-admin-website-reporting'],
    queryFn: () => adminApi.websiteReporting(),
    staleTime: 30_000,
    refetchInterval: 60_000, // Refresh automatically every 60s
  });

  const chartData = useMemo(() => {
    if (!analyticsQuery.data?.timeline) return [];
    return analyticsQuery.data.timeline.map((point) => ({
      ...point,
      label: point.date.slice(5), // Format YYYY-MM-DD to MM-DD for cleaner chart ticks
    }));
  }, [analyticsQuery.data]);

  if (analyticsQuery.isLoading) {
    return <LoadingBlock label="Loading website traffic analytics..." />;
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-600">
          Failed to load website analytics. Please check backend connection and retry.
        </p>
      </div>
    );
  }

  const { stats, topPages, topViewedProducts } = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Traffic"
        subtitle="Monitor live visitors, customer navigation patterns, and popular product views on the consumer storefront."
        action={
          <div className="flex items-center gap-2 rounded-2xl border border-primary-100 bg-white px-4 py-2 shadow-sm text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live tracking active
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Page Views"
          value={stats.totalViews.toLocaleString()}
          icon={<Eye size={20} />}
        />
        <StatCard
          label="Unique Visitors"
          value={stats.uniqueVisitors.toLocaleString()}
          icon={<Users size={20} />}
        />
        <StatCard
          label="Product Detail Hits"
          value={stats.totalProductViews.toLocaleString()}
          icon={<Box size={20} />}
        />
        <StatCard
          label="Views Today"
          value={stats.viewsToday.toLocaleString()}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Timeline Chart */}
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Storefront Traffic</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">Traffic Trend (Last 30 Days)</h2>
          <p className="text-xs text-slate-400 mt-1">Timeline of daily page views vs. unique visitors</p>
        </div>
        <div className="mt-6 h-[340px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#6b7280" fontSize={11} fontWeight={600} />
                <YAxis stroke="#6b7280" fontSize={11} fontWeight={600} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #d8f3dc',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Page Views"
                  stroke="#2D6A4F"
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  name="Unique Visitors"
                  stroke="#52B788"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-between text-slate-400 text-sm font-semibold">
              No traffic logs captured in the last 30 days yet.
            </div>
          )}
        </div>
      </div>

      {/* Grid for top pages and top products */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Left Side: Top Pages */}
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 border-b border-primary-50 pb-4 mb-4">
            <div className="rounded-2xl bg-primary-50 p-2.5 text-primary-600">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Top Visited Pathways</h3>
              <p className="text-xs text-slate-400">Store pages customers visit most frequently</p>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {topPages.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      URL Path
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Views
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Unique Visitors
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topPages.map((page, index) => (
                    <tr key={page.url} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="px-3 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-300 w-5">#{index + 1}</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[240px] bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-mono">
                            {page.url}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-black text-slate-900">
                        {page.views.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-slate-500">
                        {page.visitors.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex h-48 items-center justify-center text-slate-400 text-sm font-semibold">
                No active traffic paths recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Top Products */}
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 border-b border-primary-50 pb-4 mb-4">
            <div className="rounded-2xl bg-primary-50 p-2.5 text-primary-600">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Popular Product Detail Views</h3>
              <p className="text-xs text-slate-400">Catalog items capturing customer attention</p>
            </div>
          </div>

          <div className="flex-1 space-y-3.5">
            {topViewedProducts.length > 0 ? (
              topViewedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-slate-50 bg-white p-3 hover:border-primary-100 hover:shadow-[0_8px_24px_rgba(45,106,79,0.04)] transition duration-150"
                >
                  <div className="text-xs font-black text-slate-300 w-4 text-center">
                    #{index + 1}
                  </div>
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <ShoppingBag size={18} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate text-sm font-black text-slate-950">{product.name}</h4>
                    <p className="truncate text-xs text-slate-400 mt-0.5">{product.shortDescription || 'No description'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-black text-primary-700">
                      <Eye size={10} />
                      {product.views} views
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {product.visitors} visitors
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-48 items-center justify-center text-slate-400 text-sm font-semibold">
                No product detail page views recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
