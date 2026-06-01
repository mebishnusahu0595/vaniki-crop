import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { LoadingBlock } from '../components/LoadingBlock';
import { Sidebar } from '../components/Sidebar';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';
import { currencyFormatter } from '../utils/format';

export function OrderNotificationListener() {
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Play Audio Alert function
    const playAlertChime = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create double-ding doorbell sound chime using oscillator nodes
        // First ding
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.45);

        // Second ding slightly later and lower pitch
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5 note
          gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.start();
          osc2.stop(audioCtx.currentTime + 0.65);
        }, 180);
      } catch (error) {
        console.warn('Audio chime failed to play:', error);
      }
    };

    const checkNewOrders = async () => {
      try {
        const response = await adminApi.orders({ limit: 10 });
        if (!response?.data) return;

        const storedSeen = localStorage.getItem('vaniki-superadmin:seen-orders');
        const seenOrderIds: string[] = storedSeen ? JSON.parse(storedSeen) : [];

        // If first run, mark currently fetched orders as seen to avoid alert flooding
        if (isFirstRun.current) {
          const initialIds = response.data.map((order: any) => order.id);
          localStorage.setItem('vaniki-superadmin:seen-orders', JSON.stringify(initialIds));
          isFirstRun.current = false;
          return;
        }

        // Filter for any new orders
        const newOrders = response.data.filter((order: any) => !seenOrderIds.includes(order.id));

        if (newOrders.length > 0) {
          // Play doorbell chime alert
          playAlertChime();

          // Raise push notifications for each new order
          newOrders.forEach((order: any) => {
            const orderNum = order.orderNumber || 'New Order';
            const customer = order.userId?.name || 'Customer';
            const amount = currencyFormatter.format(order.totalAmount);
            const store = order.storeId?.name || 'Unknown Store';

            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('🌾 New Order Placed!', {
                body: `Order ${orderNum} of ${amount} placed by ${customer} at ${store}.`,
                icon: '/favicon.png',
                tag: order.id,
              });

              notification.onclick = () => {
                window.focus();
                window.location.href = '/orders';
              };
            }
          });

          // Update localized storage
          const updatedSeenIds = [...seenOrderIds, ...newOrders.map((o: any) => o.id)].slice(-100);
          localStorage.setItem('vaniki-superadmin:seen-orders', JSON.stringify(updatedSeenIds));
        }
      } catch (error) {
        console.error('Error checking for new orders:', error);
      }
    };

    checkNewOrders();
    const interval = setInterval(checkNewOrders, 15000); // poll every 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  return null;
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useAdminAuthStore((state) => state.token);
  const user = useAdminAuthStore((state) => state.user);
  const hydrated = useAdminAuthStore((state) => state.hydrated);
  const setUser = useAdminAuthStore((state) => state.setUser);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  const sessionQuery = useQuery({
    queryKey: ['admin-session', token],
    queryFn: adminApi.me,
    enabled: Boolean(token),
    retry: 1,
  });

  const normalizedUserRole = useMemo(() => user?.role?.toLowerCase() ?? null, [user?.role]);

  useEffect(() => {
    if (sessionQuery.data) {
      if (sessionQuery.data?.role?.toLowerCase() !== 'superadmin') {
        clearSession();
        return;
      }
      setUser(sessionQuery.data);
    }
  }, [clearSession, sessionQuery.data, setUser]);

  useEffect(() => {
    if (!sessionQuery.error) return;

    const status = (sessionQuery.error as AxiosError | null)?.response?.status;
    if (status === 401) {
      clearSession();
      return;
    }

    if (!user) {
      clearSession();
    }
  }, [clearSession, sessionQuery.error, user]);

  if (!hydrated) return null;
  if (!token) return <Navigate to="/superadmin" replace />;
  if (user && normalizedUserRole !== 'superadmin') return <Navigate to="/superadmin" replace />;
  if (sessionQuery.isLoading && !user) return <LoadingBlock label="Preparing super admin workspace..." />;
  if (sessionQuery.isError && !user) return <Navigate to="/superadmin" replace />;

  return (
    <div className="min-h-screen bg-off-white text-slate-900 md:grid md:h-screen md:grid-cols-[280px_1fr] md:overflow-hidden">
      <OrderNotificationListener />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 md:h-screen md:overflow-y-auto">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
