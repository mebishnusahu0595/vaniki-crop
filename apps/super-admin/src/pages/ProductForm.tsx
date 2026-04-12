import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ImagePlus, MinusCircle, PlusCircle, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill-new';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { API_BASE_URL } from '../config/api';
import { LoadingBlock } from '../components/LoadingBlock';
import type { Category, ImageAsset, Product } from '../types/admin';
import { adminApi } from '../utils/api';
import { buildVariantLabel, parseVariantLabel, slugify } from '../utils/format';

const units = ['ml', 'Liter', 'gm', 'KG', 'Packet', 'piece'] as const;

const requiredNumber = (label: string) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      const numericValue = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numericValue) ? numericValue : undefined;
    },
    z
      .number({
        message: `${label} is required`,
      })
      .min(0, `${label} must be zero or more`),
  );

const variantSchema = z.object({
  quantity: z.string().min(1, 'Qty is required'),
  unit: z.enum(units),
  price: requiredNumber('Price'),
  mrp: requiredNumber('MRP'),
  stock: requiredNumber('Stock'),
});

const productSchema = z.object({
  name: z.string().min(2),
  shortDescription: z.string().min(5),
  description: z.string().min(10),
  category: z.string().min(1),
  tags: z.string().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  variants: z.array(variantSchema).min(1),
});

type ProductFormInput = z.input<typeof productSchema>;
type ProductFormOutput = z.output<typeof productSchema>;

interface NewUpload {
  id: string;
  file: File;
  preview: string;
}

interface UrlUpload {
  id: string;
  url: string;
}

const productDefaultValues: ProductFormInput = {
  name: '',
  shortDescription: '',
  description: '',
  category: '',
  tags: '',
  isFeatured: false,
  isActive: true,
  metaTitle: '',
  metaDescription: '',
  variants: [{ quantity: '', unit: 'Liter', price: '', mrp: '', stock: '' }],
};

function getProductDefaultValues(product?: Product): ProductFormInput {
  if (!product) {
    return productDefaultValues;
  }

  return {
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    category: product.category?.id || '',
    tags: product.tags.join(', '),
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    metaTitle: product.metaTitle || '',
    metaDescription: product.metaDescription || '',
    variants: product.variants.map((variant) => ({
      ...(parseVariantLabel(variant.label) as { quantity: string; unit: (typeof units)[number] }),
      price: variant.price,
      mrp: variant.mrp,
      stock: variant.stock,
    })),
  };
}

function getApiOrigin(): string {
  if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
    return '';
  }

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
}

function getLocalMediaProxyUrl(publicId?: string): string {
  if (!publicId?.startsWith('local:')) {
    return '';
  }

  return `${API_BASE_URL}/media?publicId=${encodeURIComponent(publicId)}`;
}

