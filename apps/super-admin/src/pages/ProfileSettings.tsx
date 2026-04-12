import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { API_BASE_URL } from '../config/api';
import { PageHeader } from '../components/PageHeader';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  street: z.string().trim().max(140, 'Street cannot exceed 140 characters'),
  city: z.string().trim().max(80, 'City cannot exceed 80 characters'),
  state: z.string().trim().max(80, 'State cannot exceed 80 characters'),
  pincode: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{6}$/.test(value), 'Pincode must be 6 digits'),
  landmark: z.string().trim().max(120, 'Landmark cannot exceed 120 characters'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().trim().min(6, 'Current password must be at least 6 characters'),
    newPassword: z.string().trim().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().trim().min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'New password and confirm password must match',
    path: ['confirmPassword'],
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

function getApiPathPrefix(): string {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    try {
      const path = new URL(API_BASE_URL).pathname.replace(/\/+$/, '');
      return path || '/api';
    } catch {
      return '/api';
    }
  }

  const trimmed = API_BASE_URL.trim();
  if (!trimmed) return '/api';

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '') || '/api';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function encodePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

function normalizeRelativePath(value: string): string {
  const cleaned = value.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const withLeadingSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;

  if (withLeadingSlash.startsWith('/api/uploads/')) {
    return withLeadingSlash.replace(/^\/api/, '');
  }

  return withLeadingSlash;
}

