import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import { storefrontApi } from '../utils/api';
import { getApiErrorMessage } from '../utils/error';
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

  const [authMode, setAuthMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [actualForgotIdentifier, setActualForgotIdentifier] = useState<{ mobile?: string; email?: string }>({});

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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('authPages.invalidCredentials')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const isEmail = forgotIdentifier.includes('@');
      const payload = isEmail ? { email: forgotIdentifier } : { mobile: forgotIdentifier };
      await storefrontApi.forgotPassword(payload);
      setActualForgotIdentifier(payload);
      setAuthMode('reset');
      toast.success(t('authPages.sendingOtp'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('authPages.forgotFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await storefrontApi.resetPassword({
        ...actualForgotIdentifier,
        otp,
        newPassword,
      });
      toast.success(t('authPages.resetSuccess') || 'Password reset successfully.');
      setAuthMode('login');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('authPages.resetFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShellProps = () => {
    switch (authMode) {
      case 'forgot':
        return {
          title: t('authPages.forgotTitle'),
          subtitle: t('authPages.forgotSubtitle'),
        };
      case 'reset':
        return {
          title: t('authPages.resetTitle'),
          subtitle: t('authPages.resetSubtitle'),
        };
      default:
        return {
          title: t('authPages.loginTitle'),
          subtitle: t('authPages.loginSubtitle'),
        };
    }
  };

  return (
    <AuthShell
      {...getShellProps()}
      backTo={authMode === 'login' ? '/' : undefined}
      disableHistoryBack={Boolean(redirectParam)}
      compactMobile
      footer={
        authMode === 'login' ? (
          <p className="text-sm font-medium text-primary-900/60">
            {t('authPages.newHere')}{' '}
            <Link to="/signup" className="font-black text-primary">
              {t('authPages.createAccount')}
            </Link>
          </p>
        ) : (
          <button
            onClick={() => setAuthMode('login')}
            className="text-sm font-black uppercase tracking-wider text-primary hover:underline"
          >
            {t('authPages.backToLogin')}
          </button>
        )
      }
    >
      {authMode === 'login' && (
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
          <div className="flex justify-end px-1">
            <button
              type="button"
              onClick={() => setAuthMode('forgot')}
              className="text-xs font-black uppercase tracking-wider text-primary/60 hover:text-primary"
            >
              {t('authPages.forgotPassword')}
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
      )}

      {authMode === 'forgot' && (
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <input
            required
            value={forgotIdentifier}
            onChange={(event) => setForgotIdentifier(event.target.value)}
            placeholder={t('authPages.registeredIdentifier')}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
          />
          <button
            disabled={isSubmitting}
            className="w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
          >
            {isSubmitting ? t('authPages.sendingOtp') : t('authPages.sendOtp')}
          </button>
        </form>
      )}

      {authMode === 'reset' && (
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <p className="px-1 text-xs font-semibold text-primary/60">
            {t('authPages.otpSentTo')} {forgotIdentifier}
          </p>
          <input
            required
            maxLength={4}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
            placeholder={t('authPages.otp')}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-primary-900"
          />
          <div className="relative">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t('authPages.newPassword')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 pr-11 font-semibold text-primary-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-900/55 transition hover:text-primary-900"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            disabled={isSubmitting}
            className="w-full rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600"
          >
            {isSubmitting ? t('authPages.resetting') : t('authPages.resetPassword')}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default Login;
