import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Leaf, ShieldCheck } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: '', password: '' },
  });

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (typeof document !== 'undefined' && document.referrer) {
      window.location.href = document.referrer;
      return;
    }
    navigate('/', { replace: true });
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
              <h1 className="mt-1 text-3xl font-black">Store Admin Panel</h1>
            </div>
          </div>
          <div className="mt-12 space-y-5">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
              <p className="text-lg font-black">Own your store operations.</p>
              <p className="mt-2 text-sm leading-7 text-white/75">
                Track today&apos;s revenue, approve reviews, manage products, banners, coupons, and customer orders from one panel.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-primary-200" />
                <p className="text-sm font-semibold">Store-scoped access only</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Every screen is restricted to the current store admin’s inventory, banners, reviews, payments, and customers.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-primary-900 transition hover:bg-primary-100"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">Secure Login</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Sign in to your store dashboard</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Use the same mobile number and password assigned to your store-admin account.
          </p>

          <form
            onSubmit={handleSubmit(async (values) => {
              try {
                const loginData = await adminApi.login(values);
                if (loginData.user.role !== 'storeAdmin') {
                  setError('root', { message: 'This account does not have store-admin access.' });
                  return;
                }
                setSession(loginData.user, loginData.accessToken);
                navigate('/');
              } catch (error) {
                setError('root', {
                  message: error instanceof Error ? error.message : 'Unable to sign in.',
                });
              }
            })}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
              <input
                {...register('mobile')}
                placeholder="9876543210"
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
              />
              {errors.mobile ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.mobile.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
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
              {errors.password ? <p className="mt-2 text-sm font-semibold text-rose-600">{errors.password.message}</p> : null}
            </div>

            {errors.root ? (
              <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                {errors.root.message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
            >
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
