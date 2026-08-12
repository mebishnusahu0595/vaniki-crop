import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Sprout, Search, X } from 'lucide-react';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { adminApi } from '../utils/api';
import { resolveMediaUrl } from '../utils/media';
import type { Crop, CropSection, Product } from '../types/admin';

// ─── Section Editor ──────────────────────────────────────────────────────

interface SectionEditorProps {
  sections: Omit<CropSection, 'id'>[];
  onChange: (sections: Omit<CropSection, 'id'>[]) => void;
}

function SectionEditor({ sections, onChange }: SectionEditorProps) {
  const addSection = () => {
    onChange([...sections, { title: '', body: '', sortOrder: sections.length }]);
  };

  const updateSection = (index: number, field: 'title' | 'body', value: string) => {
    const next = sections.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(next);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const next = [...sections];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    onChange(next.map((s, i) => ({ ...s, sortOrder: i })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Crop Sections ({sections.length})
        </label>
        <button
          type="button"
          onClick={addSection}
          className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-primary-600 transition"
        >
          <Plus size={12} /> Add Section
        </button>
      </div>

      {sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/50 p-6 text-center">
          <p className="text-xs text-slate-500">No sections yet. Add sections like "Usage Guide", "Pest Control", etc.</p>
        </div>
      )}

      {sections.map((section, index) => (
        <div key={index} className="rounded-2xl border border-primary-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
            <input
              value={section.title}
              onChange={(e) => updateSection(index, 'title', e.target.value)}
              placeholder={`Section ${index + 1} title (e.g. "Pest Control Guide")`}
              className="min-w-0 flex-1 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveSection(index, 'up')}
                disabled={index === 0}
                className="rounded-lg border border-primary-100 p-1.5 text-primary-500 disabled:opacity-30 hover:bg-primary-50 transition"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => moveSection(index, 'down')}
                disabled={index === sections.length - 1}
                className="rounded-lg border border-primary-100 p-1.5 text-primary-500 disabled:opacity-30 hover:bg-primary-50 transition"
              >
                <ChevronDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => removeSection(index)}
                className="rounded-lg border border-rose-100 p-1.5 text-rose-500 hover:bg-rose-50 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <textarea
            value={section.body}
            onChange={(e) => updateSection(index, 'body', e.target.value)}
            placeholder="Section content / description..."
            rows={3}
            className="w-full rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Product Picker ───────────────────────────────────────────────────────

interface ProductPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  products: Product[];
}

function ProductPicker({ selected, onChange, products }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Suggested Products ({selected.length} selected)
      </label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-xl border border-primary-100 bg-primary-50 pl-8 pr-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1 rounded-2xl border border-primary-100 bg-primary-50/30 p-2">
        {filtered.length === 0 && (
          <p className="p-3 text-center text-xs text-slate-400">No products found</p>
        )}
        {filtered.map((p) => {
          const isSelected = selected.includes(p.id);
          const img = p.images?.[0];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                isSelected
                  ? 'bg-primary-100 ring-1 ring-primary-400'
                  : 'bg-white hover:bg-primary-50'
              }`}
            >
              {img ? (
                <img
                  src={resolveMediaUrl(img.url, img.publicId)}
                  alt={p.name}
                  className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary-100 flex-shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800 truncate">{p.name}</span>
              {isSelected && (
                <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-black text-white">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: Omit<CropSection, 'id'>[] = [];

export default function CropsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Crop | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<Omit<CropSection, 'id'>[]>(DEFAULT_SECTIONS);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const imageBlobRef = useRef<string>('');

  const cropsQuery = useQuery({
    queryKey: ['super-admin-crops'],
    queryFn: adminApi.crops,
  });

  const productsQuery = useQuery({
    queryKey: ['crops-product-picker'],
    queryFn: () => adminApi.products({ limit: 500, isActive: 'true' }),
  });

  const products: Product[] = productsQuery.data?.data ?? [];
  const crops: Crop[] = cropsQuery.data ?? [];

  // ── Populate form when editing ───────────────────────────────────────
  useEffect(() => {
    if (!editing) {
      resetForm();
      return;
    }
    setName(editing.name);
    setShortDescription(editing.shortDescription);
    setDescription(editing.description ?? '');
    setSections(
      (editing.sections ?? []).map((s) => ({
        title: s.title,
        body: s.body,
        sortOrder: s.sortOrder,
      })),
    );
    setSelectedProductIds(
      (editing.suggestedProductIds ?? []).map((p: any) =>
        typeof p === 'string' ? p : p.id ?? '',
      ),
    );
    setIsActive(editing.isActive);
    setSortOrder(editing.sortOrder ?? 0);
    setImageFile(null);
    setImagePreview(editing.image?.url ? resolveMediaUrl(editing.image.url, editing.image.publicId) : '');
  }, [editing]);

  // ── Blob cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (imageBlobRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(imageBlobRef.current);
      }
    };
  }, []);

  function setSelectedImage(file: File | null) {
    if (imageBlobRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(imageBlobRef.current);
    }
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      imageBlobRef.current = url;
      setImagePreview(url);
    } else {
      imageBlobRef.current = '';
      setImagePreview('');
    }
  }

  function resetForm() {
    setName('');
    setShortDescription('');
    setDescription('');
    setSections([]);
    setSelectedProductIds([]);
    setIsActive(true);
    setSortOrder(0);
    setSelectedImage(null);
    setEditing(null);
  }

  const dropzone = useDropzone({
    multiple: false,
    accept: { 'image/*': [] },
    onDrop: (files) => setSelectedImage(files[0] || null),
  });

  // ── Mutations ────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.toggleCropActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin-crops'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCrop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['super-admin-crops'] }),
  });

  // ── Submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && !imageFile) {
      alert('Please upload a crop image');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('shortDescription', shortDescription.trim());
      fd.append('description', description.trim());
      fd.append('sections', JSON.stringify(sections));
      fd.append('suggestedProductIds', JSON.stringify(selectedProductIds));
      fd.append('isActive', String(isActive));
      fd.append('sortOrder', String(sortOrder));
      if (imageFile) fd.append('image', imageFile);

      if (editing) {
        await adminApi.updateCrop(editing.id, fd);
      } else {
        await adminApi.createCrop(fd);
      }

      await queryClient.invalidateQueries({ queryKey: ['super-admin-crops'] });
      resetForm();
    } catch (err: any) {
      alert(err?.message || 'Failed to save crop');
    } finally {
      setSubmitting(false);
    }
  }

  if (cropsQuery.isLoading) return <LoadingBlock label="Loading crops..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      {/* ── Left: Form ────────────────────────────────────────────── */}
      <div className="rounded-[1.75rem] border border-primary-100 bg-white p-5">
        <PageHeader
          title={editing ? `Edit: ${editing.name}` : 'Add Crop'}
          subtitle="Manage crops with image, sections and suggested products."
        />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Crop Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paddy, Wheat, Sugarcane"
              required
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Short Description *
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief description shown on the crop card"
              required
              rows={2}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>

          {/* Full Description */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Full Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description for the crop detail page"
              rows={3}
              className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Crop Image {editing ? '(leave empty to keep current)' : '*'}
            </label>
            <div
              {...dropzone.getRootProps()}
              className="cursor-pointer rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50 px-4 py-7 text-center hover:bg-primary-100 transition"
            >
              <input {...dropzone.getInputProps()} />
              <ImagePlus size={24} className="mx-auto text-primary-400" />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Drag & drop crop image, or click to select
              </p>
              <p className="mt-1 text-xs text-slate-400">JPEG, PNG, or WebP · max 5MB</p>
            </div>

            {/* Also allow file input */}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
              className="mt-2 w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm text-slate-600"
            />

            {imagePreview && (
              <div className="mt-3 relative rounded-2xl overflow-hidden border border-primary-100 bg-white">
                <img src={imagePreview} alt="Crop preview" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-600 hover:bg-white shadow"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Sections */}
          <SectionEditor sections={sections} onChange={setSections} />

          {/* Product Picker */}
          <ProductPicker
            selected={selectedProductIds}
            onChange={setSelectedProductIds}
            products={products}
          />

          {/* Sort Order + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 cursor-pointer">
              <span className="text-sm font-semibold text-slate-700">Active</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-primary-600"
              />
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-primary-600 transition disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editing ? 'Update Crop' : 'Add Crop'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-primary-100 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-primary-50 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Right: Crop List ─────────────────────────────────────── */}
      <div className="space-y-4">
        {crops.length === 0 && (
          <div className="rounded-[1.75rem] border border-primary-100 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <Sprout size={28} className="text-primary-400" />
            </div>
            <p className="text-lg font-black text-slate-800">No crops yet</p>
            <p className="mt-1 text-sm text-slate-500">Add your first crop using the form on the left.</p>
          </div>
        )}

        {crops.map((crop) => {
          const suggestedProducts = (crop.suggestedProductIds ?? []).filter(
            (p): p is Product => typeof p === 'object' && p !== null,
          );

          return (
            <div key={crop.id} className="rounded-[1.5rem] border border-primary-100 bg-white overflow-hidden">
              {/* Image + Info Row */}
              <div className="flex gap-4 p-4">
                {crop.image?.url ? (
                  <img
                    src={resolveMediaUrl(crop.image.url, crop.image.publicId)}
                    alt={crop.name}
                    className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 border border-primary-100"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-primary-100 flex-shrink-0 flex items-center justify-center">
                    <Sprout size={24} className="text-primary-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-slate-900">{crop.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 leading-5 line-clamp-2">
                        {crop.shortDescription}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing(crop)}
                      className="flex-shrink-0 rounded-xl border border-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 transition"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {crop.sections?.length ?? 0} sections
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {crop.suggestedProductIds?.length ?? 0} products
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                        crop.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {crop.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggested products preview */}
              {suggestedProducts.length > 0 && (
                <div className="border-t border-primary-50 px-4 py-2">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Suggested Products
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedProducts.slice(0, 6).map((p) => (
                      <span
                        key={p.id}
                        className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[10px] font-semibold text-primary-700 border border-primary-100"
                      >
                        {p.name}
                      </span>
                    ))}
                    {suggestedProducts.length > 6 && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        +{suggestedProducts.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 border-t border-primary-50 px-4 py-2.5">
                <button
                  onClick={() => toggleMutation.mutate({ id: crop.id, isActive: !crop.isActive })}
                  className="rounded-xl border border-primary-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-primary-50 transition"
                >
                  {crop.isActive ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete crop "${crop.name}"? This cannot be undone.`)) return;
                    deleteMutation.mutate(crop.id);
                  }}
                  className="rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
