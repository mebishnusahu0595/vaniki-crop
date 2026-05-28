import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Home, Leaf, LocateFixed, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { useAdminAuthStore } from '../store/useAdminAuthStore';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MAX_SIGNUP_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SIGNUP_IMAGE_MAX_DIMENSION = 1600;
const SIGNUP_IMAGE_MIN_QUALITY = 0.6;

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read selected image.'));
    };
    reader.onerror = () => reject(new Error('Unable to read selected image.'));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to process selected image.'));
    image.src = src;
  });
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to compress selected image.'));
          return;
        }

        const safeName = name.replace(/\.[^.]+$/, '') || 'dealer-photo';
        resolve(new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality,
    );
  });
}

async function prepareSignupImage(file: File): Promise<File> {
  if (file.size <= MAX_SIGNUP_IMAGE_SIZE_BYTES) {
    return file;
  }

  const imageDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(imageDataUrl);
  const scale = Math.min(1, SIGNUP_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare image on this device.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = 0.85;
  let compressedFile = await canvasToJpegFile(canvas, file.name, quality);

  while (compressedFile.size > MAX_SIGNUP_IMAGE_SIZE_BYTES && quality > SIGNUP_IMAGE_MIN_QUALITY) {
    quality -= 0.1;
    compressedFile = await canvasToJpegFile(canvas, file.name, quality);
  }

  if (compressedFile.size > MAX_SIGNUP_IMAGE_SIZE_BYTES) {
    throw new Error('Selected photo is too large. Please choose an image under 5MB.');
  }

  return compressedFile;
}

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
  const [searchParams] = useSearchParams();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const requestedMode = (searchParams.get('mode') === 'login' ? 'login' : 'signup') as 'signup' | 'login';
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot' | 'reset'>(requestedMode);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupMessage, setSignupMessage] = useState('');
  const [signupImageFile, setSignupImageFile] = useState<File | null>(null);
  const [signupImagePreview, setSignupImagePreview] = useState('');

  // Signup Mobile Verification States (OTP temporarily disabled)
  // const [isOtpSent, setIsOtpSent] = useState(false);
  const isMobileVerified = true; // OTP disabled: always treat mobile as verified
  // const [isMobileVerified, setIsMobileVerified] = useState(false);
  // const [otpCodeSignup, setOtpCodeSignup] = useState('');
  // const [isSendingOtp, setIsSendingOtp] = useState(false);
  // const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Forgot / Reset Password States
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotVerificationId, setForgotVerificationId] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

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

  useEffect(() => {
    setMode(requestedMode);
  }, [requestedMode]);

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
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleHome}
              className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-primary-900 transition hover:bg-primary-100"
            >
              <Home size={14} />
              Home
            </button>
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                }}
                className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-4 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-sm transition hover:bg-primary-600"
              >
                Back to Login
              </button>
            )}
          </div>
          
          <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-primary-500">
            {mode === 'signup' ? 'Dealer Onboarding' : mode === 'forgot' ? 'Forgot Password' : mode === 'reset' ? 'Reset Password' : 'Login'}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            {mode === 'signup' ? 'Register your dealer account' : mode === 'forgot' ? 'Recover your account' : mode === 'reset' ? 'Create new password' : 'Welcome back'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {mode === 'signup' ? 'Fill dealer details to request account activation.' : mode === 'forgot' ? 'Request password reset OTP.' : mode === 'reset' ? 'Verify OTP and set your new password.' : 'Sign in to manage your store operations.'}
          </p>

          {(mode === 'signup' || mode === 'login') && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-primary-700">
                {mode === 'signup' ? 'Dealer Signup Active' : 'Dealer Login Active'}
              </p>
              <button
                type="button"
                onClick={() => setMode((current) => (current === 'signup' ? 'login' : 'signup'))}
                className="rounded-full bg-primary-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-sm transition hover:bg-primary-700 hover:shadow"
              >
                {mode === 'signup' ? 'Already approved? Switch to login' : 'Need an account? Switch to signup'}
              </button>
            </div>
          )}

          {mode === 'signup' ? (
            <form
              onSubmit={handleSignupSubmit(async (values) => {
                try {
                  setSignupMessage('');
                  // OTP check disabled temporarily
                  // if (!isMobileVerified) {
                  //   setSignupError('root', { message: 'Please verify your mobile number first.' });
                  //   return;
                  // }
                  if (!signupImageFile) {
                    setSignupError('root', { message: 'Dealer profile photo is required.' });
                    return;
                  }

                  const uploadImage = await prepareSignupImage(signupImageFile);

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
                  payload.append('profileImage', uploadImage);

                  await adminApi.dealerSignup(payload);
                  setSignupMessage('Signup submitted. Super admin will approve.');
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
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
                  <div className="flex gap-2">
                    <input
                      {...registerSignup('mobile')}
                      disabled={isSignupSubmitting}
                      inputMode="numeric"
                      maxLength={10}
                      onInput={(event) => {
                        event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                      }}
                      className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 font-semibold text-slate-900 disabled:opacity-60"
                      placeholder="9876543210"
                    />
                    {/* OTP send button temporarily disabled
                    {!isMobileVerified && (
                      <button
                        type="button"
                        disabled={isSendingOtp || getValues('mobile')?.length !== 10}
                        onClick={async () => {
                          const mobileVal = getValues('mobile');
                          if (!/^[6-9]\d{9}$/.test(mobileVal)) {
                            setSignupError('mobile', { message: 'Enter a valid 10-digit mobile number' });
                            return;
                          }
                          setSignupError('mobile', { message: '' });
                          setIsSendingOtp(true);
                          try {
                            await adminApi.sendOtp({ mobile: mobileVal });
                            setIsOtpSent(true);
                            setSignupMessage('OTP sent successfully');
                          } catch (error) {
                            setSignupError('root', {
                              message: error instanceof Error ? error.message : 'Failed to send OTP',
                            });
                          } finally {
                            setIsSendingOtp(false);
                          }
                        }}
                        className="whitespace-nowrap rounded-2xl bg-primary-500 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-600 disabled:opacity-50"
                      >
                        {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend' : 'Send OTP'}
                      </button>
                    )}
                    */}
                  </div>
                  {signupErrors.mobile ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.mobile.message}</p> : null}
                  {isMobileVerified && (
                    <span className="mt-1 block text-xs font-bold text-emerald-600">✓ Mobile Verified</span>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Name</label>
                  <input
                    {...registerSignup('name')}
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
                    placeholder="Dealer name"
                  />
                  {signupErrors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.name.message}</p> : null}
                </div>
              </div>

              {/* OTP input block temporarily disabled
              {isOtpSent && !isMobileVerified && (
                <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4 space-y-3">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Enter 4-Digit OTP</label>
                  <div className="flex gap-2">
                    <input
                      required
                      maxLength={4}
                      value={otpCodeSignup}
                      onChange={(event) => setOtpCodeSignup(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0000"
                      className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3 font-semibold text-slate-900 text-center tracking-[0.5em]"
                    />
                    <button
                      type="button"
                      disabled={isVerifyingOtp || otpCodeSignup.length !== 4}
                      onClick={async () => {
                        const mobileVal = getValues('mobile');
                        setIsVerifyingOtp(true);
                        try {
                          await adminApi.verifyOtp({ mobile: mobileVal, otp: otpCodeSignup });
                          setIsMobileVerified(true);
                          setSignupError('root', { message: '' });
                          setSignupMessage('Mobile number verified successfully');
                        } catch (error) {
                          setSignupError('root', {
                            message: error instanceof Error ? error.message : 'Invalid OTP',
                          });
                        } finally {
                          setIsVerifyingOtp(false);
                        }
                      }}
                      className="whitespace-nowrap rounded-2xl bg-primary-500 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-600 disabled:opacity-50"
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                </div>
              )}
              */}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email</label>
                  <input
                    {...registerSignup('email')}
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
                    placeholder="dealer@example.com"
                  />
                  {signupErrors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.email.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Name</label>
                  <input
                    {...registerSignup('storeName')}
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
                    placeholder="My Agro Store"
                  />
                  {signupErrors.storeName ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.storeName.message}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Store Location</label>
                <input
                  {...registerSignup('storeLocation')}
                  disabled={!isMobileVerified}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
                  placeholder="Area / Landmark / Address"
                />
                {signupErrors.storeLocation ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.storeLocation.message}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    {...registerSignup('longitude', { valueAsNumber: true })}
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
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
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 disabled:opacity-50"
                    placeholder="12.9716"
                  />
                  {signupErrors.latitude ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.latitude.message}</p> : null}
                </div>
              </div>

              <button
                type="button"
                disabled={!isMobileVerified}
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
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-primary-700 disabled:opacity-50"
              >
                <LocateFixed size={14} />
                Detect Location
              </button>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">GST No.</label>
                  <input
                    {...registerSignup('gstNumber')}
                    disabled={!isMobileVerified}
                    maxLength={15}
                    autoCapitalize="characters"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase disabled:opacity-50"
                    placeholder="27ABCDE1234F1Z5"
                  />
                  {signupErrors.gstNumber ? <p className="mt-1 text-xs font-semibold text-rose-600">{signupErrors.gstNumber.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">SGST No.</label>
                  <input
                    {...registerSignup('sgstNumber')}
                    disabled={!isMobileVerified}
                    maxLength={15}
                    autoCapitalize="characters"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 uppercase disabled:opacity-50"
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
                  disabled={!isMobileVerified}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    handleSignupImageSelection(file);

                    if (file && file.size > MAX_SIGNUP_IMAGE_SIZE_BYTES) {
                      setSignupError('root', {
                        message: 'Large phone photos will be compressed automatically before upload.',
                      });
                    }
                  }}
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm disabled:opacity-50"
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
                    disabled={!isMobileVerified}
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 pr-12 disabled:opacity-50"
                    placeholder="Create password"
                  />
                  <button
                    type="button"
                    disabled={!isMobileVerified}
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 disabled:opacity-50"
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
                disabled={isSignupSubmitting || !isMobileVerified}
                className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {isSignupSubmitting ? 'Submitting...' : 'Submit Signup'}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!/^[6-9]\d{9}$/.test(forgotIdentifier)) {
                  setForgotError('Enter a valid 10-digit mobile number');
                  return;
                }
                setForgotError('');
                setIsForgotSubmitting(true);
                try {
                  const result = await adminApi.forgotPassword({ mobile: forgotIdentifier });
                  if (result.success) {
                    // Let's check how the verificationId is retrieved. The custom verificationId is optional or saved.
                    // If backend returns verificationId, use it. In MSG91/MessageCentral, verificationId or sessionId is returned.
                    // In api.ts forgotPassword doesn't define output types but returns response.data which has { success, message, verificationId }
                    const verificationId = (result as any).verificationId || 'custom-otp';
                    setForgotVerificationId(verificationId);
                    setMode('reset');
                    setOtpCode('');
                    setForgotMessage('OTP sent successfully');
                  } else {
                    setForgotError(result.message || 'Failed to initiate password reset.');
                  }
                } catch (error) {
                  setForgotError(error instanceof Error ? error.message : 'Failed to send OTP');
                } finally {
                  setIsForgotSubmitting(false);
                }
              }}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mobile Number</label>
                <input
                  required
                  value={forgotIdentifier}
                  onChange={(event) => setForgotIdentifier(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                />
              </div>

              {forgotError ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 animate-fadeIn">
                  {forgotError}
                </p>
              ) : null}

              {forgotMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 animate-fadeIn">
                  {forgotMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isForgotSubmitting}
                className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {isForgotSubmitting ? 'Sending OTP...' : 'Send OTP'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-600 transition"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : mode === 'reset' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (otpCode.length < 4) {
                  setForgotError('Please enter a valid OTP');
                  return;
                }
                if (newPassword.length < 6) {
                  setForgotError('Password must be at least 6 characters');
                  return;
                }
                setForgotError('');
                setIsForgotSubmitting(true);
                try {
                  await adminApi.resetPassword({
                    mobile: forgotIdentifier,
                    otp: otpCode,
                    newPassword,
                    verificationId: forgotVerificationId || undefined,
                  });
                  setForgotMessage('Password reset successfully. Please login.');
                  setMode('login');
                  setForgotVerificationId(null);
                  setOtpCode('');
                  setNewPassword('');
                } catch (error) {
                  setForgotError(error instanceof Error ? error.message : 'Reset failed');
                } finally {
                  setIsForgotSubmitting(false);
                }
              }}
              className="mt-6 space-y-5"
            >
              <p className="text-xs font-semibold text-slate-500 text-center">
                OTP sent to {forgotIdentifier}
              </p>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500 text-center">Enter 4-Digit OTP</label>
                <input
                  required
                  maxLength={4}
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-center text-xl font-bold tracking-[0.5em] text-slate-900 outline-none transition focus:border-primary-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">New Password</label>
                <div className="relative">
                  <input
                    required
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {forgotError ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 animate-fadeIn">
                  {forgotError}
                </p>
              ) : null}

              {forgotMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 animate-fadeIn">
                  {forgotMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isForgotSubmitting}
                className="w-full rounded-2xl bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {isForgotSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-600 transition"
                >
                  Resend OTP
                </button>
              </div>
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
                  inputMode="numeric"
                  maxLength={10}
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                  }}
                  placeholder="9876543210"
                  className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-primary-300"
                />
                {loginErrors.mobile ? <p className="mt-2 text-sm font-semibold text-rose-600">{loginErrors.mobile.message}</p> : null}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setForgotError('');
                      setForgotMessage('');
                      setForgotVerificationId(null);
                    }}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 transition"
                  >
                    Forgot Password?
                  </button>
                </div>
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

              {forgotMessage && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 animate-fadeIn">
                  {forgotMessage}
                </p>
              )}

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
