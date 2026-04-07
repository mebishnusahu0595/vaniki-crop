import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { LoadingBlock } from '../components/LoadingBlock';
import { Sidebar } from '../components/Sidebar';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';

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
    <div className="min-h-screen bg-off-white text-slate-900 md:grid md:grid-cols-[280px_1fr]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
