import { useMemo, useState } from 'react';
import { Boxes, IndianRupee, ShoppingCart, Users, FileText, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { StatCard } from '../components/StatCard';
import { adminApi } from '../utils/api';
import { currencyFormatter } from '../utils/format';

export default function DashboardPage() {
  const [range, setRange] = useState<'30d' | '60d' | '90d'>('30d');
  const [compareByStore, setCompareByStore] = useState(false);

  const analyticsQuery = useQuery({
    queryKey: ['super-admin-dashboard', range],
    queryFn: () => adminApi.analytics(range),
  });

  const storesQuery = useQuery({
    queryKey: ['super-admin-dashboard-stores'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const timelineData = useMemo(() => {
    if (!analyticsQuery.data) return [];
    return analyticsQuery.data.revenueTimeline.points.map((point) => ({
      ...point,
      label: point.date.slice(5),
    }));
  }, [analyticsQuery.data]);

  if (analyticsQuery.isLoading || !analyticsQuery.data) {
    return <LoadingBlock label="Loading dashboard..." />;
  }

  const { stats, revenueByStore, revenueTimeline, orderStatusBreakdown, topProducts } = analyticsQuery.data;

  const pieColors = ['#2D6A4F', '#52B788', '#40916C', '#74C69D', '#95D5B2', '#1B4332'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Analytics"
        subtitle="Cross-store performance across revenue, orders, customers, payments, and products."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl border border-primary-100 bg-white p-1">
              {(['30d', '60d', '90d'] as const).map((option) => (
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
            <button
              onClick={() => setCompareByStore((current) => !current)}
              className={`rounded-2xl border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${
                compareByStore
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-primary-100 bg-white text-slate-600'
              }`}
            >
              {compareByStore ? 'Store Comparison On' : 'Store Comparison Off'}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={currencyFormatter.format(stats.totalRevenue)} icon={<IndianRupee size={20} />} />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} icon={<ShoppingCart size={20} />} />
        <StatCard label="Total Customers" value={String(stats.totalCustomers)} icon={<Users size={20} />} />
        <StatCard label="Active Products" value={String(stats.activeProducts)} icon={<Boxes size={20} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Revenue by Store</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Store contribution to total revenue</h2>
          </div>
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByStore}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" />
                <XAxis dataKey="storeName" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                  {revenueByStore.map((store) => (
                    <Cell key={store.storeId} fill={store.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Order Status Mix</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">Placed to delivered status distribution</h2>
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {orderStatusBreakdown.map((segment, index) => (
                    <Cell key={segment.status} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-primary-100 pb-4 mb-6">
          <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">B2B Invoice Creator</h2>
            <p className="text-sm text-slate-500">Generate manual GST tax invoices for Store Admins / Dealers.</p>
          </div>
        </div>

        <B2BInvoiceCreator stores={storesQuery.data?.data || []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Revenue Timeline</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Last {range} trend {compareByStore ? 'by store' : 'overall'}</h2>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid stroke="#eef4f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                {!compareByStore ? (
                  <Line type="monotone" dataKey="totalRevenue" stroke="#2D6A4F" strokeWidth={3} dot={false} />
                ) : (
                  revenueTimeline.stores.map((store) => (
                    <Line
                      key={store.storeId}
                      type="monotone"
                      dataKey={store.key}
                      stroke={store.color}
                      strokeWidth={2.2}
                      dot={false}
                      name={store.storeName}
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Top Products</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Best sellers across all stores</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-primary-100">
            <table className="min-w-full">
              <thead className="bg-primary-50/60 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={`${product.productName}-${product.storeName}-${index}`} className="border-t border-primary-100 bg-white">
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{product.productName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{product.storeName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{product.unitsSold}</td>
                    <td className="px-4 py-3 text-sm font-black text-primary-700">{currencyFormatter.format(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function B2BInvoiceCreator({ stores }: { stores: any[] }) {
  const [storeId, setStoreId] = useState('');
  const [items, setItems] = useState([{ productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }]);
  const [invoiceNumber, setInvoiceNumber] = useState(`B2B-${Date.now().toString().slice(-6)}`);
  const [isGenerating, setIsGenerating] = useState(false);

  const addItem = () => setItems([...items, { productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: any) => {
    const next = [...items];
    (next[index] as any)[field] = value;
    setItems(next);
  };

  const handleGenerate = async () => {
    if (!storeId) return alert('Please select a store');
    if (items.some(i => !i.productName || i.price <= 0)) return alert('Please fill item details correctly');

    setIsGenerating(true);
    setIsGenerating(true);
    try {
      const response = await adminApi.createB2BInvoice({ storeId, items, invoiceNumber });
      alert(`B2B Invoice ${response.invoiceNumber} has been generated and saved successfully. The dealer can now view it in their portal.`);
      // Optionally download as well
      const blob = await adminApi.downloadB2BInvoice(response.id || response._id);
      const url = window.URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      // Reset form
      setItems([{ productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }]);
      setInvoiceNumber(`B2B-${Date.now().toString().slice(-6)}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Select Recipient Store</label>
          <select 
            value={storeId} 
            onChange={e => setStoreId(e.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm"
          >
            <option value="">Select a store</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Invoice Number</label>
          <input 
            value={invoiceNumber} 
            onChange={e => setInvoiceNumber(e.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Invoice Items</p>
          <button onClick={addItem} className="flex items-center gap-1 text-xs font-black uppercase text-primary-600 hover:text-primary-700">
            <Plus size={14} /> Add Item
          </button>
        </div>

        {items.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-primary-50 bg-primary-50/30 p-4 md:grid-cols-[2fr_1fr_0.8fr_1fr_0.8fr_auto]">
            <input 
              placeholder="Product Name"
              value={item.productName}
              onChange={e => updateItem(index, 'productName', e.target.value)}
              className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
            />
            <input 
              placeholder="HSN"
              value={item.hsnCode}
              onChange={e => updateItem(index, 'hsnCode', e.target.value)}
              className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
            />
            <input 
              type="number"
              placeholder="Qty"
              value={item.qty}
              onChange={e => updateItem(index, 'qty', Number(e.target.value))}
              className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
            />
            <input 
              type="number"
              placeholder="Price"
              value={item.price}
              onChange={e => updateItem(index, 'price', Number(e.target.value))}
              className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
            />
            <select
              value={item.taxRate}
              onChange={e => updateItem(index, 'taxRate', Number(e.target.value))}
              className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
            >
              {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
            <button onClick={() => removeItem(index)} className="text-rose-400 hover:text-rose-600">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white hover:bg-primary-700 disabled:opacity-50"
      >
        <FileText size={18} />
        {isGenerating ? 'Saving & Generating...' : 'Save & Generate B2B Invoice'}
      </button>
    </div>
  );
}
