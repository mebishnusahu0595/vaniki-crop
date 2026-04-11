import {
  Boxes,
  PackageSearch,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '../utils/cn';

interface SidebarNavItem {
  to: string;
  label: string;
  icon: typeof ShoppingCart;
}

const navItems: SidebarNavItem[] = [
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/40 transition md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-[280px] flex-col border-r border-primary-100 bg-white px-4 py-5 shadow-[0_20px_80px_rgba(15,23,42,0.12)] transition md:static md:translate-x-0 md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/orders" className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-500 p-2.5 text-white">
              <Boxes size={18} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary-500">Vaniki Crop</p>
              <p className="text-sm font-semibold text-slate-500">Store Admin</p>
            </div>
          </Link>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-primary-50 md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition',
                    isActive
                      ? 'bg-primary-500 text-white shadow-[0_12px_30px_rgba(45,106,79,0.24)]'
                      : 'text-slate-600 hover:bg-primary-50 hover:text-slate-900',
                  )
                }
              >
                <span className="flex items-center gap-3">
                  <item.icon size={18} />
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[1.5rem] border border-primary-100 bg-primary-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-2 text-primary-600">
              <PackageSearch size={16} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Store-first operations</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Track order lifecycle and fulfilment updates for your assigned store.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
