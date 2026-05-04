import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Truck, Plus, Trash2, Package } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  shortDescription: string;
  petiQuantity: number;
  petiSize: number;
  petiUnit: string;
  variantLabel: string;
  variantId: string;
  price?: number;
  dealerPrice?: number;
  offerPrice?: number;
  hsnCode?: string;
}

export default function ProductRequestsPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedPack, setRequestedPack] = useState('');
  const [garageName, setGarageName] = useState('');
  const [petiQuantity, setPetiQuantity] = useState(1);
  const [requestNotes, setRequestNotes] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [hsnCode, setHsnCode] = useState('');

  const inventoryQuery = useQuery({
    queryKey: ['admin-dealer-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  const garagesQuery = useQuery({
    queryKey: ['admin-garages'],
    queryFn: adminApi.garages,
  });

  // Auto-select first garage when data loads
  useState(() => {
    if (garagesQuery.data?.length && !garageName) {
      setGarageName(garagesQuery.data[0]);
    }
  });

  if (garagesQuery.data?.length && !garageName) {
    setGarageName(garagesQuery.data[0]);
  }

  const addToCart = () => {
    const product = inventoryQuery.data?.find((p) => p.id === selectedProductId);
    if (!product || !requestedPack) return;

    const variant = product.variants.find(v => v.label === requestedPack);
    if (!variant) return;

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      productName: product.name,
      shortDescription: product.shortDescription || '',
      petiQuantity,
      petiSize: product.petiSize || 12,
      petiUnit: product.petiUnit || 'Liter',
      variantLabel: variant.label,
      variantId: variant.id,
      price: price > 0 ? price : undefined,
      dealerPrice: variant.dealerPrice,
      offerPrice: offerPrice > 0 ? offerPrice : variant.offerPrice,
      hsnCode: hsnCode.trim() || undefined,
    };

    setCart([...cart, newItem]);
    setSelectedProductId('');
    setRequestedPack('');
    setPetiQuantity(1);
    setPrice(0);
    setOfferPrice(0);
    setHsnCode('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const createRequestMutation = useMutation({
    mutationFn: () =>
      adminApi.createProductRequest({
        garageName,
        notes: requestNotes,
        items: cart.map(item => ({
          productId: item.productId,
          petiQuantity: item.petiQuantity,
          requestedPack: item.variantLabel,
          price: item.price,
          dealerPrice: item.dealerPrice,
          offerPrice: item.offerPrice,
          hsnCode: item.hsnCode,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-requests'] });
      setCart([]);
      setRequestNotes('');
      alert('Product requests sent successfully!');
    },
  });

  const totalVolume = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.petiQuantity * item.petiSize), 0);
  }, [cart]);

  if (inventoryQuery.isLoading) {
    return <LoadingBlock label="Loading products..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Product Requests"
        subtitle="Select multiple products and send a batch request to the super admin."
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-2xl bg-primary-100 p-2.5 text-primary-600">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Selection</p>
                <h3 className="text-xl font-black text-slate-900">Add to Batch</h3>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Garage Name (Kahan se aaye material)
                </label>
                <select
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 focus:ring-2 focus:ring-primary-500 outline-none transition"
                >
                  {!garagesQuery.data?.length && <option value="">Select a garage</option>}
                  {garagesQuery.data?.map((garage) => (
                    <option key={garage} value={garage}>
                      {garage}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(event) => {
                    setSelectedProductId(event.target.value);
                    setRequestedPack('');
                  }}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
                >
                  <option value="">Choose product</option>
                  {inventoryQuery.data?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Select Pack Size
                </label>
                <select
                  value={requestedPack}
                  disabled={!selectedProductId}
                  onChange={(e) => {
                    const packLabel = e.target.value;
                    setRequestedPack(packLabel);
                    const product = inventoryQuery.data?.find(p => p.id === selectedProductId);
                    const variant = product?.variants.find(v => v.label === packLabel);
                    if (variant) {
                      setPrice(variant.dealerPrice || variant.price || 0);
                      setOfferPrice(variant.offerPrice || 0);
                    }
                  }}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition disabled:opacity-50"
                >
                  <option value="">Choose pack</option>
                  {inventoryQuery.data?.find(p => p.id === selectedProductId)?.variants.map(v => (
                    <option key={v.id} value={v.label}>{v.label}</option>
                  ))}
                </select>
              </div>

              {selectedProductId && (
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-bold text-slate-700">Product Info</p>
                  <div className="rounded-2xl bg-primary-50 p-4 border border-primary-100">
                    <p className="text-lg font-black text-primary-900 leading-tight">
                      {inventoryQuery.data?.find(p => p.id === selectedProductId)?.name}
                    </p>
                    <p className="mt-1 text-sm font-medium text-primary-700 opacity-80">
                      {inventoryQuery.data?.find(p => p.id === selectedProductId)?.shortDescription}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-primary-200/50">
                      <p className="text-[10px] font-black uppercase tracking-wider text-primary-600 mb-3">Product Pricing Information</p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {inventoryQuery.data?.find(p => p.id === selectedProductId)?.variants.map((v: any) => (
                          <div key={v.id} className="rounded-xl bg-white/60 p-3 border border-primary-200/50">
                            <p className="text-xs font-black text-slate-900 mb-2">{v.label}</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-500 uppercase">Price (Dealer)</span>
                                <span className="text-primary-700">₹{v.dealerPrice || v.price || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-500 uppercase">Offer Price</span>
                                <span className="text-emerald-600">₹{v.offerPrice || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedProductId && (
                <div className="md:col-span-2 rounded-2xl bg-primary-50/50 p-5 border border-primary-100 shadow-inner">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-500">Peti Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={petiQuantity}
                        onChange={(e) => setPetiQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-xl border border-primary-100 bg-white px-3 py-3 text-base font-black text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-500">Peti Size</label>
                      <div className="w-full rounded-xl border border-primary-100 bg-slate-100 px-3 py-3 text-base font-black text-slate-500">
                        {inventoryQuery.data?.find((p) => p.id === selectedProductId)?.petiSize || 12}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-500">Offer Price (Optional)</label>
                      <input
                        type="number"
                        placeholder="₹"
                        value={offerPrice || ''}
                        onChange={(e) => setOfferPrice(Number(e.target.value))}
                        className="w-full rounded-xl border border-primary-100 bg-white px-3 py-3 text-base font-black text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold text-slate-500">HSN (Optional)</label>
                      <input
                        type="text"
                        placeholder="HSN Code"
                        value={hsnCode}
                        onChange={(e) => setHsnCode(e.target.value)}
                        className="w-full rounded-xl border border-primary-100 bg-white px-3 py-3 text-base font-black text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!selectedProductId || !requestedPack}
                onClick={addToCart}
                className="md:col-span-2 flex items-center justify-center gap-2 w-full rounded-2xl bg-primary-500 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 transition"
              >
                <Plus size={18} />
                Add to Batch List
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary-100 bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Additional Notes for Super Admin
            </label>
            <textarea
              value={requestNotes}
              onChange={(event) => setRequestNotes(event.target.value)}
              placeholder="Any special instructions for this batch..."
              className="min-h-[100px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-primary-100 bg-white shadow-xl flex flex-col overflow-hidden h-fit sticky top-6">
          <div className="bg-slate-900 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-primary-500 p-2 text-white shadow-lg shadow-primary-500/30">
                <ShoppingCart size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">Request Batch</p>
                <h3 className="text-xl font-black">Bill Summary</h3>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Items</p>
                <p className="text-2xl font-black">{cart.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Volume</p>
                <p className="text-2xl font-black text-primary-400">{totalVolume} <span className="text-xs font-bold uppercase text-slate-500">Liters/Kg</span></p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {cart.map((item) => (
              <div key={item.id} className="group relative rounded-2xl border border-primary-50 bg-primary-50/20 p-4 transition hover:bg-white hover:shadow-md">
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-1.5 text-white shadow-lg opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-900 leading-tight">{item.productName}</p>
                    <p className="text-[10px] font-bold text-primary-600 mt-0.5">
                      {item.variantLabel} 
                      {item.price ? ` • Dealer: ₹${item.price}` : ''}
                      {item.offerPrice ? ` • Offer: ₹${item.offerPrice}` : ''}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500 italic line-clamp-1">
                      {item.hsnCode ? `HSN: ${item.hsnCode} • ` : ''}{item.shortDescription}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{item.petiQuantity} Peti</p>
                    <p className="text-[10px] font-bold text-slate-400">{item.petiQuantity * item.petiSize} {item.petiUnit}</p>
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                <Package size={40} strokeWidth={1} />
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-center">Batch is empty.<br/>Add products to start.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-primary-100">
            <button
              onClick={() => createRequestMutation.mutate()}
              disabled={cart.length === 0 || createRequestMutation.isPending}
              className="w-full rounded-2xl bg-primary-500 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 transition"
            >
              {createRequestMutation.isPending ? 'Processing...' : 'Submit Request Batch'}
            </button>
            <p className="mt-3 text-[10px] text-center text-slate-400 font-medium px-4">
              Requests will be sent to the Super Admin for review and fulfillment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
