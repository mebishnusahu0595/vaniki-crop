import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Leaf, LocateFixed, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { useAdminAuthStore } from '../store/useAdminAuthStore';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const dealerSignupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    email: z.string().trim().email('Enter a valid email').or(z.literal('')),
    storeName: z.string().trim().min(2, 'Store name is required'),
    storeLocation: z.string().trim().min(3, 'Store location is required'),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    gstNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN_PATTERN, 'Enter valid GSTIN (example: 27ABCDE1234F1Z5)'),
    sgstNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN_PATTERN, 'Enter valid SGSTIN (example: 27ABCDE1234F1Z5)'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.gstNumber.slice(0, 2) === data.sgstNumber.slice(0, 2), {
    path: ['sgstNumber'],
    message: 'SGST state code must match GST state code',
  });

const loginSchema = z.object({
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type DealerSignupFormValues = z.infer<typeof dealerSignupSchema>;
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupMessage, setSignupMessage] = useState('');
  const [signupImageFile, setSignupImageFile] = useState<File | null>(null);
  const [signupImagePreview, setSignupImagePreview] = useState('');

  useEffect(() => {
    return () => {
      if (signupImagePreview) {
        URL.revokeObjectURL(signupImagePreview);
      }
    };
  }, [signupImagePreview]);

  const handleSignupImageSelection = (file: File | null) => {
    if (signupImagePreview) {
      URL.revokeObjectURL(signupImagePreview);
    }

    setSignupImageFile(file);
    setSignupImagePreview(file ? URL.createObjectURL(file) : '');
  };

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    setError: setSignupError,
    setValue,
    getValues,
    formState: { errors: signupErrors, isSubmitting: isSignupSubmitting },
  } = useForm<DealerSignupFormValues>({
    resolver: zodResolver(dealerSignupSchema),
    defaultValues: {
      name: '',
      mobile: '',
      email: '',
      storeName: '',
      storeLocation: '',
      longitude: 0,
      latitude: 0,
      gstNumber: '',
      sgstNumber: '',
      password: '',
    },
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
                Register as a dealer, wait for approval, then manage order fulfilment and stock requests from one place.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-primary-200" />
                <p className="text-sm font-semibold">Store-scoped access only</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Dealer account activation is approved by super admin before dashboard login is allowed.
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">Dealer Onboarding</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Register your dealer account</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Fill dealer details to request account activation. After super-admin approval, you can sign in.
          </p>

          <div className="mt-8 grid grid-cols-2 rounded-2xl border border-primary-100 bg-primary-50 p-1">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.15em] ${
                mode === 'signup' ? 'bg-white text-primary-700 shadow' : 'text-slate-500'
              }`}
            >
              Dealer Signup
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.15em] ${
                mode === 'login' ? 'bg-white text-primary-700 shadow' : 'text-slate-500'
              }`}
            >
              Dealer Login
            </button>
          </div>

          {mode === 'signup' ? (
            <form
              onSubmit={handleSignupSubmit(async (values) => {
                try {
                  setSignupMessage('');
                  if (!signupImageFile) {
                    setSignupError('root', { message: 'Dealer profile photo is required.' });
                    return;
                  }

                  const payload = new FormData();
                  payload.append('name', values.name);
                  payload.append('mobile', values.mobile);
                  if (values.email.trim()) payload.append('email', values.email.trim());
                  payload.append('storeName', values.storeName);
                  payload.append('storeLocation', values.storeLocation);
                  payload.append('longitude', String(values.longitude));
                  payload.append('latitude', String(values.latitude));
                  payload.append('gstNumber', values.gstNumber);
                  payload.append('sgstNumber', values.sgstNumber);
                  payload.append('password', values.password);
                  payload.append('profileImage', signupImageFile);

                  await adminApi.dealerSignup(payload);
                  setSignupMessage('Signup submitted. Super admin approval ke baad login available hoga.');
                } catch (error) {
                  setSignupError('root', {
                    message: error instanceof Error ? error.message : 'Unable to submit dealer signup.',
                  });
                }
              })}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Name</label>
                  <input {...registerSignup('name')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" placeholder="Dealer name" />
                  {signupErrors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.name.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
                  <input {...registerSignup('mobile')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" placeholder="9876543210" />
                  {signupErrors.mobile ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.mobile.message}</p> : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email</label>
                  <input {...registerSignup('email')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" placeholder="dealer@example.com" />
                  {signupErrors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.email.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Name</label>
                  <input {...registerSignup('storeName')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" placeholder="My Agro Store" />
                  {signupErrors.storeName ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.storeName.message}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Location</label>
                <input {...registerSignup('storeLocation')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" placeholder="Area / Landmark / Address" />
                {signupErrors.storeLocation ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.storeLocation.message}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    {...registerSignup('longitude', { valueAsNumber: true })}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                    placeholder="77.5946"
                  />
                  {signupErrors.longitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.longitude.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    {...registerSignup('latitude', { valueAsNumber: true })}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
                    placeholder="12.9716"
                  />
                  {signupErrors.latitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.latitude.message}</p> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setSignupError('root', { message: 'Geolocation is not supported on this device/browser.' });
                    return;
                  }

                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const longitude = Number(position.coords.longitude.toFixed(6));
                      const latitude = Number(position.coords.latitude.toFixed(6));
                      setValue('longitude', longitude, { shouldValidate: true });
                      setValue('latitude', latitude, { shouldValidate: true });

                      const currentStoreLocation = getValues('storeLocation');
                      if (!currentStoreLocation) {
                        setValue('storeLocation', `Detected at ${latitude}, ${longitude}`, { shouldValidate: true });
                      }
                    },
                    () => {
                      setSignupError('root', { message: 'Unable to detect location. Please allow location access.' });
                    },
                    { enableHighAccuracy: true, timeout: 10000 },
                  );
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-primary-700"
              >
                <LocateFixed size={14} />
                Detect Location
              </button>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">GST No.</label>
                  <input
                    {...registerSignup('gstNumber')}
                    maxLength={15}
                    autoCapitalize="characters"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase"
                    placeholder="27ABCDE1234F1Z5"
                  />
                  {signupErrors.gstNumber ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.gstNumber.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">SGST No.</label>
                  <input
                    {...registerSignup('sgstNumber')}
                    maxLength={15}
                    autoCapitalize="characters"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase"
                    placeholder="27ABCDE1234F1Z5"
                  />
                  {signupErrors.sgstNumber ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.sgstNumber.message}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dealer Photo</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleSignupImageSelection(event.target.files?.[0] || null)}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm"
                />
                {signupImagePreview ? (
                  <img src={signupImagePreview} alt="Dealer preview" className="mt-3 h-24 w-24 rounded-2xl object-cover" />
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    {...registerSignup('password')}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 pr-12"
                    placeholder="Create password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {signupErrors.password ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.password.message}</p> : null}
              </div>

              {signupErrors.root ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  {signupErrors.root.message}
                </p>
              ) : null}

              {signupMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {signupMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSignupSubmitting}
                className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {isSignupSubmitting ? 'Submitting...' : 'Submit Signup'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleLoginSubmit(async (values) => {
                try {
                  const loginData = await adminApi.login(values);
                  if (loginData.user.role !== 'storeAdmin') {
                    setLoginError('root', { message: 'This account does not have dealer access.' });
                    return;
                  }
                  setSession(loginData.user, loginData.accessToken);
                  navigate('/orders');
                } catch (error) {
                  setLoginError('root', {
                    message: error instanceof Error ? error.message : 'Unable to sign in.',
                  });
                }
              })}
              className="mt-6 space-y-5"
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
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    {...registerLogin('password')}
                    placeholder="Enter password"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginErrors.password ? <p className="mt-2 text-sm font-semibold text-rose-600">{loginErrors.password.message}</p> : null}
              </div>

              {loginErrors.root ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  {loginErrors.root.message}
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
