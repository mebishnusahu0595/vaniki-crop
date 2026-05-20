import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImagePlus, Megaphone, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { z } from 'zod';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import type { DealerPromotion } from '../types/admin';
import { adminApi } from '../utils/api';
import { resolveMediaUrl } from '../utils/media';

const promotionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

type PromotionFormInput = z.input<typeof promotionSchema>;
type PromotionFormOutput = z.output<typeof promotionSchema>;

const promotionDefaultValues: PromotionFormInput = {
  title: '',
  description: '',
  isActive: true,
  sortOrder: 0,
};

export default function DealersPromotionsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DealerPromotion | null>(null);
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoPreviewUrl, setPromoPreviewUrl] = useState('');

  const promotionsQuery = useQuery({
    queryKey: ['super-admin-promotions'],
    queryFn: () => adminApi.promotions(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<PromotionFormInput, undefined, PromotionFormOutput>({
    resolver: zodResolver(promotionSchema),
    defaultValues: promotionDefaultValues,
  });

  const promotionList = promotionsQuery.data?.data ?? [];

  useEffect(() => {
    if (!editing) {
      reset(promotionDefaultValues);
      clearPromoPreview();
      return;
    }

    reset({
      title: editing.title,
      description: editing.description,
      isActive: editing.isActive,
      sortOrder: editing.sortOrder,
    });
  }, [editing, reset]);

  useEffect(() => {
    return () => {
      if (promoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(promoPreviewUrl);
      }
    };
  }, [promoPreviewUrl]);

  const clearPromoPreview = () => {
    if (promoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(promoPreviewUrl);
    }
    setPromoPreviewUrl('');
    setPromoFile(null);
  };

  const setSelectedPromoFile = (file: File | null) => {
    if (promoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(promoPreviewUrl);
    }

    setPromoFile(file);
    if (file) {
      setPromoPreviewUrl(URL.createObjectURL(file));
    } else {
      setPromoPreviewUrl('');
    }
  };

  const dropzone = useDropzone({
    multiple: false,
    accept: { 'image/*': [] },
    onDrop: (files) => {
      setSelectedPromoFile(files[0] || null);
    },
  });

  const previewImageUrl = promoPreviewUrl
    || resolveMediaUrl(editing?.image?.url, editing?.image?.publicId)
    || '';

  const upsertMutation = useMutation({
    mutationFn: async (values: PromotionFormOutput) => {
      const payload = new FormData();
      payload.append('title', values.title);
      payload.append('description', values.description);
      payload.append('isActive', String(values.isActive));
      payload.append('sortOrder', String(values.sortOrder));
      if (promoFile) {
        payload.append('image', promoFile);
      }

      if (editing) {
        return adminApi.updatePromotion(editing.id, payload);
      }

      return adminApi.createPromotion(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-promotions'] });
      setEditing(null);
      clearPromoPreview();
      reset(promotionDefaultValues);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-promotions'] });
    },
  });

  if (promotionsQuery.isLoading) return <LoadingBlock label="Loading promotions..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      {/* Promotion Form */}
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5 shadow-sm">
        <PageHeader 
          title="Dealers Promotions" 
          subtitle="Add, edit, or remove promotions & notifications that display on the dealer mobile app dashboard." 
        />

        <form onSubmit={handleSubmit((values) => upsertMutation.mutate(values))} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Promotion Title</label>
            <input 
              {...register('title')} 
              placeholder="e.g. Special Discount on Urea bags!" 
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
            />
            {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Description Text</label>
            <textarea 
              {...register('description')} 
              placeholder="Provide a detailed description of the deal, announcement, or pricing offer..." 
              className="min-h-[120px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
            />
            {errors.description && <p className="mt-1 text-xs text-rose-500">{errors.description.message}</p>}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Sort Order</label>
              <input 
                type="number" 
                {...register('sortOrder', { valueAsNumber: true })} 
                placeholder="0" 
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3.5">
                <span className="text-sm font-semibold text-slate-700">Is Active</span>
                <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Promotional Banner Image</label>
            <div
              {...dropzone.getRootProps()}
              className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-8 text-center transition hover:bg-primary-50/70"
            >
              <input {...dropzone.getInputProps()} />
              <ImagePlus size={24} className="mx-auto text-primary-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700">Drag image here or click to browse</p>
              <p className="mt-1 text-xs text-slate-400">Recommened size: 1200x500 (Landscape)</p>
            </div>
          </div>

          {previewImageUrl ? (
            <div className="rounded-2xl border border-primary-100 bg-white p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Image Preview</p>
              <div className="relative aspect-[2.4/1] w-full overflow-hidden rounded-xl border border-primary-50">
                <img src={previewImageUrl} alt="Promotion preview" className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="rounded-2xl bg-primary-500 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 disabled:opacity-50"
            >
              {editing ? 'Update Promotion' : 'Publish Promotion'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  clearPromoPreview();
                  reset(promotionDefaultValues);
                }}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-primary-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {/* Promotions List Display */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Megaphone size={18} className="text-primary-600" />
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-primary-600">Active Promotions List</h3>
        </div>

        {promotionList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-primary-200 bg-primary-50/20 p-8 text-center">
            <AlertCircle className="mx-auto text-primary-400" size={32} />
            <p className="mt-3 text-sm font-semibold text-slate-500">No promotion banners published yet.</p>
            <p className="text-xs text-slate-400">Create one on the left to show announcements in the dealer app.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {promotionList.map((promo) => (
              <div key={promo.id} className="overflow-hidden rounded-[2rem] border border-primary-100 bg-white shadow-sm">
                {promo.image?.url && (
                  <div className="aspect-[2.4/1] w-full bg-slate-100">
                    <img
                      src={resolveMediaUrl(promo.image.url, promo.image.publicId)}
                      alt={promo.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 leading-tight">{promo.title}</h4>
                      <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{promo.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-primary-50 pt-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                        promo.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {promo.isActive ? (
                          <>
                            <CheckCircle2 size={12} />
                            Active
                          </>
                        ) : 'Inactive'}
                      </span>
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                        Order: {promo.sortOrder}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditing(promo)} 
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          if (!window.confirm(`Delete promotion "${promo.title}"?`)) return;
                          deleteMutation.mutate(promo.id);
                        }} 
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
