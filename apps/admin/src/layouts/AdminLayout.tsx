import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { LoadingBlock } from '../components/LoadingBlock';
import { Sidebar } from '../components/Sidebar';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';

export function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useAdminAuthStore((state) => state.token);
  const hydrated = useAdminAuthStore((state) => state.hydrated);
  const setUser = useAdminAuthStore((state) => state.setUser);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  const sessionQuery = useQuery({
    queryKey: ['admin-session', token],
    queryFn: adminApi.me,
    enabled: Boolean(token),
    retry: 1,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      if (sessionQuery.data.role !== 'storeAdmin') {
        clearSession();
        navigate('/login');
        return;
      }
      setUser(sessionQuery.data);
    }
  }, [clearSession, navigate, sessionQuery.data, setUser]);

  useEffect(() => {
    if (!sessionQuery.error) return;
    clearSession();
    navigate('/login');
  }, [clearSession, navigate, sessionQuery.error]);

  if (!hydrated) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (sessionQuery.isLoading) return <LoadingBlock label="Preparing admin workspace..." />;

  return (
    <div className="min-h-screen bg-off-white text-slate-900 md:grid md:h-screen md:grid-cols-[280px_1fr] md:overflow-hidden">
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
