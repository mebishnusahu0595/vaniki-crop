import { LogOut, Menu, UserRoundCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const user = useAdminAuthStore((state) => state.user);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  return (
    <header className="sticky top-0 z-20 border-b border-primary-100 bg-off-white/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-4 lg:px-8">
        <button onClick={onMenuClick} className="rounded-2xl border border-primary-100 bg-white p-3 md:hidden">
          <Menu size={18} />
        </button>
        <SearchBar />
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="hidden rounded-2xl border border-primary-100 bg-white px-4 py-3 text-left transition hover:border-primary-200 hover:bg-primary-50 sm:block"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Signed in</p>
            <p className="text-sm font-semibold text-slate-800">{user?.name || 'Store Admin'}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="rounded-2xl border border-primary-100 bg-white p-3 text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-slate-900"
            aria-label="Open profile settings"
            title="Profile settings"
          >
            <UserRoundCog size={18} />
          </button>
          <button
            onClick={async () => {
              await adminApi.logout().catch(() => undefined);
              clearSession();
              navigate('/login');
            }}
            className="rounded-2xl border border-primary-100 bg-white p-3 text-slate-600 transition hover:text-slate-900"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
