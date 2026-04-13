import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AuthShell from '../components/common/AuthShell';
import GoogleSignInButton from '../components/common/GoogleSignInButton';
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
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [googleMobile, setGoogleMobile] = useState('');
  const [googlePrefill, setGooglePrefill] = useState<{ name?: string; email?: string }>({});

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (isAuthenticated) navigate(redirect, { replace: true });
  }, [isAuthenticated, navigate, redirect]);

  const applySession = useCallback(async (nextUser: AuthUser, accessToken: string) => {
    setAuth(nextUser, accessToken);
    const session = await storefrontApi.me();
    setAuth(session, accessToken);
    setMode(session.serviceMode);
    setAddress(session.savedAddress || null);
    if (session.selectedStore && typeof session.selectedStore !== 'string') {
      setStore(session.selectedStore);
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

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setIsGoogleSubmitting(true);
    try {
      const response = await storefrontApi.googleAuth({ idToken });

      if (response.requiresMobile) {
        setPendingGoogleToken(idToken);
        setGooglePrefill({
          name: response.prefillName,
          email: response.prefillEmail,
        });
        toast('Google account verified. Please add mobile number to continue.');
        return;
      }

      if (!response.user || !response.accessToken) {
        throw new Error('Google login failed. Please try again.');
      }

      await applySession(response.user, response.accessToken);
      toast.success('Logged in with Google.');
      setPendingGoogleToken('');
      setGoogleMobile('');
      setGooglePrefill({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google login failed.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  }, [applySession]);

  const handleGoogleMobileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!pendingGoogleToken) {
      toast.error('Google session expired. Please try again.');
      return;
    }

    const normalizedMobile = googleMobile.trim();
    if (!normalizedMobile) {
      toast.error('Please enter your mobile number.');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      const response = await storefrontApi.googleAuth({
        idToken: pendingGoogleToken,
        mobile: normalizedMobile,
      });

      if (response.requiresMobile || !response.user || !response.accessToken) {
        throw new Error('Please enter a valid mobile number.');
      }

      await applySession(response.user, response.accessToken);
      toast.success('Account created with Google.');
      setPendingGoogleToken('');
      setGoogleMobile('');
      setGooglePrefill({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to continue with Google login.');
    } finally {
      setIsGoogleSubmitting(false);
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

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-primary-100" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-500">or</span>
        <div className="h-px flex-1 bg-primary-100" />
      </div>

      <GoogleSignInButton
        clientId={googleClientId}
        text="signin_with"
        disabled={isGoogleSubmitting}
        onCredential={handleGoogleCredential}
      />

      {pendingGoogleToken ? (
        <form onSubmit={handleGoogleMobileSubmit} className="mt-4 space-y-3 rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <p className="text-sm font-semibold text-primary-900">
            Complete Google signup for {googlePrefill.name || googlePrefill.email || 'your account'}
          </p>
          <input
            required
            value={googleMobile}
            onChange={(event) => setGoogleMobile(event.target.value)}
            placeholder="Mobile Number"
            className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-2.5 font-semibold text-primary-900"
          />
          <button
            disabled={isGoogleSubmitting}
            className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white"
          >
            {isGoogleSubmitting ? 'Please wait...' : 'Continue with Google'}
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
};

export default Login;
