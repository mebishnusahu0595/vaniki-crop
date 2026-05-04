import {
  BadgePercent,
  Banknote,
  Boxes,
  Box,
  ClipboardList,
  Coins,
  GalleryVerticalEnd,
  Home,
  MessageSquare,
  PackageSearch,
  Settings,
  ShoppingCart,
  Tags,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { cn } from '../utils/cn';

interface SidebarNavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const navItems: SidebarNavItem[] = [
  { to: '/dashboard', label: 'Global Analytics', icon: Home },
  { to: '/stores', label: 'All Stores', icon: Boxes },
  { to: '/admins', label: 'All Admins', icon: Users },
  { to: '/product-requests', label: 'Product Requests', icon: ClipboardList },
  { to: '/products', label: 'Products', icon: Box },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/orders', label: 'All Orders', icon: ShoppingCart },
  { to: '/payments', label: 'All Payments', icon: Banknote },
  { to: '/customers', label: 'All Customers', icon: Users },
  { to: '/coupons', label: 'Coupons', icon: BadgePercent },
  { to: '/banners', label: 'Global Banners', icon: GalleryVerticalEnd },
  { to: '/testimonials', label: 'Testimonials', icon: MessageSquare },
  { to: '/loyalty', label: 'Loyalty Points', icon: Coins },
  { to: '/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/site-settings', label: 'Site Settings (Garages)', icon: Settings },
  { to: '/settings', label: 'Settings', icon: UserCircle2 },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const liveBadgeQueryOptions = {
    staleTime: 5_000,
    refetchInterval: 10_000,
  } as const;

  const pendingDealersQuery = useQuery({
    queryKey: ['super-admin-pending-dealer-count'],
    queryFn: () => adminApi.admins({ approvalStatus: 'pending', page: 1, limit: 1 }),
    ...liveBadgeQueryOptions,
  });

  const pendingProductRequestsQuery = useQuery({
    queryKey: ['super-admin-pending-product-request-count'],
    queryFn: () => adminApi.productRequests({ status: 'pending', page: 1, limit: 1 }),
    ...liveBadgeQueryOptions,
  });

  const newOrdersQuery = useQuery({
    queryKey: ['super-admin-new-order-count'],
    queryFn: () => adminApi.orders({ status: 'placed', page: 1, limit: 1 }),
    ...liveBadgeQueryOptions,
  });

  const pendingReviewsQuery = useQuery({
    queryKey: ['super-admin-pending-review-count'],
    queryFn: () => adminApi.reviews({ status: 'pending', page: 1, limit: 1 }),
    ...liveBadgeQueryOptions,
  });

  const pendingDealersCount = pendingDealersQuery.data?.pagination?.total ?? 0;
  const pendingProductRequestsCount = pendingProductRequestsQuery.data?.pagination?.total ?? 0;
  const newOrdersCount = newOrdersQuery.data?.pagination?.total ?? 0;
  const pendingReviewsCount = pendingReviewsQuery.data?.pagination?.total ?? 0;

  const routeBadgeCount: Partial<Record<SidebarNavItem['to'], number>> = {
    '/admins': pendingDealersCount,
    '/product-requests': pendingProductRequestsCount,
    '/orders': newOrdersCount,
    '/reviews': pendingReviewsCount,
  };

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
          'fixed left-0 top-0 z-40 flex h-full w-[280px] flex-col border-r border-primary-100 bg-white px-4 py-5 shadow-[0_20px_80px_rgba(15,23,42,0.12)] transition md:sticky md:top-0 md:h-screen md:translate-x-0 md:overflow-y-auto md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-500 p-2.5 text-white">
              <Boxes size={18} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary-500">Vaniki Crop</p>
              <p className="text-sm font-semibold text-slate-500">Super Admin</p>
            </div>
          </Link>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-primary-50 md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const badgeCount = routeBadgeCount[item.to] ?? 0;
            const shouldShowBadge = badgeCount > 0;

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
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      <item.icon size={18} />
                      {item.label}
                    </span>
                    {shouldShowBadge ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                          isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </>
                )}
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
              <p className="text-sm font-black text-slate-900">Global platform operations</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Operate every store, monitor cross-store performance, and control platform-wide merchandising.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
