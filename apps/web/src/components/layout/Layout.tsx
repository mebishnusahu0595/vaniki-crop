import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import Header from './Header';
import TopNoticeBar from './TopNoticeBar';
import StoreSelector from './StoreSelector';
import CartDrawer from './CartDrawer';
import Footer from './Footer';
import ServiceModeBar from './ServiceModeBar';
import type { ServiceMode } from '../../types/storefront';
import { useAuthStore } from '../../store/useAuthStore';

const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];

const Layout: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [preferredMode, setPreferredMode] = useState<ServiceMode | undefined>(undefined);

  const hideChrome = authRoutes.includes(location.pathname);

  const handleOpenStoreSelector = (mode?: ServiceMode) => {
    setPreferredMode(mode);
    setIsStoreModalOpen(true);
  };

  return (
    <div className="app-shell flex min-h-screen flex-col pb-24 lg:pb-0">
      {!hideChrome && (
        <>
          <div className="sticky top-0 z-50">
            <TopNoticeBar />
            <Header onOpenCart={() => setIsCartOpen(true)} onOpenStoreSelector={handleOpenStoreSelector} />
            {!isAuthenticated ? <ServiceModeBar onOpenStoreSelector={handleOpenStoreSelector} /> : null}
          </div>
        </>
      )}

      <main className="flex-grow">
        <Outlet />
      </main>

      {!hideChrome && <Footer />}
      <StoreSelector
        isOpen={isStoreModalOpen}
        preferredMode={preferredMode}
        onClose={() => setIsStoreModalOpen(false)}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {!hideChrome && <MobileNav />}
    </div>
  );
};

export default Layout;
