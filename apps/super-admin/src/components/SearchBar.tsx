import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminApi } from '../utils/api';
import { currencyFormatter } from '../utils/format';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const searchQuery = useQuery({
    queryKey: ['admin-search', debouncedQuery],
    queryFn: () => adminApi.search(debouncedQuery),
    enabled: debouncedQuery.trim().length > 1,
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const results = searchQuery.data;
  const hasResults = Boolean(
    results?.orders.length || results?.products.length || results?.customers.length,
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-slate-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Search orders, products, customers"
          className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none"
        />
      </div>

      {open && debouncedQuery.trim().length > 1 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-40 rounded-[1.5rem] border border-primary-100 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          {searchQuery.isLoading ? (
            <p className="px-2 py-3 text-sm font-medium text-slate-500">Searching...</p>
          ) : hasResults ? (
            <div className="space-y-4">
              {results?.orders.length ? (
                <div>
                  <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Orders</p>
                  <div className="mt-2 space-y-1">
                    {results.orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => {
                          navigate(`/orders?highlight=${order.id}`);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-primary-50"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900">{order.orderNumber}</p>
                          <p className="text-xs text-slate-500">{order.status}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary-700">
                          {currencyFormatter.format(order.totalAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {results?.products.length ? (
                <div>
                  <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Products</p>
                  <div className="mt-2 space-y-1">
                    {results.products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          navigate(`/products/${product.id}/edit`);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-primary-50"
                      >
                        <p className="text-sm font-black text-slate-900">{product.name}</p>
                        <span className="text-xs font-semibold text-slate-500">{product.isActive ? 'Active' : 'Hidden'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {results?.customers.length ? (
                <div>
                  <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-500">Customers</p>
                  <div className="mt-2 space-y-1">
                    {results.customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          navigate(`/customers?search=${customer.mobile}`);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-primary-50"
                      >
                        <p className="text-sm font-black text-slate-900">{customer.name}</p>
                        <span className="text-xs font-semibold text-slate-500">{customer.mobile}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="px-2 py-3 text-sm font-medium text-slate-500">No matching orders, products, or customers.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
