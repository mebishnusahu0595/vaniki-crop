import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImagePlus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { z } from 'zod';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import type { Testimonial } from '../types/admin';
import { adminApi } from '../utils/api';

const testimonialSchema = z.object({
  name: z.string().min(2),
  designation: z.string().optional(),
  message: z.string().min(10),
  rating: z.coerce.number().min(1).max(5),
  storeId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type TestimonialFormInput = z.input<typeof testimonialSchema>;
type TestimonialFormOutput = z.output<typeof testimonialSchema>;

const testimonialDefaultValues: TestimonialFormInput = {
  name: '',
  designation: '',
  message: '',
  rating: 5,
  storeId: '',
  isActive: true,
};

export default function TestimonialsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [avatarUrlError, setAvatarUrlError] = useState('');
  const [reorderedTestimonials, setReorderedTestimonials] = useState<Testimonial[] | null>(null);

  const testimonialsQuery = useQuery({
    queryKey: ['super-admin-testimonials'],
    queryFn: () => adminApi.testimonials({ limit: 200 }),
  });

  const storesQuery = useQuery({
    queryKey: ['testimonial-store-options'],
    queryFn: () => adminApi.stores({ limit: 200 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TestimonialFormInput, undefined, TestimonialFormOutput>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: testimonialDefaultValues,
  });

  const testimonialList = reorderedTestimonials ?? testimonialsQuery.data?.data ?? [];

  useEffect(() => {
    if (!editing) {
      reset(testimonialDefaultValues);
      setAvatarUrlInput('');
      return;
    }

    reset({
      name: editing.name,
      designation: editing.designation || '',
      message: editing.message,
      rating: editing.rating,
      storeId:
        typeof editing.storeId === 'string'
          ? editing.storeId
          : editing.storeId && typeof editing.storeId === 'object'
            ? editing.storeId.id
            : '',
      isActive: editing.isActive,
    });
    setAvatarUrlInput('');
  }, [editing, reset]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const clearAvatarPreview = () => {
    if (avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl('');
    setAvatarFile(null);
  };

  const setSelectedAvatarFile = (file: File | null) => {
    if (avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    if (file) {
      setAvatarUrlInput('');
      setAvatarPreviewUrl(URL.createObjectURL(file));
    } else {
      setAvatarPreviewUrl('');
    }
  };

  const dropzone = useDropzone({
    multiple: false,
    accept: { 'image/*': [] },
    onDrop: (files) => {
      setSelectedAvatarFile(files[0] || null);
    },
  });

  const previewAvatarUrl = avatarPreviewUrl || avatarUrlInput.trim() || editing?.avatar?.url || '';

  const upsertMutation = useMutation({
    mutationFn: async (values: TestimonialFormOutput) => {
      const payload = new FormData();
      payload.append('name', values.name);
      if (values.designation) payload.append('designation', values.designation);
      payload.append('message', values.message);
      payload.append('rating', String(values.rating));
      payload.append('isActive', String(values.isActive));
      if (values.storeId) {
        payload.append('storeId', values.storeId);
      } else if (editing) {
        payload.append('storeId', '');
      }
      if (avatarUrlInput.trim()) payload.append('avatarUrl', avatarUrlInput.trim());
      if (avatarFile) payload.append('avatar', avatarFile);

      if (editing) {
        return adminApi.updateTestimonial(editing.id, payload);
      }

      return adminApi.createTestimonial(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-testimonials'] });
      setReorderedTestimonials(null);
      setEditing(null);
      setAvatarUrlInput('');
      setAvatarUrlError('');
      clearAvatarPreview();
      reset(testimonialDefaultValues);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.toggleTestimonial(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-testimonials'] });
      setReorderedTestimonials(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-testimonials'] });
      setReorderedTestimonials(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: Testimonial[]) =>
      adminApi.reorderTestimonials(items.map((item, index) => ({ id: item.id, sortOrder: index }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-testimonials'] });
    },
  });

  if (testimonialsQuery.isLoading) return <LoadingBlock label="Loading testimonials..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Testimonials" subtitle="Add, edit, hide, and reorder customer testimonials." />

        <form onSubmit={handleSubmit((values) => upsertMutation.mutate(values))} className="mt-6 space-y-4">
          <input {...register('name')} placeholder="Customer name" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <input {...register('designation')} placeholder="Designation" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <textarea {...register('message')} placeholder="Testimonial message" className="min-h-[120px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />

          <div className="grid gap-3 md:grid-cols-2">
            <input type="number" min={1} max={5} {...register('rating', { valueAsNumber: true })} placeholder="Rating (1-5)" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <select {...register('storeId')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
              <option value="">Global testimonial (all stores)</option>
              {storesQuery.data?.data.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setSelectedAvatarFile(event.target.files?.[0] || null)}
              className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 md:col-span-2"
            />
          </div>

          <div
            {...dropzone.getRootProps()}
            className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-8 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <ImagePlus size={22} className="mx-auto text-primary-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Drag avatar image here or click to upload</p>
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-3">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Avatar image URL</label>
            <div className="flex gap-2">
              <input
                value={avatarUrlInput}
                onChange={(event) => {
                  setAvatarUrlInput(event.target.value);
                  if (avatarUrlError) setAvatarUrlError('');
                }}
                placeholder="https://example.com/avatar.jpg"
                className="min-w-0 flex-1 rounded-xl border border-primary-100 bg-white px-3 py-2"
              />
              <button
                type="button"
                onClick={() => {
                  const value = avatarUrlInput.trim();
                  if (!value) return;
                  try {
                    const normalized = new URL(value).toString();
                    setAvatarUrlInput(normalized);
                    setAvatarUrlError('');
                    clearAvatarPreview();
                  } catch {
                    setAvatarUrlError('Enter a valid image URL');
                  }
                }}
                className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white"
              >
                Use URL
              </button>
            </div>
            {avatarUrlError ? <p className="mt-2 text-xs text-rose-600">{avatarUrlError}</p> : null}
          </div>

          {previewAvatarUrl ? (
            <div className="rounded-2xl border border-primary-100 bg-white p-3">
              <div className="flex items-center gap-3">
                <img src={previewAvatarUrl} alt="Avatar preview" className="h-14 w-14 rounded-full object-cover" />
                <p className="text-sm text-slate-600">Avatar preview</p>
              </div>
            </div>
          ) : null}

          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Visible testimonial</span>
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
          </label>

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              {editing ? 'Update Testimonial' : 'Add Testimonial'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAvatarUrlInput('');
                  setAvatarUrlError('');
                  clearAvatarPreview();
                  reset(testimonialDefaultValues);
                }}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {testimonialList.map((testimonial, index) => (
          <div key={testimonial.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {testimonial.avatar?.url ? (
                  <img src={testimonial.avatar.url} alt={testimonial.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-700">
                    {testimonial.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-lg font-black text-slate-900">{testimonial.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{testimonial.designation || 'Customer'}</p>
                  <p className="mt-2 text-sm text-slate-600">{testimonial.message}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-primary-600">
                    Rating {testimonial.rating}/5
                  </p>
                </div>
              </div>
              <button onClick={() => setEditing(testimonial)} className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700">
                Edit
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${testimonial.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {testimonial.isActive ? 'Visible' : 'Hidden'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const next = [...testimonialList];
                    if (index === 0) return;
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    setReorderedTestimonials(next);
                    reorderMutation.mutate(next);
                  }}
                  className="rounded-xl border border-primary-100 px-3 py-1 text-xs font-semibold text-primary-700"
                >
                  Up
                </button>
                <button
                  onClick={() => {
                    const next = [...testimonialList];
                    if (index === next.length - 1) return;
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    setReorderedTestimonials(next);
                    reorderMutation.mutate(next);
                  }}
                  className="rounded-xl border border-primary-100 px-3 py-1 text-xs font-semibold text-primary-700"
                >
                  Down
                </button>
                <button
                  onClick={() => toggleMutation.mutate({ id: testimonial.id, isActive: !testimonial.isActive })}
                  className="rounded-xl border border-primary-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {testimonial.isActive ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete testimonial by ${testimonial.name}?`)) return;
                    deleteMutation.mutate(testimonial.id);
                  }}
                  className="rounded-xl border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
