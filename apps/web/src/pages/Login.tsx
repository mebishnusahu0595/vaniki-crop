import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import { storefrontApi } from '../utils/api';
import { useAuthStore } from '../store/useAuthStore';
import { useServiceModeStore } from '../store/useServiceModeStore';
import { useStoreStore } from '../store/useStoreStore';
import type { AuthUser } from '../types/storefront';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const redirect = redirectParam || '/account';
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setMode = useServiceModeStore((state) => state.setMode);
  const setAddress = useServiceModeStore((state) => state.setAddress);
  const setStore = useStoreStore((state) => state.setStore);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(redirect, { replace: true });
  }, [isAuthenticated, navigate, redirect]);

  const applySession = useCallback(async (nextUser: AuthUser, accessToken: string) => {
    setAuth(nextUser, accessToken);
    const session = await storefrontApi.me();
    setAuth(session, accessToken);
    setMode(session.serviceMode);
    setAddress(session.savedAddress || null);
    if (session.serviceMode === 'pickup' && session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
    } else {
      setStore(null);
    }
    navigate(redirect, { replace: true });
  }, [navigate, redirect, setAddress, setAuth, setMode, setStore]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const loginResult = await storefrontApi.login({ mobile, password });
      await applySession(loginResult.user, loginResult.accessToken);
      toast.success(t('authPages.welcomeBack'));
    } catch {
      toast.error(t('authPages.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('authPages.loginTitle')}
      subtitle={t('authPages.loginSubtitle')}
      backTo="/"
      disableHistoryBack={Boolean(redirectParam)}
      compactMobile
      footer={
        <p className="text-sm font-medium text-primary-900/60">
          {t('authPages.newHere')}{' '}
          <Link to="/signup" className="font-black text-primary">
            {t('authPages.createAccount')}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder={t('authPages.mobileNumber')}
          className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 font-semibold text-primary-900"
        />
        <div className="relative">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('authPages.password')}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 pr-11 font-semibold text-primary-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-900/55 transition hover:text-primary-900"
            aria-label={showPassword ? t('authPages.hidePassword') : t('authPages.showPassword')}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
        >
          {isSubmitting ? t('authPages.signingIn') : t('authPages.login')}
        </button>
        <div className="flex justify-end text-sm font-medium text-primary-900/60">
          <Link to="/signup" className="hover:text-primary">
            {t('authPages.createAccountLink')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
};

export default Login;
