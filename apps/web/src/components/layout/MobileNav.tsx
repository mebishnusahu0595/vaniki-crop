import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, User, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { cn } from '../../utils/cn';

const MobileNav: React.FC = () => {
  const { t } = useTranslation();
  const totalItems = useCartStore((state) => state.getTotalItems());

  const navItems = [
    { labelKey: 'nav.home', icon: Home, path: '/' },
    { labelKey: 'nav.categories', icon: LayoutGrid, path: '/categories' },
    { labelKey: 'nav.compare', icon: Scale, path: '/compare' },
    { labelKey: 'nav.cart', icon: ShoppingCart, path: '/cart', badge: totalItems > 0 ? totalItems : undefined },
    { labelKey: 'nav.account', icon: User, path: '/account' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-primary-100 bg-white/92 px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.2rem)] shadow-[0_-10px_30px_rgba(8,32,24,0.16)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-1.5 rounded-t-[1.7rem] border border-primary-100 border-b-0 bg-white px-2.5 py-1.5">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => 
            cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1 text-primary-900/45 transition-colors',
              isActive && 'bg-primary-50 text-primary',
            )
          }
        >
          <div className="relative transition-transform group-active:scale-90">
            <item.icon size={20} strokeWidth={2.4} />
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                {item.badge}
              </span>
            )}
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] leading-none">{t(item.labelKey)}</span>
        </NavLink>
      ))}
      </div>
    </nav>
  );
};

export default MobileNav;
