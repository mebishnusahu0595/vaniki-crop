import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Truck, Trash2, Package } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import { resolveMediaUrl } from '../utils/media';

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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedPack, setRequestedPack] = useState('');
  const [garageName, setGarageName] = useState('');
  const [petiQuantity, setPetiQuantity] = useState<number | string>(1);
  const [petiSize, setPetiSize] = useState<number | string>(12);
  const [requestNotes, setRequestNotes] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [hsnCode, setHsnCode] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const inventoryQuery = useQuery({
    queryKey: ['admin-dealer-inventory'],
    queryFn: adminApi.inventoryProducts,
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-product-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });

  const garagesQuery = useQuery({
    queryKey: ['admin-garages'],
    queryFn: adminApi.garages,
  });

  const filteredProducts = useMemo(() => {
    const products = inventoryQuery.data || [];
    if (!selectedCategory) return products;
    return products.filter((product) => {
      const prodCategoryId = product.category?.id || (product.category as any)?._id;
      return prodCategoryId === selectedCategory;
    });
  }, [inventoryQuery.data, selectedCategory]);

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
    const brandName = product.name?.trim() || '';
    const techDesc = product.shortDescription?.trim() || '';
    const fullDisplayName = brandName && techDesc && !brandName.toLowerCase().includes(techDesc.toLowerCase())
      ? `${brandName} (${techDesc})`
      : brandName || techDesc;

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      productName: fullDisplayName,
      shortDescription: product.shortDescription || '',
      petiQuantity: Number(petiQuantity) || 1,
      petiSize: Number(petiSize) || product.petiSize || 12,
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
    setPetiSize(12);
    setPrice(0);
    setOfferPrice(0);
    setHsnCode('');
    setIsModalOpen(false);
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
          productName: item.productName,
          petiQuantity: item.petiQuantity,
          petiSize: item.petiSize,
          requestedQuantity: item.petiQuantity * (item.petiSize || 1),
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

  const totalVolumeText = useMemo(() => {
    const groups: Record<string, number> = {};
    cart.forEach(item => {
      const unit = item.petiUnit || 'Liter';
      const volume = item.petiQuantity * item.petiSize;
      groups[unit] = (groups[unit] || 0) + volume;
    });
    const parts = Object.entries(groups).map(([unit, vol]) => `${vol} ${unit}`);
    return parts.length > 0 ? parts.join(', ') : '0 Liter';
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
              <div>
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
                  Filter by Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                  }}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition font-semibold"
                >
                  <option value="">All Categories</option>
                  {categoriesQuery.data?.data.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid display for category filtered products */}
            <div className="mt-6 border-t border-primary-100 pt-6">
              <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wider">Choose Products below</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProductId(product.id);
                      const firstVariant = product.variants?.[0];
                      setRequestedPack(firstVariant?.label || '');
                      setPrice(firstVariant?.dealerPrice || firstVariant?.price || 0);
                      setOfferPrice(firstVariant?.offerPrice || 0);
                      setHsnCode(firstVariant?.hsnCode || product.hsnCode || '');
                      setPetiQuantity(1);
                      setPetiSize(product.petiSize || 12);
                      setIsModalOpen(true);
                    }}
                    className="group flex flex-col rounded-2xl border border-primary-100 bg-primary-50/10 p-3.5 transition-all hover:bg-white hover:shadow-lg hover:border-primary-300 cursor-pointer overflow-hidden relative"
                  >
                    <div className="aspect-square w-full bg-slate-50 border border-primary-50 rounded-xl overflow-hidden mb-3 relative flex items-center justify-center">
                      {product.image ? (
                        <img
                          src={resolveMediaUrl(product.image)}
                          alt={product.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package className="h-10 w-10 text-primary-200" strokeWidth={1} />
                      )}
                    </div>
                    <p className="font-black text-xs text-slate-900 line-clamp-1 leading-tight">{product.name}</p>
                    {product.shortDescription ? (
                      <p className="text-[10px] text-slate-500 font-bold mt-1 line-clamp-2 leading-snug">{product.shortDescription}</p>
                    ) : null}
                    {product.petiSize ? (
                      <p className="text-[9px] text-primary-700 font-black mt-auto bg-primary-50 self-start px-2 py-0.5 rounded-lg border border-primary-100">
                        {product.petiSize} {product.petiUnit || 'Liter'} per Peti
                      </p>
                    ) : null}
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-300">
                    <Package size={40} strokeWidth={1} />
                    <p className="mt-2 text-xs font-bold uppercase tracking-widest text-center">No products found in this category.</p>
                  </div>
                )}
              </div>
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
                <p className="text-xl font-black text-primary-400">{totalVolumeText}</p>
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
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-center">Batch is empty.<br />Add products to start.</p>
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

      {/* Custom Modal for Variant, Peti Size, and Peti Quantity selection */}
      {isModalOpen && selectedProductId && (() => {
        const product = inventoryQuery.data?.find(p => p.id === selectedProductId);
        if (!product) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-[2.5rem] border border-primary-100 bg-white p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedProductId('');
                }}
                className="absolute right-6 top-6 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition font-black text-lg"
              >
                ✕
              </button>

              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-slate-50 border border-primary-50 rounded-xl overflow-hidden flex items-center justify-center">
                  {product.image ? (
                    <img src={resolveMediaUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-primary-200" strokeWidth={1} />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{product.name}</h3>
                  {product.shortDescription ? (
                    <p className="text-xs font-medium text-slate-500 mt-1">{product.shortDescription}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-primary-100">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Select Pack Size (Variant)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variants.map((v) => {
                      const isSelected = requestedPack === v.label;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setRequestedPack(v.label);
                            setPrice(v.dealerPrice || v.price || 0);
                            setOfferPrice(v.offerPrice || 0);
                            setHsnCode(v.hsnCode || product.hsnCode || '');
                          }}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-900 font-black shadow-sm'
                              : 'border-primary-100 hover:bg-primary-50/30 text-slate-700'
                          }`}
                        >
                          <p className="text-xs font-bold">{v.label}</p>
                          <p className="text-[10px] mt-1 opacity-80">
                            ₹{v.dealerPrice || v.price || 'N/A'} (Offer: ₹{v.offerPrice || 'N/A'})
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Peti Size ({product.petiUnit || 'Liter'})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={petiSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setPetiSize('');
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num)) setPetiSize(num);
                        }
                      }}
                      className="w-full rounded-xl border border-primary-100 bg-white px-3 py-3 text-sm font-black text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Peti Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={petiQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setPetiQuantity('');
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num)) setPetiQuantity(num);
                        }
                      }}
                      className="w-full rounded-xl border border-primary-100 bg-white px-3 py-3 text-sm font-black text-slate-900 shadow-sm focus:ring-2 focus:ring-primary-500 outline-none transition"
                    />
                  </div>
                </div>

                {hsnCode && (
                  <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg border border-emerald-100">
                    HSN Code: {hsnCode}
                  </p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedProductId('');
                  }}
                  className="flex-1 rounded-2xl border border-primary-100 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!requestedPack || !petiQuantity || !petiSize}
                  onClick={addToCart}
                  className="flex-1 rounded-2xl bg-primary-500 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50 transition"
                >
                  Add to Batch List
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
