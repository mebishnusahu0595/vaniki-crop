import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImagePlus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Banner } from '../types/admin';
import { formatDate } from '../utils/format';

const bannerSchema = z.object({
  title: z.string().min(2),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  sortOrder: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  linkedProducts: z.string().optional(),
});

type BannerFormInput = z.input<typeof bannerSchema>;
type BannerFormOutput = z.output<typeof bannerSchema>;

const bannerDefaultValues: BannerFormInput = {
  title: '',
  subtitle: '',
  ctaText: '',
  ctaLink: '',
  sortOrder: 0,
  isActive: true,
  startDate: '',
  endDate: '',
  linkedProducts: '',
};

export default function BannersPage() {
  const [editing, setEditing] = useState<Banner | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const queryClient = useQueryClient();
  const bannersQuery = useQuery({ queryKey: ['admin-banners'], queryFn: adminApi.banners });
  const productsQuery = useQuery({ queryKey: ['admin-banner-products'], queryFn: () => adminApi.products({ limit: 50, isActive: true }) });
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm<
    BannerFormInput,
    undefined,
    BannerFormOutput
  >({
    resolver: zodResolver(bannerSchema),
    defaultValues: bannerDefaultValues,
  });

  useEffect(() => {
    if (!editing) {
      reset(bannerDefaultValues);
      setImageUrlInput('');
      return;
    }

    reset({
      title: editing.title,
      subtitle: editing.subtitle || '',
      ctaText: editing.ctaText || '',
      ctaLink: editing.ctaLink || '',
      sortOrder: editing.sortOrder,
      isActive: editing.isActive,
      startDate: editing.startDate?.slice(0, 10) || '',
      endDate: editing.endDate?.slice(0, 10) || '',
      linkedProducts: editing.linkedProducts.map((item) => item.productId?.id).filter(Boolean).join(','),
    });
    setImageUrlInput('');
  }, [editing, reset]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const clearFilePreview = () => {
    if (filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl('');
    setImageFile(null);
  };

  const setSelectedImageFile = (file: File | null) => {
    if (filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setImageFile(file);
    if (file) {
      setImageUrlInput('');
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl('');
    }
  };

  const dropzone = useDropzone({
    multiple: false,
    accept: { 'image/*': [] },
    onDrop: (files) => {
      setSelectedImageFile(files[0] || null);
    },
  });

  const previewUrl = filePreviewUrl || imageUrlInput.trim() || editing?.image.url || '';

  const mutation = useMutation({
    mutationFn: async (values: BannerFormOutput) => {
      const payload = new FormData();
      payload.append('title', values.title);
      if (values.subtitle) payload.append('subtitle', values.subtitle);
      if (values.ctaText) payload.append('ctaText', values.ctaText);
      if (values.ctaLink) payload.append('ctaLink', values.ctaLink);
      payload.append('sortOrder', String(values.sortOrder));
      payload.append('isActive', String(values.isActive));
      if (values.startDate) payload.append('startDate', values.startDate);
      if (values.endDate) payload.append('endDate', values.endDate);
      if (imageUrlInput.trim()) payload.append('imageUrl', imageUrlInput.trim());
      if (values.linkedProducts) {
        payload.append(
          'linkedProducts',
          JSON.stringify(
            values.linkedProducts
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
              .map((productId, index) => ({ productId, position: index })),
          ),
        );
      }
      if (imageFile) payload.append('image', imageFile);

      return editing ? adminApi.updateBanner(editing.id, payload) : adminApi.createBanner(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      reset(bannerDefaultValues);
      setEditing(null);
      setImageUrlInput('');
      setImageUrlError('');
      clearFilePreview();
    },
  });

  if (bannersQuery.isLoading) return <LoadingBlock label="Loading banners..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Banners" subtitle="Manage only the hero banners that belong to your store." />
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="mt-6 space-y-4">
          <input {...register('title')} placeholder="Banner title" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <textarea {...register('subtitle')} placeholder="Subtitle" className="min-h-[90px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div className="grid gap-3 md:grid-cols-2">
            <input {...register('ctaText')} placeholder="CTA text" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input {...register('ctaLink')} placeholder="/products" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="number" {...register('sortOrder', { valueAsNumber: true })} placeholder="Sort order" className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="date" {...register('startDate')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            <input type="date" {...register('endDate')} className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>
          <div
            {...dropzone.getRootProps()}
            className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-8 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <ImagePlus size={22} className="mx-auto text-primary-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Drag banner image here or click to upload</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setSelectedImageFile(event.target.files?.[0] || null)}
            className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
          <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-3">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Banner image URL</label>
            <div className="flex gap-2">
              <input
                value={imageUrlInput}
                onChange={(event) => {
                  setImageUrlInput(event.target.value);
                  if (imageUrlError) setImageUrlError('');
                }}
                placeholder="https://example.com/banner.jpg"
                className="min-w-0 flex-1 rounded-xl border border-primary-100 bg-white px-3 py-2"
              />
              <button
                type="button"
                onClick={() => {
                  const value = imageUrlInput.trim();
                  if (!value) return;
                  try {
                    const normalized = new URL(value).toString();
                    setImageUrlInput(normalized);
                    setImageUrlError('');
                    clearFilePreview();
                  } catch {
                    setImageUrlError('Enter a valid image URL');
                  }
                }}
                className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white"
              >
                Use URL
              </button>
            </div>
            {imageUrlError ? <p className="mt-2 text-xs text-rose-600">{imageUrlError}</p> : null}
          </div>
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white">
              <img src={previewUrl} alt="Banner preview" className="h-40 w-full object-cover" />
            </div>
          ) : null}
          <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Linked Products</label>
          <select
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value).join(',');
              setValue('linkedProducts', selected, { shouldDirty: true, shouldValidate: true });
            }}
            className="min-h-[150px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          >
            {productsQuery.data?.data.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Active banner</span>
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              {editing ? 'Update Banner' : 'Create Banner'}
            </button>
            {editing ? <button type="button" onClick={() => { setEditing(null); reset(bannerDefaultValues); setImageUrlInput(''); setImageUrlError(''); clearFilePreview(); }} className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600">Cancel</button> : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {bannersQuery.data?.map((banner) => (
          <div key={banner.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{banner.title}</p>
                <p className="mt-1 text-sm text-slate-500">{banner.subtitle || 'No subtitle'}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                  Sort {banner.sortOrder} · {banner.startDate ? formatDate(banner.startDate) : 'Always'} to {banner.endDate ? formatDate(banner.endDate) : 'Open ended'}
                </p>
              </div>
              <button onClick={() => setEditing(banner)} className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700">Edit</button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {banner.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const reordered = (bannersQuery.data || []).map((item) => ({
                      id: item.id,
                      sortOrder: item.id === banner.id ? 0 : item.sortOrder + 1,
                    }));
                    await adminApi.reorderBanners(reordered);
                    queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
                  }}
                  className="text-sm font-semibold text-primary-700"
                >
                  Pin Top
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete ${banner.title}?`)) return;
                    await adminApi.deleteBanner(banner.id);
                    queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
                  }}
                  className="text-sm font-semibold text-rose-600"
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
