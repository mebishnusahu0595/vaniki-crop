import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Calendar, Loader2, Plus, Store, Trash2, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { currencyFormatter } from '../utils/format';

interface B2BItem {
  productName: string;
  hsnCode: string;
  qty: number;
  price: number;
  taxRate: number;
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const storeIdParam = searchParams.get('storeId');

  const [isCreating, setIsCreating] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState(storeIdParam || '');

  useEffect(() => {
    if (storeIdParam) {
      setSelectedStoreId(storeIdParam);
    }
  }, [storeIdParam]);

  const [items, setItems] = useState<B2BItem[]>([
    { productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }
  ]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const storesQuery = useQuery({
    queryKey: ['super-admin-stores-list'],
    queryFn: () => adminApi.stores({ limit: 200, isActive: true }),
  });

  const invoicesQuery = useQuery({
    queryKey: ['super-admin-b2b-invoices', storeIdParam],
    queryFn: () => adminApi.getB2BInvoices({ limit: 50, storeId: storeIdParam || undefined }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (payload: any) => adminApi.createB2BInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
      setIsCreating(false);
      resetForm();
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to create invoice');
    }
  });

  const resetForm = () => {
    setSelectedStoreId('');
    setItems([{ productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }]);
    setInvoiceNumber('');
    setInvoiceDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleAddItem = () => {
    setItems([...items, { productName: '', hsnCode: '', qty: 1, price: 0, taxRate: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof B2BItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleDownload = async (id: string, invoiceNum: string) => {
    try {
      const blob = await adminApi.downloadB2BInvoice(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Download failed', error);
      alert('Failed to download invoice. Please try again.');
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const taxAmount = items.reduce((sum, item) => sum + (item.qty * item.price * item.taxRate / 100), 0);
  const total = subtotal + taxAmount;

  if (invoicesQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <PageHeader
          title="B2B Tax Invoices"
          subtitle="Generate and manage A5-sized tax invoices for store transactions."
        />
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary-500/20 transition-all hover:bg-primary-700 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Create Invoice
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {invoicesQuery.data?.data.map((invoice: any) => (
          <div
            key={invoice._id}
            className="group relative overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_50px_rgba(45,106,79,0.12)]"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-[1.25rem] bg-primary-50 p-3.5 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                <FileText size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Amount</p>
                <p className="text-2xl font-black text-slate-900">{currencyFormatter.format(invoice.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Store Name</p>
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  <Store size={14} className="text-primary-500" />
                  {invoice.storeId?.name || 'Unknown Store'}
                </p>
              </div>

              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Invoice No.</p>
                  <p className="font-bold text-slate-900">{invoice.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Date</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600 justify-end">
                    <Calendar size={14} className="text-primary-500" />
                    <span>{format(new Date(invoice.invoiceDate), 'PP')}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload(invoice._id, invoice.invoiceNumber)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-primary-500/25 active:scale-95"
            >
              <Download size={16} strokeWidth={3} />
              Download A5 PDF
            </button>
          </div>
        ))}

        {invoicesQuery.data?.data.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
            <div className="mb-6 rounded-full bg-white p-8 shadow-xl">
              <FileText size={48} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900">No invoices yet</h3>
            <p className="mt-2 font-medium text-slate-500">Generate your first B2B tax invoice to see it here.</p>
          </div>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] border border-primary-100 bg-white p-10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-primary-600 p-3 text-white shadow-lg shadow-primary-500/20">
                  <Plus size={24} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Generator</p>
                  <h2 className="text-2xl font-black text-slate-900">New B2B Invoice</h2>
                </div>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="rounded-2xl border border-primary-100 p-3 text-slate-400 hover:bg-primary-50 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Target Store</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50/50 px-5 py-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    <option value="">Select a store</option>
                    {storesQuery.data?.data.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Invoice Number</label>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50/50 px-5 py-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50/50 px-5 py-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Invoice Items</p>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <Plus size={14} strokeWidth={3} />
                    Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_120px_80px_120px_100px_auto] gap-3 items-center">
                      <input
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        placeholder="Product Name"
                        className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        value={item.hsnCode}
                        onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                        placeholder="HSN"
                        className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                        placeholder="Qty"
                        className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 text-right"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                        placeholder="Price"
                        className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 text-right"
                      />
                      <select
                        value={item.taxRate}
                        onChange={(e) => handleItemChange(index, 'taxRate', Number(e.target.value))}
                        className="rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length === 1}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] bg-slate-900 p-8 text-white shadow-xl">
                <div className="flex flex-wrap justify-between gap-8">
                  <div className="space-y-4 min-w-[200px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subtotal</span>
                      <span className="font-bold">{currencyFormatter.format(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tax Amount</span>
                      <span className="font-bold">{currencyFormatter.format(taxAmount)}</span>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Grand Total</span>
                      <span className="text-3xl font-black text-primary-400">{currencyFormatter.format(total)}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-end gap-3 min-w-[200px]">
                     <button
                      onClick={() => createInvoiceMutation.mutate({
                        storeId: selectedStoreId,
                        items,
                        invoiceNumber: invoiceNumber || undefined,
                        invoiceDate: invoiceDate || undefined
                      })}
                      disabled={!selectedStoreId || createInvoiceMutation.isPending}
                      className="flex items-center justify-center gap-3 rounded-2xl bg-primary-500 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {createInvoiceMutation.isPending ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <IndianRupee size={18} />
                          Generate & Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
