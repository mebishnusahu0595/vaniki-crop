import { useState } from 'react';
import { BarChart3, Boxes, IndianRupee, PackageCheck, Download, TrendingUp, Wallet2, UserPlus, ArrowUpRight, Percent } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { currencyFormatter, formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  // Core Analytics Query
  const analyticsQuery = useQuery({
    queryKey: ['admin-dashboard', range],
    queryFn: () => adminApi.analytics(range),
  });

  // Eligible Settlements Query
  const eligibleOrdersQuery = useQuery({
    queryKey: ['admin-settlement-eligible'],
    queryFn: adminApi.getSettlementEligibleOrders,
  });

  // Referrals Query
  const referralsQuery = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => adminApi.referrals(),
  });

  if (analyticsQuery.isLoading || !analyticsQuery.data) {
    return <LoadingBlock label="Loading dashboard analytics..." />;
  }

  const { stats, revenueSeries, recentOrders, topProducts } = analyticsQuery.data;

  // Calculate dynamic stats for the selected period
  const totalPeriodSales = revenueSeries.reduce((sum, p) => sum + p.amount, 0);
  const totalPeriodOrders = revenueSeries.reduce((sum, p) => sum + p.orders, 0);
  const averageOrderValue = totalPeriodOrders > 0 ? totalPeriodSales / totalPeriodOrders : 0;

  // Calculate pending settlements total
  const pendingSettlementBalance = eligibleOrdersQuery.data?.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0) ?? 0;
  const eligibleOrdersCount = eligibleOrdersQuery.data?.length ?? 0;

  // Referral count
  const referralCount = referralsQuery.data?.data?.length ?? 0;

  // CSV Report Generator
  const handleDownloadReport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Title
    csvContent += `"VANIKI CROP - STORE PERFORMANCE REPORT (${range.toUpperCase()})"\n`;
    csvContent += `"Generated On:","${new Date().toLocaleString()}"\n\n`;

    // Overall KPI Header
    csvContent += `"KEY PERFORMANCE INDICATORS"\n`;
    csvContent += `"Metric","Value"\n`;
    csvContent += `"Today's Revenue","${stats.todayRevenue}"\n`;
    csvContent += `"Today's Orders","${stats.todayOrders}"\n`;
    csvContent += `"Pending Orders","${stats.pendingOrders}"\n`;
    csvContent += `"Total Products Catalog","${stats.totalProducts}"\n`;
    csvContent += `"Period Total Sales","${totalPeriodSales}"\n`;
    csvContent += `"Period Total Orders","${totalPeriodOrders}"\n`;
    csvContent += `"Average Order Value (AOV)","${averageOrderValue.toFixed(2)}"\n`;
    csvContent += `"Unclaimed Settlement Balance","${pendingSettlementBalance}"\n`;
    csvContent += `"Total Referred Customers","${referralCount}"\n\n`;

    // Trend Header
    csvContent += `"DAILY REVENUE & ORDERS TREND"\n`;
    csvContent += `"Date","Revenue (INR)","Orders Count"\n`;
    revenueSeries.forEach((pt) => {
      csvContent += `"${pt.date}","${pt.amount}","${pt.orders}"\n`;
    });
    csvContent += '\n';

    // Best Sellers Header
    csvContent += `"BEST-SELLING PRODUCTS (TOP BY REVENUE)"\n`;
    csvContent += `"Product Name","Units Sold","Revenue Generated (INR)"\n`;
    topProducts.forEach((prod) => {
      csvContent += `"${prod.name.replace(/"/g, '""')}","${prod.sold}","${prod.revenue}"\n`;
    });
    csvContent += '\n';

    // Recent Orders Header
    csvContent += `"RECENT ORDERS AUDIT LOG (LAST 10)"\n`;
    csvContent += `"Order Number","Customer Name","Date & Time","Total Amount (INR)","Order Status","Payment Status","Method"\n`;
    recentOrders.forEach((order) => {
      csvContent += `"${order.orderNumber}","${(order.userId?.name || 'Customer').replace(/"/g, '""')}","${order.createdAt}","${order.totalAmount}","${order.status}","${order.paymentStatus}","${order.paymentMethod}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vaniki_store_performance_${range}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Premium Page Header */}
      <PageHeader
        title="Dashboard Overview"
        subtitle="Track financial metrics, order streams, customer referrals, and pending settlements."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Download Report Button */}
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition active:scale-95"
            >
              <Download size={14} />
              Export Report
            </button>

            {/* Range Toggle Switcher */}
            <div className="inline-flex rounded-2xl border border-primary-100 bg-white p-1 shadow-sm">
              {(['7d', '30d'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${
                    range === option ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Grid of Core KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today’s Revenue" value={currencyFormatter.format(stats.todayRevenue)} icon={<IndianRupee size={20} />} />
        <StatCard label="Today’s Orders" value={String(stats.todayOrders)} icon={<PackageCheck size={20} />} />
        <StatCard label="Pending Orders" value={String(stats.pendingOrders)} icon={<BarChart3 size={20} />} />
        <StatCard label="Total Products" value={String(stats.totalProducts)} icon={<Boxes size={20} />} />
      </div>

      {/* Grid of Business Analytics & Dynamic Calculations */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Dynamic Period Revenue */}
        <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-900 to-primary-950 p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Period Gross Revenue</span>
            <div className="rounded-xl bg-primary-800/40 p-2 text-primary-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <h3 className="mt-4 text-3xl font-black">{currencyFormatter.format(totalPeriodSales)}</h3>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Accumulated sales over last {range === '7d' ? '7 days' : '30 days'}
          </p>
        </div>

        {/* Dynamic Average Order Value (AOV) */}
        <div className="rounded-3xl border border-primary-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Average Order Value (AOV)</span>
            <div className="rounded-xl bg-primary-50 p-2 text-primary-600">
              <Percent size={16} />
            </div>
          </div>
          <h3 className="mt-4 text-3xl font-black text-slate-900">{currencyFormatter.format(averageOrderValue)}</h3>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            AOV across {totalPeriodOrders} successfully placed orders
          </p>
        </div>

        {/* Settlement Wallet Status */}
        <Link 
          to="/settlements"
          className="group block rounded-3xl border border-primary-100 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-6 hover:border-amber-400 hover:shadow-md transition active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Settlements Eligible</span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700 group-hover:bg-amber-200 transition">
              <Wallet2 size={16} />
            </div>
          </div>
          <h3 className="mt-4 text-3xl font-black text-slate-900 flex items-baseline gap-2">
            {currencyFormatter.format(pendingSettlementBalance)}
            <span className="text-xs font-bold text-amber-700">({eligibleOrdersCount} orders)</span>
          </h3>
          <p className="mt-2 text-xs font-semibold text-amber-800 flex items-center gap-1 group-hover:text-amber-900">
            Tap to claim settlements <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </p>
        </Link>
      </div>

      {/* Grid of Trends and Diagrams */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Daily Revenue Trend */}
        <div className="min-w-0 rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Revenue Stream</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Daily Sales Progression</h2>
          </div>
          <div className="mt-6 h-[320px] min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#94a3b8" fontSize={11} fontWeight={600} />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `₹${val}`} fontSize={11} fontWeight={600} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #eef4f0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }} 
                  labelStyle={{ fontWeight: 900, color: '#1e293b' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#2D6A4F" strokeWidth={3} dot={{ fill: '#2D6A4F', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Mix Bar */}
        <div className="min-w-0 rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Orders Mix</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Volume By Day</h2>
          </div>
          <div className="mt-6 h-[320px] min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#94a3b8" fontSize={11} fontWeight={600} />
                <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #eef4f0' }}
                  labelStyle={{ fontWeight: 900, color: '#1e293b' }}
                />
                <Bar dataKey="orders" fill="#52B788" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower Section: Recent Orders, Best Sellers, and Referrals Widget */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Card: Recent Orders */}
        <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Recent Customer Bookings</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Recent 10 Orders</h2>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-primary-100/60 bg-primary-50/20 px-4 py-3 hover:bg-primary-50/40 transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {order.userId?.name || 'Customer'} · {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-black text-primary-700">{currencyFormatter.format(order.totalAmount)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{order.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                        order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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

        {/* Right Side: Product Best Sellers and Referrals Program */}
        <div className="space-y-6">
          {/* Best Sellers */}
          <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Inventory Performers</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Best Sellers By Revenue</h2>
            </div>
            <div className="space-y-3">
              {topProducts.map((product) => (
                <div key={product.productId} className="rounded-2xl border border-primary-100/60 bg-primary-50/20 px-4 py-3 hover:bg-primary-50/40 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{product.sold} units sold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary-700">{currencyFormatter.format(product.revenue)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">Sales Leader</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Referrals Program Highlight */}
          <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Customer Outreach</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Referrals Network</h2>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
                <UserPlus size={20} />
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-emerald-50/30 border border-emerald-100/60 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Referred Users</p>
                <h4 className="mt-1 text-2xl font-black text-emerald-800">{referralCount} Customers</h4>
              </div>
              <Link 
                to="/referrals"
                className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800"
              >
                View Network
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
