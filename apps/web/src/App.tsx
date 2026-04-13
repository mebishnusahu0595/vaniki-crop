import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { storefrontApi } from './utils/api';
import { useAuthStore } from './store/useAuthStore';
import { useServiceModeStore } from './store/useServiceModeStore';
import { useStoreStore } from './store/useStoreStore';
import WhatsAppWidget from './components/WhatsAppWidget';

const Layout = lazy(() => import('./components/layout/Layout'));
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/Account'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Categories = lazy(() => import('./pages/Categories'));
const Compare = lazy(() => import('./pages/Compare'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));

// Register GSAP Plugins
gsap.registerPlugin(ScrollTrigger);

const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25 },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

const SmoothScroll: React.FC = () => {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      syncTouch: false,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    const updateLenisFrame = (time: number) => {
      lenis.raf(time * 1000);
    };

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(updateLenisFrame);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateLenisFrame);
      lenis.destroy();
    };
  }, []);

  return null;
};

const RefreshScrollTriggersOnRouteChange: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return null;
};

const SessionBootstrap: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);

  const sessionQuery = useQuery({
    queryKey: ['session', token],
    queryFn: storefrontApi.me,
    enabled: !!token,
    retry: 1,
  });

  useEffect(() => {
    const session = sessionQuery.data;
    if (!session) return;

    setUser(session);
    if (session.serviceMode) setMode(session.serviceMode);
    if (session.savedAddress) setAddress(session.savedAddress);
    if (session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
    }
    updateUser(session);
  }, [sessionQuery.data, setAddress, setMode, setStore, setUser, updateUser]);

  useEffect(() => {
    const error = sessionQuery.error;
    if (!token || !error || !axios.isAxiosError(error) || error.response?.status !== 401) {
      return;
    }

    logout();
    setAddress(null);
    setStore(null);
  }, [logout, sessionQuery.error, setAddress, setStore, token]);

  return null;
};

const PageFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
};

const RouteLoadingState: React.FC = () => {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingState />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route element={<Layout />}>
            <Route path="/" element={<PageFrame><Home /></PageFrame>} />
            <Route path="/products" element={<PageFrame><Products /></PageFrame>} />
            <Route path="/product/:slug" element={<PageFrame><ProductDetail /></PageFrame>} />
            <Route path="/cart" element={<PageFrame><Cart /></PageFrame>} />
            <Route path="/checkout" element={<PageFrame><Checkout /></PageFrame>} />
            <Route path="/account" element={<PageFrame><Account /></PageFrame>} />
            <Route path="/categories" element={<PageFrame><Categories /></PageFrame>} />
            <Route path="/compare" element={<PageFrame><Compare /></PageFrame>} />
            <Route path="/about" element={<PageFrame><About /></PageFrame>} />
            <Route path="/contact" element={<PageFrame><Contact /></PageFrame>} />
            <Route path="/login" element={<PageFrame><Login /></PageFrame>} />
            <Route path="/signup" element={<PageFrame><Signup /></PageFrame>} />
            <Route path="/order-success/:id" element={<PageFrame><OrderSuccess /></PageFrame>} />
          </Route>
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <SmoothScroll />
      <RefreshScrollTriggersOnRouteChange />
      <SessionBootstrap />
      <AnimatedRoutes />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: 'rounded-2xl border border-primary-100 bg-white text-primary-900 shadow-xl',
        }}
      />
      <WhatsAppWidget />
    </Router>
  );
};

export default App;
