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

  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [loginVerificationId, setLoginVerificationId] = useState<string | null>(null);
  const [forgotVerificationId, setForgotVerificationId] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

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

  const handleSendLoginOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setIsSendingOtp(true);
    try {
      const result = await storefrontApi.sendLoginOtp({ mobile });
      setLoginVerificationId(result.verificationId);
      setOtpSent(true);
      toast.success('OTP sent successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send OTP'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleLoginWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginVerificationId) {
      toast.error('Please send OTP first');
      return;
    }
    if (otpCode.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await storefrontApi.loginWithOtp({
        mobile,
        otp: otpCode,
        verificationId: loginVerificationId,
      });
      await applySession(result.user, result.accessToken);
      toast.success(t('authPages.welcomeBack'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Invalid OTP or session expired.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(forgotIdentifier)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await storefrontApi.forgotPassword({ mobile: forgotIdentifier });
      if (result.verificationId) {
        setForgotVerificationId(result.verificationId);
        setAuthMode('reset');
        setOtpCode('');
        toast.success('OTP sent successfully');
      } else {
        toast.error('Failed to initiate password reset.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send OTP'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotVerificationId) {
      toast.error('Session expired. Please request OTP again.');
      return;
    }
    if (otpCode.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    setIsSubmitting(true);
    try {
      await storefrontApi.resetPassword({
        mobile: forgotIdentifier,
        otp: otpCode,
        newPassword,
        verificationId: forgotVerificationId,
      });
      toast.success(t('authPages.resetSuccess') || 'Password reset successfully.');
      setAuthMode('login');
      setForgotVerificationId(null);
      setOtpCode('');
      setNewPassword('');
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
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode('forgot');
                setForgotVerificationId(null);
                setOtpCode('');
              }}
              className="text-sm font-medium text-primary-900/60 transition hover:text-primary"
            >
              {t('authPages.forgotPasswordLink')}
            </button>
            <p className="text-sm font-medium text-primary-900/60">
              {t('authPages.notRegistered')}{' '}
              <Link to="/signup" className="font-black text-primary hover:underline">
                {t('authPages.signupLink')}
              </Link>
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setForgotVerificationId(null);
              setOtpCode('');
            }}
            className="text-sm font-black uppercase tracking-wider text-primary hover:underline"
          >
            {t('authPages.backToLogin')}
          </button>
        )
      }
    >
      {authMode === 'login' && (
        <form 
          onSubmit={loginMethod === 'password' ? handleSubmit : handleLoginWithOtp} 
          className="space-y-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60">
              {t('authPages.mobileNumber')}
            </label>
            <div className="flex gap-2">
              <input
                required
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                disabled={otpSent}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 font-semibold text-primary-900 disabled:opacity-50"
              />
              {loginMethod === 'otp' && !otpSent && (
                <button
                  type="button"
                  disabled={isSendingOtp}
                  onClick={handleSendLoginOtp}
                  className="whitespace-nowrap rounded-2xl bg-primary-100 px-4 text-xs font-black uppercase tracking-wider text-primary"
                >
                  {isSendingOtp ? 'Sending...' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {loginMethod === 'password' ? (
            <div className="flex flex-col gap-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60">
                {t('authPages.password')}
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
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
            </div>
          ) : (
            otpSent && (
              <div className="flex flex-col gap-1.5 animate-fadeIn">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60 text-center">
                  6-Digit OTP
                </label>
                <input
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-center text-2xl font-black tracking-[0.5em] text-primary-900"
                />
              </div>
            )
          )}

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
                setLoginVerificationId(null);
                setOtpSent(false);
                setOtpCode('');
              }}
              className="text-xs font-black uppercase tracking-wider text-primary/60 hover:text-primary"
            >
              {loginMethod === 'password' ? 'OTP Login' : 'Password Login'}
            </button>
          </div>
          <button
            disabled={isSubmitting || (loginMethod === 'otp' && !otpSent)}
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
          onSubmit={handleForgotSendOtp} 
          className="space-y-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60">
              {t('authPages.mobileNumber')}
            </label>
            <input
              required
              value={forgotIdentifier}
              onChange={(event) => setForgotIdentifier(event.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-primary-900"
            />
          </div>
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
          onSubmit={handleResetPassword} 
          className="space-y-4"
        >
          <p className="px-1 text-xs font-semibold text-primary/60">
            {t('authPages.otpSentTo')} {forgotIdentifier}
          </p>
          <div className="flex flex-col gap-1.5 animate-fadeIn">
            <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60 text-center">
              6-Digit OTP
            </label>
            <input
              required
              maxLength={6}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-primary-900"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-900/60">
              {t('authPages.newPassword')}
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
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