function getLocalPublicIdFromUrl(rawUrl?: string): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const pathCandidate = (() => {
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        return new URL(trimmed).pathname;
      } catch {
        return '';
      }
    }

    return trimmed.split(/[?#]/, 1)[0] || '';
  })();

  if (!pathCandidate) return '';

  const cleaned = pathCandidate.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const withLeadingSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const normalizedPath = withLeadingSlash.startsWith('/api/uploads/')
    ? withLeadingSlash.replace(/^\/api/, '')
    : withLeadingSlash;

  if (!normalizedPath.startsWith('/uploads/')) {
    return '';
  }

  const relativePath = normalizedPath.replace(/^\/uploads\//, '');
  if (!relativePath) return '';

  const decodedRelativePath = relativePath
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');

  return `local:${decodedRelativePath}`;
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

function resolveMediaUrl(rawUrl?: string, publicId?: string): string {
  const normalizedPublicId = publicId || getLocalPublicIdFromUrl(rawUrl);
  const mediaProxyUrl = getLocalMediaProxyUrl(normalizedPublicId);
  if (mediaProxyUrl) return mediaProxyUrl;

  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const apiOrigin = getApiOrigin();
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';

  const resolveRelativePath = (value: string): string => {
    const cleaned = value.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    const withLeadingSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    const normalizedPath = withLeadingSlash.startsWith('/api/uploads/')
      ? withLeadingSlash.replace(/^\/api/, '')
      : withLeadingSlash;

    if (apiOrigin) return `${apiOrigin}${normalizedPath}`;
    if (browserOrigin) return `${browserOrigin}${normalizedPath}`;
    return normalizedPath;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = encodePathname(parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/'));

      const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (isLocalHost && (apiOrigin || browserOrigin)) {
        const pathWithSuffix = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        return resolveRelativePath(pathWithSuffix);
      }

      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  return resolveRelativePath(trimmed);
}

function ProductEditor({
  isEdit,
  productId,
  product,
  categories,
}: {
  isEdit: boolean;
  productId?: string;
  product?: Product;
  categories: Category[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [existingImages, setExistingImages] = useState<ImageAsset[]>(product?.images || []);
  const [removedImagePublicIds, setRemovedImagePublicIds] = useState<string[]>([]);
  const [newUploads, setNewUploads] = useState<NewUpload[]>([]);
  const [urlUploads, setUrlUploads] = useState<UrlUpload[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [primaryImagePublicId, setPrimaryImagePublicId] = useState<string>(
    product?.images.find((image) => image.isPrimary)?.publicId || product?.images[0]?.publicId || '',
  );

  const defaultValues = useMemo(() => getProductDefaultValues(product), [product]);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, undefined, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });
  const productName = useWatch({ control, name: 'name' });

  useEffect(() => () => {
    newUploads.forEach((upload) => URL.revokeObjectURL(upload.preview));
  }, [newUploads]);

  const createMutation = useMutation({
    mutationFn: adminApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      navigate('/products');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: FormData) => adminApi.updateProduct(productId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-detail', productId] });
      navigate('/products');
    },
  });

  const dropzone = useDropzone({
    multiple: true,
    maxFiles: 5,
    accept: { 'image/*': [] },
    onDrop: (files) => {
      setNewUploads((current) => {
        const availableSlots = Math.max(0, 5 - existingImages.length - urlUploads.length - current.length);
        if (availableSlots <= 0) return current;

        const additions = files.slice(0, availableSlots).map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: URL.createObjectURL(file),
        }));

        return [...current, ...additions];
      });
    },
  });

  const handleAddImageUrl = () => {
    const rawValue = imageUrlInput.trim();
    if (!rawValue) return;

    let normalizedUrl = rawValue;
    try {
      normalizedUrl = new URL(rawValue).toString();
    } catch {
      setImageUrlError('Enter a valid image URL');
      return;
    }

    if (existingImages.length + newUploads.length + urlUploads.length >= 5) {
      setImageUrlError('Maximum 5 images allowed');
      return;
    }

    if (urlUploads.some((entry) => entry.url === normalizedUrl)) {
      setImageUrlError('This image URL is already added');
      return;
    }

    setUrlUploads((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: normalizedUrl,
      },
    ]);
    setImageUrlError('');
    setImageUrlInput('');
  };

  return (
    <form
      onSubmit={handleSubmit(async (values: ProductFormOutput) => {
        setSubmitError('');
        const payload = new FormData();
        payload.append('name', values.name);
        payload.append('shortDescription', values.shortDescription);
        payload.append('description', values.description);
        payload.append('category', values.category);
        payload.append('tags', JSON.stringify(values.tags?.split(',').map((tag: string) => tag.trim()).filter(Boolean) || []));
        payload.append('isFeatured', String(values.isFeatured));
        payload.append('isActive', String(values.isActive));
        payload.append('metaTitle', values.metaTitle || '');
        payload.append('metaDescription', values.metaDescription || '');
        payload.append(
          'variants',
          JSON.stringify(
            values.variants.map((variant: ProductFormOutput['variants'][number], index: number) => ({
              label: buildVariantLabel(variant.quantity, variant.unit),
              price: variant.price,
              mrp: variant.mrp,
              stock: variant.stock,
              sku: `${slugify(productName || 'product').toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
            })),
          ),
        );

        if (isEdit) {
          payload.append('existingImages', JSON.stringify(existingImages));
          payload.append('removedImagePublicIds', JSON.stringify(removedImagePublicIds));
          if (primaryImagePublicId) {
            payload.append('primaryImagePublicId', primaryImagePublicId);
          }
        }

        newUploads.forEach((upload) => payload.append('images', upload.file));
        if (urlUploads.length) {
          payload.append('imageUrls', JSON.stringify(urlUploads.map((upload) => upload.url)));
        }

        try {
          if (isEdit) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'Unable to save product.');
        }
      })}
      className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Name</label>
              <input {...register('name')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              {errors.name ? <p className="mt-2 text-sm text-rose-600">{errors.name.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Short Description</label>
              <textarea {...register('shortDescription')} className="min-h-[100px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
              {errors.shortDescription ? <p className="mt-2 text-sm text-rose-600">{errors.shortDescription.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Description</label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => <ReactQuill theme="snow" value={field.value} onChange={field.onChange} />}
              />
              {errors.description ? <p className="mt-2 text-sm text-rose-600">{errors.description.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Category</label>
              <select {...register('category')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category ? <p className="mt-2 text-sm text-rose-600">{errors.category.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tags</label>
              <input {...register('tags')} placeholder="insecticide, premium" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Meta Title</label>
              <input {...register('metaTitle')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Meta Description</label>
              <input {...register('metaDescription')} className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-500">Variants</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Pack sizes and pricing</h2>
            </div>
            <button
              type="button"
              onClick={() => append({ quantity: '', unit: 'Liter', price: '', mrp: '', stock: '' })}
              className="inline-flex items-center gap-2 rounded-2xl border border-primary-100 px-4 py-2 text-sm font-bold text-primary-700"
            >
              <PlusCircle size={16} />
              Add Variant
            </button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-[1.5rem] border border-primary-100 bg-primary-50/60 p-4 md:grid-cols-5">
                <div>
                  <input {...register(`variants.${index}.quantity`)} placeholder="Qty" className="w-full rounded-2xl border border-primary-100 bg-white px-3 py-3" />
                  {errors.variants?.[index]?.quantity ? <p className="mt-1 text-xs text-rose-600">{errors.variants[index]?.quantity?.message}</p> : null}
                </div>
                <div>
                  <select {...register(`variants.${index}.unit`)} className="w-full rounded-2xl border border-primary-100 bg-white px-3 py-3">
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors.variants?.[index]?.unit ? <p className="mt-1 text-xs text-rose-600">{errors.variants[index]?.unit?.message}</p> : null}
                </div>
                <div>
                  <input type="number" {...register(`variants.${index}.price`)} placeholder="Price" className="w-full rounded-2xl border border-primary-100 bg-white px-3 py-3" />
                  {errors.variants?.[index]?.price ? <p className="mt-1 text-xs text-rose-600">{errors.variants[index]?.price?.message}</p> : null}
                </div>
                <div>
                  <input type="number" {...register(`variants.${index}.mrp`)} placeholder="MRP" className="w-full rounded-2xl border border-primary-100 bg-white px-3 py-3" />
                  {errors.variants?.[index]?.mrp ? <p className="mt-1 text-xs text-rose-600">{errors.variants[index]?.mrp?.message}</p> : null}
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <input type="number" {...register(`variants.${index}.stock`)} placeholder="Stock" className="w-full rounded-2xl border border-primary-100 bg-white px-3 py-3" />
                    {errors.variants?.[index]?.stock ? <p className="mt-1 text-xs text-rose-600">{errors.variants[index]?.stock?.message}</p> : null}
                  </div>
                  {fields.length > 1 ? (
                    <button type="button" onClick={() => remove(index)} className="rounded-2xl border border-rose-100 px-3 text-rose-600">
                      <MinusCircle size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-500">Image Uploader</p>
          <div
            {...dropzone.getRootProps()}
            className="mt-4 cursor-pointer rounded-[1.5rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-10 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <ImagePlus size={24} className="mx-auto text-primary-500" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Drag product images here or click to upload</p>
            <p className="mt-1 text-xs text-slate-500">Up to 5 images total</p>
          </div>

          <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50/60 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Add image by link</p>
            <div className="mt-2 flex gap-2">
              <input
                value={imageUrlInput}
                onChange={(event) => {
                  setImageUrlInput(event.target.value);
                  if (imageUrlError) setImageUrlError('');
                }}
                placeholder="https://example.com/product-image.jpg"
                className="min-w-0 flex-1 rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white"
              >
                Add URL
              </button>
            </div>
            {imageUrlError ? <p className="mt-2 text-xs text-rose-600">{imageUrlError}</p> : null}
          </div>

          {existingImages.length ? (
            <div className="mt-5 space-y-3">
              {existingImages.map((image, index) => (
                <div key={image.publicId} className="flex items-center gap-3 rounded-2xl border border-primary-100 p-3">
                  <img src={resolveMediaUrl(image.url, image.publicId)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">Existing image {index + 1}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setPrimaryImagePublicId(image.publicId)} className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${primaryImagePublicId === image.publicId ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-700'}`}>
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} />
                          Primary
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExistingImages((current) => {
                            if (index === 0) return current;
                            const copy = [...current];
                            [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
                            return copy;
                          })
                        }
                        className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-700"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExistingImages((current) => {
                            if (index === current.length - 1) return current;
                            const copy = [...current];
                            [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
                            return copy;
                          })
                        }
                        className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-700"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemovedImagePublicIds((current) => [...current, image.publicId]);
                          setExistingImages((current) => current.filter((entry) => entry.publicId !== image.publicId));
                          if (primaryImagePublicId === image.publicId) {
                            setPrimaryImagePublicId('');
                          }
                        }}
                        className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {newUploads.length ? (
            <div className="mt-5 space-y-3">
              {newUploads.map((upload, index) => (
                <div key={upload.id} className="flex items-center gap-3 rounded-2xl border border-primary-100 p-3">
                  <img src={upload.preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{upload.file.name}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setNewUploads((current) => {
                            if (index === 0) return current;
                            const copy = [...current];
                            [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
                            return copy;
                          })
                        }
                        className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-700"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUploads((current) => current.filter((entry) => entry.id !== upload.id))}
                        className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {urlUploads.length ? (
            <div className="mt-5 space-y-3">
              {urlUploads.map((upload, index) => (
                <div key={upload.id} className="flex items-center gap-3 rounded-2xl border border-primary-100 p-3">
                  <img
                    src={upload.url}
                    alt=""
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.opacity = '0.35';
                    }}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{upload.url}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setUrlUploads((current) => {
                            if (index === 0) return current;
                            const copy = [...current];
                            [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
                            return copy;
                          })
                        }
                        className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-700"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setUrlUploads((current) => current.filter((entry) => entry.id !== upload.id))}
                        className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-500">Visibility</p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Featured on storefront</span>
              <input type="checkbox" {...register('isFeatured')} className="h-4 w-4 accent-primary-600" />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Active product</span>
              <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          className="w-full rounded-[1.25rem] bg-primary-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
        {submitError ? <p className="text-sm font-semibold text-rose-600">{submitError}</p> : null}
      </div>
    </form>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const categoriesQuery = useQuery({
    queryKey: ['product-form-categories'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });
  const productQuery = useQuery({
    queryKey: ['admin-product-detail', id],
    queryFn: () => adminApi.productDetail(id!),
    enabled: isEdit,
  });

  if (isEdit && productQuery.isLoading) {
    return <LoadingBlock label="Loading product..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/products" className="rounded-2xl border border-primary-100 bg-white p-3">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Product Management</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
        </div>
      </div>

      <ProductEditor
        key={productQuery.data?.id || (isEdit ? 'loading' : 'new')}
        isEdit={isEdit}
        productId={id}
        product={productQuery.data}
        categories={categoriesQuery.data?.data || []}
      />
    </div>
  );
}
