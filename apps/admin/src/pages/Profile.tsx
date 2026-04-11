import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import { adminApi } from '../utils/api';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const user = useAdminAuthStore((state) => state.user);
  const setUser = useAdminAuthStore((state) => state.setUser);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

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
    },
  });

  useEffect(() => {
    reset({
      name: user?.name || '',
      mobile: user?.mobile || '',
      email: user?.email || '',
    });
  }, [reset, user?.email, user?.mobile, user?.name]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: ProfileFormValues) => adminApi.updateMe(payload),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setError('');
      setMessage('Profile updated successfully.');
    },
    onError: (mutationError) => {
      setMessage('');
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update profile.');
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
        title="Profile"
        subtitle="Manage your dealer account details and profile photo."
      />

      <section className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-primary-100 bg-primary-50">
            {user?.profileImage?.url ? (
              <img src={user.profileImage.url} alt="Profile" className="h-full w-full object-cover" />
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
              placeholder="Dealer name"
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
              placeholder="dealer@example.com"
            />
            {errors.email ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email.message}</p> : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || updateProfileMutation.isPending}
          className="mt-6 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-primary-200"
        >
          {isSubmitting || updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
