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
import { resolveMediaUrl } from '../utils/media';

const bannerSchema = z.object({
  title: z.string().min(2),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  storeId: z.string().optional(),
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
  storeId: '',
  sortOrder: 0,
  isActive: true,
  startDate: '',
  endDate: '',
  linkedProducts: '',
};

function normalizeDateForApi(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return new Date(trimmed).toISOString();
}

export default function BannersPage() {
  const [editing, setEditing] = useState<Banner | null>(null);
  const [formError, setFormError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [reorderedBanners, setReorderedBanners] = useState<Banner[] | null>(null);
  const [draggedBannerId, setDraggedBannerId] = useState<string | null>(null);
  const [filterStoreId, setFilterStoreId] = useState('global');
  const queryClient = useQueryClient();
  const bannersQuery = useQuery({ 
    queryKey: ['admin-banners', filterStoreId], 
    queryFn: () => adminApi.banners({ storeId: filterStoreId }) 
  });
  const storesQuery = useQuery({ queryKey: ['banner-store-options'], queryFn: () => adminApi.stores({ limit: 200 }) });
  const productsQuery = useQuery({ queryKey: ['admin-banner-products'], queryFn: () => adminApi.products({ limit: 50, isActive: true }) });
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<
    BannerFormInput,
    undefined,
    BannerFormOutput
  >({
    resolver: zodResolver(bannerSchema),
    defaultValues: bannerDefaultValues,
  });

  useEffect(() => {
    if (!editing) {
      reset({
        ...bannerDefaultValues,
        storeId: filterStoreId === 'global' ? '' : filterStoreId,
      });
      setImageUrlInput('');
      return;
    }

    reset({
      title: editing.title,
      subtitle: editing.subtitle || '',
      ctaText: editing.ctaText || '',
      ctaLink: editing.ctaLink || '',
      storeId:
        typeof editing.storeId === 'string'
          ? editing.storeId
          : editing.storeId && typeof editing.storeId === 'object'
            ? editing.storeId.id
            : '',
      sortOrder: editing.sortOrder,
      isActive: editing.isActive,
      startDate: editing.startDate?.slice(0, 10) || '',
      endDate: editing.endDate?.slice(0, 10) || '',
      linkedProducts: editing.linkedProducts.map((item) => item.productId?.id).filter(Boolean).join(','),
    });
    setImageUrlInput('');
  }, [editing, reset, filterStoreId]);

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

  const visibleBanners = reorderedBanners ?? bannersQuery.data ?? [];
  const previewUrl = filePreviewUrl
    || resolveMediaUrl(imageUrlInput.trim() || editing?.image.url, editing?.image.publicId)
    || '';
  const linkedProductsValue = watch('linkedProducts') || '';
  const selectedLinkedProductIds = linkedProductsValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const reorderMutation = useMutation({
    mutationFn: async (items: Banner[]) => {
      await adminApi.reorderBanners(items.map((item, index) => ({ id: item.id, sortOrder: index })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Unable to reorder banners.');
    },
  });

  const resolveStoreName = (storeId: Banner['storeId']) => {
    if (!storeId) return 'Global (all stores)';
    if (typeof storeId === 'object') return storeId.name;
    const matched = storesQuery.data?.data.find((store) => store.id === storeId);
    return matched?.name || 'Specific store';
  };

  const reorderList = (sourceId: string, destinationId: string) => {
    if (sourceId === destinationId) return;

    const sourceIndex = visibleBanners.findIndex((item) => item.id === sourceId);
    const destinationIndex = visibleBanners.findIndex((item) => item.id === destinationId);
    if (sourceIndex === -1 || destinationIndex === -1) return;

    const copy = [...visibleBanners];
    const [moved] = copy.splice(sourceIndex, 1);
    copy.splice(destinationIndex, 0, moved);

    setReorderedBanners(copy);
    reorderMutation.mutate(copy);
  };

  const mutation = useMutation({
    mutationFn: async (values: BannerFormOutput) => {
      setFormError('');
      const hasExistingImage = Boolean(editing?.image?.url);
      const hasIncomingImage = Boolean(imageFile || imageUrlInput.trim());
      if (!hasExistingImage && !hasIncomingImage) {
        throw new Error('Banner image is required. Upload a file or provide a valid image URL.');
      }

      const payload = new FormData();
      payload.append('title', values.title);
      if (values.subtitle) payload.append('subtitle', values.subtitle);
      if (values.ctaText) payload.append('ctaText', values.ctaText);
      if (values.ctaLink) payload.append('ctaLink', values.ctaLink);
      if (values.storeId) {
        payload.append('storeId', values.storeId);
      } else if (editing) {
        payload.append('storeId', '');
      }
      if (imageUrlInput.trim()) payload.append('imageUrl', imageUrlInput.trim());
      payload.append('sortOrder', String(values.sortOrder));
      payload.append('isActive', String(values.isActive));
      const normalizedStartDate = normalizeDateForApi(values.startDate);
      const normalizedEndDate = normalizeDateForApi(values.endDate);
      if (normalizedStartDate) payload.append('startDate', normalizedStartDate);
      if (normalizedEndDate) payload.append('endDate', normalizedEndDate);
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
      setReorderedBanners(null);
      reset(bannerDefaultValues);
      setEditing(null);
      setImageUrlInput('');
      setImageUrlError('');
      setFormError('');
      clearFilePreview();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Unable to save banner.');
    },
  });

  if (bannersQuery.isLoading) return <LoadingBlock label="Loading banners..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Global Banners" subtitle="Create store-specific or global banners with live preview and ordering control." />
        <form
          onSubmit={handleSubmit((values) => {
            setFormError('');
            mutation.mutate(values);
          })}
          className="mt-6 space-y-4"
        >
          <p className="text-xs font-semibold text-slate-500">
           
          </p>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Banner Title</label>
            <input {...register('title')} placeholder="Banner title" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Subtitle</label>
            <textarea {...register('subtitle')} placeholder="Subtitle" className="min-h-[90px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">CTA Text</label>
              <input {...register('ctaText')} placeholder="CTA text" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">CTA Link</label>
              <input {...register('ctaLink')} placeholder="/products" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Target Store</label>
              <select {...register('storeId')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                <option value="">Global (all stores)</option>
                {storesQuery.data?.data.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Sort Order</label>
              <input type="number" {...register('sortOrder', { valueAsNumber: true })} placeholder="Sort order" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Banner Image File</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedImageFile(event.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Start Date</label>
              <input type="date" {...register('startDate')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">End Date</label>
              <input type="date" {...register('endDate')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>
          </div>

          <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Upload Banner Image</label>
          <div
            {...dropzone.getRootProps()}
            className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-8 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <ImagePlus size={22} className="mx-auto text-primary-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Drag banner image here or click to upload</p>
          </div>

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

          <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Linked Products</label>
          <p className="-mt-2 text-xs font-semibold text-slate-500">Products select karne se banner par clickable product highlights set hote hain. Multi-select ke liye Ctrl/Cmd use karein.</p>
          <select
            multiple
            value={selectedLinkedProductIds}
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
          <p className="-mt-2 text-xs font-semibold text-slate-500">Selected: {selectedLinkedProductIds.length}</p>
          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Active banner</span>
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? 'Update Banner' : 'Create Banner'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormError('');
                  reset(bannerDefaultValues);
                  setImageUrlInput('');
                  setImageUrlError('');
                  clearFilePreview();
                }}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {formError ? <p className="text-sm font-semibold text-rose-600">{formError}</p> : null}
        </form>

        <div className="mt-6 rounded-[1.5rem] border border-primary-100 bg-primary-50/40 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-500">Live Preview</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-primary-100 bg-white">
            {previewUrl ? <img src={previewUrl} alt="Banner preview" className="h-40 w-full object-cover" /> : null}
            <div className="px-4 py-3">
              <p className="text-sm font-black text-slate-900">{(editing?.title || '').trim() || 'Banner title preview'}</p>
              <p className="mt-1 text-xs text-slate-500">{(editing?.subtitle || '').trim() || 'Subtitle preview will appear here.'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Filter by Target Store</label>
          <select 
            value={filterStoreId} 
            onChange={(e) => setFilterStoreId(e.target.value)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          >
            <option value="">All Stores</option>
            <option value="global">Global (all stores)</option>
            {storesQuery.data?.data.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>

        {visibleBanners.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50/30 py-12 text-center">
            <p className="text-lg font-black text-slate-400">No banners found for this store.</p>
          </div>
        )}

        {visibleBanners.map((banner) => (
          <div
            key={banner.id}
            draggable
            onDragStart={() => setDraggedBannerId(banner.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedBannerId) return;
              reorderList(draggedBannerId, banner.id);
              setDraggedBannerId(null);
            }}
            className="rounded-[1.5rem] border border-primary-100 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{banner.title}</p>
                <p className="mt-1 text-sm text-slate-500">{banner.subtitle || 'No subtitle'}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                  {resolveStoreName(banner.storeId)} · {banner.startDate ? formatDate(banner.startDate) : 'Always'} to {banner.endDate ? formatDate(banner.endDate) : 'Open ended'}
                </p>
              </div>
              <button
                onClick={() => {
                  clearFilePreview();
                  setEditing(banner);
                }}
                className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${banner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {banner.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Drag to reorder</span>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete ${banner.title}?`)) return;
                    try {
                      await adminApi.deleteBanner(banner.id);
                      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
                      setReorderedBanners(null);
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : 'Unable to delete banner.');
                    }
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
