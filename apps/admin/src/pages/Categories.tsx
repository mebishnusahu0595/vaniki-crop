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
import type { Category } from '../types/admin';

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  sortOrder: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

type CategoryFormInput = z.input<typeof categorySchema>;
type CategoryFormValues = z.output<typeof categorySchema>;

const categoryDefaultValues: CategoryFormInput = {
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

export default function CategoriesPage() {
  const [editing, setEditing] = useState<Category | null>(null);
  const [actioningCategoryId, setActioningCategoryId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ['admin-categories-screen'],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<
    CategoryFormInput,
    undefined,
    CategoryFormValues
  >({
    resolver: zodResolver(categorySchema),
    defaultValues: categoryDefaultValues,
  });

  useEffect(() => {
    if (!editing) {
      reset(categoryDefaultValues);
      setImageUrlInput('');
      return;
    }

    reset({
      name: editing.name,
      description: editing.description || '',
      sortOrder: editing.sortOrder || 0,
      isActive: editing.isActive,
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

  const previewUrl = filePreviewUrl || imageUrlInput.trim() || editing?.image?.url || '';

  const mutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const payload = new FormData();
      payload.append('name', values.name);
      if (values.description) payload.append('description', values.description);
      if (imageUrlInput.trim()) payload.append('imageUrl', imageUrlInput.trim());
      if (imageFile) payload.append('image', imageFile);
      payload.append('sortOrder', String(values.sortOrder));
      payload.append('isActive', String(values.isActive));
      return editing ? adminApi.updateCategory(editing.id, payload) : adminApi.createCategory(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories-screen'] });
      reset(categoryDefaultValues);
      setEditing(null);
      setImageUrlInput('');
      setImageUrlError('');
      clearFilePreview();
    },
  });

  if (categoriesQuery.isLoading) return <LoadingBlock label="Loading categories..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader title="Categories" subtitle="Create and manage category visibility for the storefront." />
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="mt-6 space-y-4">
          <input {...register('name')} placeholder="Category name" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <textarea {...register('description')} placeholder="Short description" className="min-h-[100px] w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <div
            {...dropzone.getRootProps()}
            className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-8 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <ImagePlus size={22} className="mx-auto text-primary-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Drag category image here or click to upload</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setSelectedImageFile(event.target.files?.[0] || null)}
            className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3"
          />
          <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-3">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Category image URL</label>
            <div className="flex gap-2">
              <input
                value={imageUrlInput}
                onChange={(event) => {
                  setImageUrlInput(event.target.value);
                  if (imageUrlError) setImageUrlError('');
                }}
                placeholder="https://example.com/category.jpg"
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
              <img src={previewUrl} alt="Category preview" className="h-36 w-full object-cover" />
            </div>
          ) : null}
          <input type="number" {...register('sortOrder', { valueAsNumber: true })} placeholder="Sort order" className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3" />
          <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Active category</span>
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 accent-primary-600" />
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white">
              {editing ? 'Update Category' : 'Create Category'}
            </button>
            {editing ? (
              <button type="button" onClick={() => { setEditing(null); reset(categoryDefaultValues); setImageUrlInput(''); setImageUrlError(''); clearFilePreview(); }} className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {categoriesQuery.data?.data.map((category) => (
          <div key={category.id} className="rounded-[1.5rem] border border-primary-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{category.name}</p>
                <p className="mt-1 text-sm text-slate-500">{category.description || 'No description'}</p>
              </div>
              <button
                onClick={() => setEditing(category)}
                className="rounded-xl border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700"
              >
                Edit
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={category.isActive ? 'text-emerald-700' : 'text-slate-500'}>
                {category.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={async () => {
                    const nextState = !category.isActive;
                    const actionLabel = nextState ? 'activate' : 'deactivate';
                    if (!window.confirm(`${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${category.name}?`)) return;

                    setActioningCategoryId(category.id);
                    try {
                      const updatedCategory = await adminApi.toggleCategoryActive(category.id, nextState);
                      queryClient.setQueryData(['admin-categories-screen'], (current: { data: Category[]; pagination?: unknown } | undefined) => {
                        if (!current?.data) return current;
                        return {
                          ...current,
                          data: current.data.map((entry) => (entry.id === updatedCategory.id ? updatedCategory : entry)),
                        };
                      });
                      queryClient.invalidateQueries({ queryKey: ['admin-categories-screen'] });
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : `Unable to ${actionLabel} category.`);
                    } finally {
                      setActioningCategoryId(null);
                    }
                  }}
                  disabled={actioningCategoryId === category.id}
                  className={`text-sm font-semibold ${category.isActive ? 'text-rose-600' : 'text-emerald-700'}`}
                >
                  {category.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={async () => {
                    if (category.isActive) {
                      window.alert('Deactivate category first, then delete permanently.');
                      return;
                    }

                    if (!window.confirm(`Delete ${category.name} permanently? This cannot be undone.`)) return;
                    setActioningCategoryId(category.id);
                    try {
                      await adminApi.permanentlyDeleteCategory(category.id);
                      queryClient.setQueryData(['admin-categories-screen'], (current: { data: Category[]; pagination?: unknown } | undefined) => {
                        if (!current?.data) return current;
                        return {
                          ...current,
                          data: current.data.filter((entry) => entry.id !== category.id),
                        };
                      });
                      queryClient.invalidateQueries({ queryKey: ['admin-categories-screen'] });
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : 'Unable to delete category permanently.');
                    } finally {
                      setActioningCategoryId(null);
                    }
                  }}
                  disabled={actioningCategoryId === category.id}
                  className="text-sm font-semibold text-slate-700"
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
