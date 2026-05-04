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
import { auth } from '../config/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

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

  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const setupRecaptcha = (elementId: string) => {
    if (recaptchaVerifier) return recaptchaVerifier;
    try {
      const verifier = new RecaptchaVerifier(auth, elementId, {
        size: 'invisible',
        callback: () => {},
      });
      setRecaptchaVerifier(verifier);
      return verifier;
    } catch (error) {
      console.error('Recaptcha init failed:', error);
      return null;
    }
  };

  const [forgotIdentifier, setForgotIdentifier] = useState('');

  const [newPassword, setNewPassword] = useState('');


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
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            if (loginMethod === 'password') {
              handleSubmit(e);
            } else {
              if (!confirmationResult) {
                toast.error('Please send OTP first');
                return;
              }
              setIsSubmitting(true);
              try {
                const userCredential = await confirmationResult.confirm(otpCode);
                const idToken = await userCredential.user.getIdToken();
                const loginResult = await storefrontApi.firebaseLogin(idToken);
                await applySession(loginResult.user, loginResult.accessToken);
                toast.success(t('authPages.welcomeBack'));
              } catch (error) {
                toast.error('Invalid OTP or session expired.');
              } finally {
                setIsSubmitting(false);
              }
            }
          }} 
          className="space-y-3"
        >
          <div id="recaptcha-container"></div>
          <div className="flex gap-2">
            <input
              required
              value={mobile}
              onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={t('authPages.mobileNumber')}
              disabled={!!confirmationResult}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 font-semibold text-primary-900 disabled:opacity-50"
            />
            {loginMethod === 'otp' && !confirmationResult && (
              <button
                type="button"
                disabled={isSendingOtp}
                onClick={async () => {
                  if (!/^[6-9]\d{9}$/.test(mobile)) {
                    toast.error('Enter a valid 10-digit mobile number');
                    return;
                  }
                  setIsSendingOtp(true);
                  try {
                    const verifier = setupRecaptcha('recaptcha-container');
                    if (!verifier) throw new Error('Failed to initialize reCAPTCHA');
                    const result = await signInWithPhoneNumber(auth, `+91${mobile}`, verifier);
                    setConfirmationResult(result);
                    toast.success('OTP sent successfully');
                  } catch (error) {
                    toast.error('Failed to send OTP');
                  } finally {
                    setIsSendingOtp(false);
                  }
                }}
                className="whitespace-nowrap rounded-2xl bg-primary-100 px-4 text-xs font-black uppercase tracking-wider text-primary"
              >
                {isSendingOtp ? 'Sending...' : 'Send OTP'}
              </button>
            )}
          </div>

          {loginMethod === 'password' ? (
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
          ) : (
            confirmationResult && (
              <input
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-Digit OTP"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-center text-2xl font-black tracking-[0.5em] text-primary-900"
              />
            )
          )}

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
                setConfirmationResult(null);
                setOtpCode('');
              }}
              className="text-xs font-black uppercase tracking-wider text-primary/60 hover:text-primary"
            >
              {loginMethod === 'password' ? 'OTP Login' : 'Password Login'}
            </button>
            {loginMethod === 'password' && (
              <button
                type="button"
                onClick={() => setAuthMode('forgot')}
                className="text-xs font-black uppercase tracking-wider text-primary/60 hover:text-primary"
              >
                {t('authPages.forgotPassword')}
              </button>
            )}
          </div>
          <button
            disabled={isSubmitting || (loginMethod === 'otp' && !confirmationResult)}
            className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-primary-600 disabled:opacity-50"
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
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[6-9]\d{9}$/.test(forgotIdentifier)) {
              toast.error('Enter a valid 10-digit mobile number');
              return;
            }
            setIsSubmitting(true);
            try {
              const verifier = setupRecaptcha('forgot-recaptcha-container');
              if (!verifier) throw new Error('Failed to initialize reCAPTCHA');
              const result = await signInWithPhoneNumber(auth, `+91${forgotIdentifier}`, verifier);
              setConfirmationResult(result);
              setAuthMode('reset');
              toast.success('OTP sent successfully');
            } catch (error) {
              toast.error('Failed to send OTP');
            } finally {
              setIsSubmitting(false);
            }
          }} 
          className="space-y-4"
        >
          <div id="forgot-recaptcha-container"></div>
          <input
            required
            value={forgotIdentifier}
            onChange={(event) => setForgotIdentifier(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder={t('authPages.mobileNumber')}
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
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            if (!confirmationResult) {
              toast.error('Session expired. Please request OTP again.');
              return;
            }
            setIsSubmitting(true);
            try {
              const userCredential = await confirmationResult.confirm(otpCode);
              const idToken = await userCredential.user.getIdToken();
              await storefrontApi.firebaseResetPassword({ idToken, newPassword });
              toast.success(t('authPages.resetSuccess') || 'Password reset successfully.');
              setAuthMode('login');
              setConfirmationResult(null);
              setOtpCode('');
            } catch (error) {
              toast.error(t('authPages.resetFailed'));
            } finally {
              setIsSubmitting(false);
            }
          }} 
          className="space-y-4"
        >
          <p className="px-1 text-xs font-semibold text-primary/60">
            {t('authPages.otpSentTo')} {forgotIdentifier}
          </p>
          <input
            required
            maxLength={6}
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-Digit OTP"
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
