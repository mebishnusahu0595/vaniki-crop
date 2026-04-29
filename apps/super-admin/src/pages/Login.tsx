import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Home, Leaf, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { useAdminAuthStore } from '../store/useAdminAuthStore';

const loginSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState<{ mobile?: string; email?: string }>({});
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  const forgotSchema = z.object({
    identifier: z.string().trim().min(1, 'Email or Mobile is required'),
  });

  const resetSchema = z.object({
    otp: z.string().length(4, 'OTP must be 4 digits'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  });

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors, isSubmitting: isForgotSubmitting },
  } = useForm<{ identifier: string }>({
    resolver: zodResolver(forgotSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    setError: setResetError,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting },
  } = useForm<{ otp: string; newPassword: string }>({
    resolver: zodResolver(resetSchema),
  });

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    setError: setLoginError,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: '', password: '' },
  });

  const handleHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = 'https://vanikicrop.com';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(82,183,136,0.18),_transparent_25%),linear-gradient(180deg,_#f8faf9_0%,_#ffffff_100%)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-primary-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden bg-primary-900 p-10 text-white lg:block">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Leaf size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">Vaniki Crop</p>
              <h1 className="mt-1 text-3xl font-black">Super Admin Panel</h1>
            </div>
          </div>
          <div className="mt-12 space-y-5">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
              <p className="text-lg font-black">Control the full platform.</p>
              <p className="mt-2 text-sm leading-7 text-white/75">
                Manage all stores, admins, orders, payments, global campaigns, testimonials, and site settings from one console.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-primary-200" />
                <p className="text-sm font-semibold">Super-admin access only</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Every route in this app is reserved for super-admin users with global control permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleHome}
              className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-primary-900 transition hover:bg-primary-100"
            >
              <Home size={14} />
              Home
            </button>
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForgotStep('request');
                }}
                className="text-xs font-black uppercase tracking-[0.15em] text-primary-600 hover:text-primary-800"
              >
                Back to Login
              </button>
            )}
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-primary-500">
            {mode === 'forgot' ? 'Security' : 'Secure Login'}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            {mode === 'forgot' ? 'Reset super-admin password' : 'Sign in to super-admin dashboard'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {mode === 'forgot' 
              ? 'We will send a 4-digit OTP to your registered identifier.' 
              : 'Use credentials assigned to your super-admin account.'}
          </p>

          {mode === 'forgot' ? (
            <div className="mt-8">
              {forgotStep === 'request' ? (
                <form
                  onSubmit={handleForgotSubmit(async (values) => {
                    try {
                      const isEmail = values.identifier.includes('@');
                      const payload = isEmail ? { email: values.identifier } : { mobile: values.identifier };
                      await adminApi.forgotPassword(payload);
                      setForgotIdentifier(payload);
                      setForgotStep('reset');
                    } catch (error) {
                      setLoginError('root', { message: error instanceof Error ? error.message : 'Unable to send OTP.' });
                    }
                  })}
                  className="space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email or Mobile</label>
                    <input
                      {...registerForgot('identifier')}
                      placeholder="Enter registered email or mobile"
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                    />
                    {forgotErrors.identifier ? <p className="mt-2 text-sm font-semibold text-rose-600">{forgotErrors.identifier.message}</p> : null}
                  </div>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
                  >
                    {isForgotSubmitting ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleResetSubmit(async (values) => {
                    try {
                      await adminApi.resetPassword({ ...forgotIdentifier, ...values });
                      setResetSuccessMessage('Password reset successfully. Please login.');
                      setMode('login');
                      setForgotStep('request');
                    } catch (error) {
                      setResetError('root', { message: error instanceof Error ? error.message : 'Unable to reset password.' });
                    }
                  })}
                  className="space-y-5"
                >
                  <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                    OTP sent to {forgotIdentifier.email || forgotIdentifier.mobile}. Enter it below to reset your password.
                  </p>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">4-Digit OTP</label>
                    <input
                      {...registerReset('otp')}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-center text-2xl font-black tracking-[0.5em] text-slate-900 outline-none transition focus:border-primary-300"
                    />
                    {resetErrors.otp ? <p className="mt-2 text-sm font-semibold text-rose-600">{resetErrors.otp.message}</p> : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">New Password</label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        {...registerReset('newPassword')}
                        placeholder="Min 6 characters"
                        className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                      >
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {resetErrors.newPassword ? <p className="mt-2 text-sm font-semibold text-rose-600">{resetErrors.newPassword.message}</p> : null}
                  </div>

                  {resetErrors.root ? (
                    <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                      {resetErrors.root.message}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
                  >
                    {isResetSubmitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleLoginSubmit(async (values) => {
                try {
                  const loginData = await adminApi.login(values);
                  if (loginData.user?.role?.toLowerCase() !== 'superadmin') {
                    setLoginError('root', { message: 'This account does not have super-admin access.' });
                    return;
                  }
                  setSession(loginData.user, loginData.accessToken);
                  navigate('/dashboard');
                } catch (error) {
                  setLoginError('root', {
                    message: error instanceof Error ? error.message : 'Unable to sign in.',
                  });
                }
              })}
              className="mt-8 space-y-5"
            >
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
                <input
                  {...registerLogin('mobile')}
                  placeholder="9876543210"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                />
                {loginErrors.mobile ? <p className="mt-2 text-sm font-semibold text-rose-600">{loginErrors.mobile.message}</p> : null}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-black uppercase tracking-[0.15em] text-primary-600 hover:text-primary-800"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...registerLogin('password')}
                    placeholder="Enter password"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginErrors.password ? <p className="mt-2 text-sm font-semibold text-rose-600">{loginErrors.password.message}</p> : null}
              </div>

              {loginErrors.root ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  {loginErrors.root.message}
                </p>
              ) : null}

              {resetSuccessMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {resetSuccessMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoginSubmitting}
                className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {isLoginSubmitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
