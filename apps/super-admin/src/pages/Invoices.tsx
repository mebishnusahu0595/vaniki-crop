import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Calendar, Loader2, Plus, Store, Trash2, IndianRupee, ChevronLeft, ChevronRight, RefreshCw, Settings, CheckCircle2, XCircle, FileCode } from 'lucide-react';
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

  // Pagination State
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [storeIdParam]);

  useEffect(() => {
    if (storeIdParam) {
      setSelectedStoreId(storeIdParam);
    }
  }, [storeIdParam]);

  const [items, setItems] = useState<B2BItem[]>([
    { productName: '', hsnCode: '38089190', qty: 1, price: 0, taxRate: 18 }
  ]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [buyerOrderNo, setBuyerOrderNo] = useState('');
  const [dispatchDocNo, setDispatchDocNo] = useState('');
  const [despatchedThrough, setDespatchedThrough] = useState('Vaniki Fleet / Transport');
  const [destination, setDestination] = useState('');
  const [termsOfDelivery, setTermsOfDelivery] = useState('Door Delivery');
  const [paymentTerms, setPaymentTerms] = useState('Immediate / On Delivery');

  const storesQuery = useQuery({
    queryKey: ['super-admin-stores-list'],
    queryFn: () => adminApi.stores({ limit: 200, isActive: true }),
  });

  useEffect(() => {
    if (selectedStoreId && storesQuery.data?.data) {
      const s = storesQuery.data.data.find(st => st.id === selectedStoreId);
      if (s && !destination) {
        setDestination(s.address?.city || s.address?.state || '');
      }
    }
  }, [selectedStoreId, storesQuery.data]);

  const invoicesQuery = useQuery({
    queryKey: ['super-admin-b2b-invoices', storeIdParam, page],
    queryFn: () => adminApi.getB2BInvoices({ limit: 25, page, storeId: storeIdParam || undefined }),
  });

  const invoices = invoicesQuery.data?.data || [];
  const pagination = invoicesQuery.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

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

  const [isTallyModalOpen, setIsTallyModalOpen] = useState(false);
  const [tallyConfigForm, setTallyConfigForm] = useState({
    tallyHost: '127.0.0.1',
    tallyPort: 9000,
    companyName: 'Vaniki Crop Science Pvt Ltd',
    salesLedger: 'Sales - Agro Chemicals',
    cgstLedger: 'CGST Output',
    sgstLedger: 'SGST Output',
    igstLedger: 'IGST Output',
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const tallySettingsQuery = useQuery({
    queryKey: ['tally-settings'],
    queryFn: () => adminApi.getTallySettings(),
  });

  useEffect(() => {
    if (tallySettingsQuery.data) {
      setTallyConfigForm({
        tallyHost: tallySettingsQuery.data.tallyHost || '127.0.0.1',
        tallyPort: tallySettingsQuery.data.tallyPort || 9000,
        companyName: tallySettingsQuery.data.companyName || 'Vaniki Crop Science Pvt Ltd',
        salesLedger: tallySettingsQuery.data.salesLedger || 'Sales - Agro Chemicals',
        cgstLedger: tallySettingsQuery.data.cgstLedger || 'CGST Output',
        sgstLedger: tallySettingsQuery.data.sgstLedger || 'SGST Output',
        igstLedger: tallySettingsQuery.data.igstLedger || 'IGST Output',
      });
    }
  }, [tallySettingsQuery.data]);

  const updateTallySettingsMutation = useMutation({
    mutationFn: (payload: any) => adminApi.updateTallySettings(payload),
    onSuccess: () => {
      alert('Tally settings saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['tally-settings'] });
      setIsTallyModalOpen(false);
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Failed to save Tally settings');
    }
  });

  const syncAllTallyMutation = useMutation({
    mutationFn: () => adminApi.syncTallyNow(),
    onSuccess: (data) => {
      alert(`Tally Direct Sync Complete!\nProcessed: ${data.totalProcessed}\nSuccess: ${data.successCount}\nFailed: ${data.failedCount}`);
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Tally Sync Failed');
    }
  });

  const syncSingleInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => adminApi.syncInvoiceToTally(invoiceId),
    onSuccess: () => {
      alert('Invoice successfully pushed to Tally!');
      queryClient.invalidateQueries({ queryKey: ['super-admin-b2b-invoices'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Invoice Tally Push Failed');
    }
  });

  const handleDownloadTallyXml = async (id: string, invoiceNum: string) => {
    try {
      const blob = await adminApi.downloadTallyXml(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tally_Invoice_${invoiceNum}.xml`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      alert('Failed to download Tally XML');
    }
  };

  const handleTestTally = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.getTallyStatus({ host: tallyConfigForm.tallyHost, port: Number(tallyConfigForm.tallyPort) });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="B2B Tax Invoices"
          subtitle="Generate, manage, and sync tax invoices with TallyPrime / Tally.ERP 9."
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => syncAllTallyMutation.mutate()}
            disabled={syncAllTallyMutation.isPending}
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncAllTallyMutation.isPending ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
            <span>{syncAllTallyMutation.isPending ? 'Syncing to Tally...' : 'Sync All with Tally'}</span>
          </button>

          <button
            onClick={() => setIsTallyModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Settings size={16} className="text-slate-500" />
            <span>Tally Config</span>
          </button>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary-500/20 transition-all hover:bg-primary-700 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {invoices.map((invoice: any, index) => (
          <div
            key={invoice._id}
            className="group relative overflow-hidden rounded-[2.5rem] border border-primary-100 bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_50px_rgba(45,106,79,0.12)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                  #{(page - 1) * 25 + index + 1}
                </span>
                <div className="rounded-[1.25rem] bg-primary-50 p-3.5 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                  <FileText size={24} />
                </div>
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

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Tally Status</span>
                {invoice.tallySyncStatus === 'synced' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
                    ✓ Synced (Vch #{invoice.tallyVoucherNumber || '-'})
                  </span>
                ) : invoice.tallySyncStatus === 'failed' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-lg">
                    ✕ Failed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-lg">
                    ⏳ Pending
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <button
                onClick={() => handleDownload(invoice._id, invoice.invoiceNumber)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-md transition-all hover:bg-primary-600 active:scale-95"
              >
                <Download size={15} strokeWidth={2.5} />
                Download A5 PDF
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownloadTallyXml(invoice._id, invoice.invoiceNumber)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                  title="Download Tally XML file"
                >
                  <FileCode size={14} />
                  Tally XML
                </button>
                <button
                  onClick={() => syncSingleInvoiceMutation.mutate(invoice._id)}
                  disabled={syncSingleInvoiceMutation.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  title="Push directly to Tally Server"
                >
                  <RefreshCw size={14} className={syncSingleInvoiceMutation.isPending ? 'animate-spin' : ''} />
                  Push Tally
                </button>
              </div>
            </div>
          </div>
        ))}

        {invoices.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
            <div className="mb-6 rounded-full bg-white p-8 shadow-xl">
              <FileText size={48} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900">No invoices yet</h3>
            <p className="mt-2 font-medium text-slate-500">Generate your first B2B tax invoice to see it here.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[1.5rem] border border-primary-100 bg-white p-4 shadow-sm mt-4">
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

              {/* Transport & Order References */}
              <div className="rounded-2xl border border-primary-100 bg-primary-50/20 p-6 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-primary-600">
                  🚚 Transport & Dispatch Details (Auto-Synced with Tally)
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Buyer Order No.</label>
                    <input
                      value={buyerOrderNo}
                      onChange={(e) => setBuyerOrderNo(e.target.value)}
                      placeholder="Auto / PO Number"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Despatch Doc / LR No.</label>
                    <input
                      value={dispatchDocNo}
                      onChange={(e) => setDispatchDocNo(e.target.value)}
                      placeholder="e.g. LR-98234"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Despatched Through / Transport</label>
                    <input
                      value={despatchedThrough}
                      onChange={(e) => setDespatchedThrough(e.target.value)}
                      placeholder="e.g. Vaniki Fleet / VRL Logistics"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Destination</label>
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="e.g. Durg / Raipur"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Terms of Delivery</label>
                    <input
                      value={termsOfDelivery}
                      onChange={(e) => setTermsOfDelivery(e.target.value)}
                      placeholder="e.g. Door Delivery / Ex-Godown"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Mode / Terms of Payment</label>
                    <input
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g. Immediate / Net 30"
                      className="w-full rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
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
                        invoiceDate: invoiceDate || undefined,
                        buyerOrderNo: buyerOrderNo || undefined,
                        dispatchDocNo: dispatchDocNo || undefined,
                        despatchedThrough: despatchedThrough || undefined,
                        destination: destination || undefined,
                        termsOfDelivery: termsOfDelivery || undefined,
                        paymentTerms: paymentTerms || undefined,
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

      {/* Tally Server Configuration Modal */}
      {isTallyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Tally Integration Settings</h3>
                  <p className="text-xs font-medium text-slate-500">Configure TallyPrime / Tally.ERP 9 Server connection & ledgers</p>
                </div>
              </div>
              <button
                onClick={() => setIsTallyModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Server Connection Section */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3">Tally HTTP Server Endpoint</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Tally Host / IP</label>
                    <input
                      value={tallyConfigForm.tallyHost}
                      onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, tallyHost: e.target.value })}
                      placeholder="127.0.0.1 or server IP"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Tally XML Port</label>
                    <input
                      type="number"
                      value={tallyConfigForm.tallyPort}
                      onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, tallyPort: Number(e.target.value) })}
                      placeholder="9000"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestTally}
                    disabled={isTesting}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>Test Connection</span>
                  </button>

                  {testResult && (
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      {testResult.connected ? (
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                          <CheckCircle2 size={14} />
                          Tally Connected (Port {testResult.port})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-700 bg-rose-100 px-3 py-1 rounded-lg">
                          <XCircle size={14} />
                          Connection Failed ({testResult.error || 'Check Tally F12 ODBC'})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Company & Ledger Mapping */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Company &amp; Accounting Ledgers</h4>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Company Name in Tally</label>
                  <input
                    value={tallyConfigForm.companyName}
                    onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, companyName: e.target.value })}
                    placeholder="Vaniki Crop Science Pvt Ltd"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Sales Ledger Name</label>
                  <input
                    value={tallyConfigForm.salesLedger}
                    onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, salesLedger: e.target.value })}
                    placeholder="Sales - Agro Chemicals"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">CGST Ledger</label>
                    <input
                      value={tallyConfigForm.cgstLedger}
                      onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, cgstLedger: e.target.value })}
                      placeholder="CGST Output"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">SGST Ledger</label>
                    <input
                      value={tallyConfigForm.sgstLedger}
                      onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, sgstLedger: e.target.value })}
                      placeholder="SGST Output"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">IGST Ledger</label>
                    <input
                      value={tallyConfigForm.igstLedger}
                      onChange={(e) => setTallyConfigForm({ ...tallyConfigForm, igstLedger: e.target.value })}
                      placeholder="IGST Output"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setIsTallyModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateTallySettingsMutation.mutate(tallyConfigForm)}
                  disabled={updateTallySettingsMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {updateTallySettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