function getLocalPublicIdFromRawUrl(rawUrl?: string): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const queryPublicId = parsed.searchParams.get('publicId') || parsed.searchParams.get('public_id');
      if (queryPublicId?.startsWith('local:')) {
        return queryPublicId;
      }

      const normalizedPath = normalizeRelativePath(parsed.pathname);
      if (!normalizedPath.startsWith('/uploads/')) return '';

      const relativePath = normalizedPath.replace(/^\/uploads\//, '');
      return relativePath ? `local:${relativePath}` : '';
    } catch {
      return '';
    }
  }

  const queryMatch = trimmed.match(/[?&](publicId|public_id)=([^&#]+)/i);
  if (queryMatch?.[2]) {
    try {
      const decoded = decodeURIComponent(queryMatch[2]);
      if (decoded.startsWith('local:')) {
        return decoded;
      }
    } catch {
      // Ignore malformed query encoding and continue path parsing.
    }
  }

  const pathOnly = normalizeRelativePath(trimmed.split(/[?#]/, 1)[0] || '');
  if (!pathOnly.startsWith('/uploads/')) return '';

  const relativePath = pathOnly.replace(/^\/uploads\//, '');
  return relativePath ? `local:${relativePath}` : '';
}

function createProfileImageCandidates(rawUrl?: string, publicId?: string): string[] {
  const candidates: string[] = [];

  const addCandidate = (value?: string) => {
    if (!value) return;
    const cleaned = value.trim();
    if (!cleaned || candidates.includes(cleaned)) return;
    candidates.push(cleaned);
  };

  const normalizedPublicId = publicId?.startsWith('local:') ? publicId : getLocalPublicIdFromRawUrl(rawUrl);
  if (normalizedPublicId) {
    addCandidate(`${getApiPathPrefix()}/media?publicId=${encodeURIComponent(normalizedPublicId)}`);
  }

  if (!rawUrl) return candidates;
  const trimmed = rawUrl.trim();
  if (!trimmed) return candidates;

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    addCandidate(trimmed);
    return candidates;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = encodePathname(parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/'));
      addCandidate(parsed.toString());
    } catch {
      addCandidate(trimmed);
    }

    return candidates;
  }

  addCandidate(normalizeRelativePath(trimmed));
  return candidates;
}

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const user = useAdminAuthStore((state) => state.user);
  const setUser = useAdminAuthStore((state) => state.setUser);
  const clearSession = useAdminAuthStore((state) => state.clearSession);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [profileImageIndex, setProfileImageIndex] = useState(0);

  const profileImageCandidates = useMemo(
    () => createProfileImageCandidates(user?.profileImage?.url, user?.profileImage?.publicId),
    [user?.profileImage?.url, user?.profileImage?.publicId],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      mobile: user?.mobile || '',
      email: user?.email || '',
      street: user?.savedAddress?.street || '',
      city: user?.savedAddress?.city || '',
      state: user?.savedAddress?.state || '',
      pincode: user?.savedAddress?.pincode || '',
      landmark: user?.savedAddress?.landmark || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    reset({
      name: user?.name || '',
      mobile: user?.mobile || '',
      email: user?.email || '',
      street: user?.savedAddress?.street || '',
      city: user?.savedAddress?.city || '',
      state: user?.savedAddress?.state || '',
      pincode: user?.savedAddress?.pincode || '',
      landmark: user?.savedAddress?.landmark || '',
    });
  }, [
    reset,
    user?.email,
    user?.mobile,
    user?.name,
    user?.savedAddress?.street,
    user?.savedAddress?.city,
    user?.savedAddress?.state,
    user?.savedAddress?.pincode,
    user?.savedAddress?.landmark,
  ]);

  useEffect(() => {
    setProfileImageIndex(0);
  }, [profileImageCandidates]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: ProfileFormValues) => {
      const hasAddress = [payload.street, payload.city, payload.state, payload.pincode, payload.landmark]
        .some((value) => value.trim().length > 0);

      return adminApi.updateMe({
        name: payload.name,
        mobile: payload.mobile,
        email: payload.email,
        savedAddress: hasAddress
          ? {
              street: payload.street || undefined,
              city: payload.city || undefined,
              state: payload.state || undefined,
              pincode: payload.pincode || undefined,
              landmark: payload.landmark || undefined,
            }
          : undefined,
      });
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setError('');
      setMessage('Settings updated successfully.');
    },
    onError: (mutationError) => {
      setMessage('');
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update settings.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: PasswordFormValues) =>
      adminApi.changePassword({
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      }),
    onSuccess: () => {
      setPasswordError('');
      setPasswordMessage('Password changed successfully. Please log in again.');
      resetPassword();
      clearSession();
      navigate('/superadmin', { replace: true });
    },
    onError: (mutationError) => {
      setPasswordMessage('');
      setPasswordError(mutationError instanceof Error ? mutationError.message : 'Unable to change password.');
    },
  });

  const handleProfileImageChange = async (file: File | null) => {
    if (!file) return;

    try {
      setImageUploading(true);
      setError('');
      setMessage('');
      const updatedUser = await adminApi.updateProfileImage(file);
      setUser(updatedUser);
      setMessage('Profile image updated successfully.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to update profile image.');
    } finally {
      setImageUploading(false);
    }
  };

  const initial = (user?.name || 'A').slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage super-admin account profile, address, and password."
      />

      <section className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-primary-100 bg-primary-50">
            {profileImageCandidates.length ? (
              <img
                src={profileImageCandidates[Math.min(profileImageIndex, profileImageCandidates.length - 1)]}
                alt="Profile"
                className="h-full w-full object-cover"
                onError={() => {
                  setProfileImageIndex((current) => (current + 1 < profileImageCandidates.length ? current + 1 : current));
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-primary-600">
                {initial}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary-500">Profile Photo</p>
            <p className="mt-1 text-sm text-slate-500">Upload JPG, PNG, or WebP (max 5MB).</p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary-700">
              {imageUploading ? 'Uploading...' : 'Change Photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => handleProfileImageChange(event.target.files?.[0] || null)}
                disabled={imageUploading}
              />
            </label>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit((values) => {
          setMessage('');
          setError('');
          updateProfileMutation.mutate(values);
        })}
        className="rounded-[1.75rem] border border-primary-100 bg-white p-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Name</label>
            <input
              {...register('name')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="Super admin name"
            />
            {errors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Mobile</label>
            <input
              {...register('mobile')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="9876543210"
            />
            {errors.mobile ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.mobile.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Email</label>
            <input
              {...register('email')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="superadmin@example.com"
            />
            {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Personal Address</p>
            <div className="grid gap-4 rounded-2xl border border-primary-100 bg-primary-50/40 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <input
                  {...register('street')}
                  className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3"
                  placeholder="Street"
                />
                {errors.street ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.street.message}</p> : null}
              </div>

              <div>
                <input
                  {...register('city')}
                  className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3"
                  placeholder="City"
                />
                {errors.city ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.city.message}</p> : null}
              </div>

              <div>
                <input
                  {...register('state')}
                  className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3"
                  placeholder="State"
                />
                {errors.state ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.state.message}</p> : null}
              </div>

              <div>
                <input
                  {...register('pincode')}
                  className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3"
                  placeholder="Pincode"
                />
                {errors.pincode ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.pincode.message}</p> : null}
              </div>

              <div>
                <input
                  {...register('landmark')}
                  className="w-full rounded-2xl border border-primary-100 bg-white px-4 py-3"
                  placeholder="Landmark"
                />
                {errors.landmark ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.landmark.message}</p> : null}
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || updateProfileMutation.isPending}
          className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
        >
          {isSubmitting || updateProfileMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <form
        onSubmit={handlePasswordSubmit((values) => {
          setPasswordMessage('');
          setPasswordError('');
          changePasswordMutation.mutate(values);
        })}
        className="rounded-[1.75rem] border border-primary-100 bg-white p-5"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Security</p>
        <h3 className="mt-1 text-xl font-black text-slate-900">Change Password</h3>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Current Password</label>
            <input
              type="password"
              {...registerPassword('currentPassword')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="Current password"
            />
            {passwordErrors.currentPassword ? <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.currentPassword.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">New Password</label>
            <input
              type="password"
              {...registerPassword('newPassword')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="New password"
            />
            {passwordErrors.newPassword ? <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.newPassword.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Confirm Password</label>
            <input
              type="password"
              {...registerPassword('confirmPassword')}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              placeholder="Confirm password"
            />
            {passwordErrors.confirmPassword ? <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.confirmPassword.message}</p> : null}
          </div>
        </div>

        {passwordError ? <p className="mt-4 text-sm font-semibold text-rose-600">{passwordError}</p> : null}
        {passwordMessage ? <p className="mt-4 text-sm font-semibold text-emerald-700">{passwordMessage}</p> : null}

        <button
          type="submit"
          disabled={isPasswordSubmitting || changePasswordMutation.isPending}
          className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
        >
          {isPasswordSubmitting || changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
