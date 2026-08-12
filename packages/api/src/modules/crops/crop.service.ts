import mongoose from 'mongoose';
import { Crop } from '../../models/Crop.model.js';
import { AppError } from '../../utils/AppError.js';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../../utils/cloudinary.helpers.js';
import type { CreateCropInput, UpdateCropInput } from './crop.validator.js';

// ─── Slug Generator ───────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;

  while (true) {
    const filter: Record<string, any> = { slug };
    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await Crop.findOne(filter).select('_id');
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
}

// ─── Public ───────────────────────────────────────────────────────────────

export async function listActiveCrops() {
  const crops = await Crop.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select('name slug shortDescription image isActive sortOrder');
  return crops.map((c) => c.toJSON());
}

export async function getCropBySlug(slug: string) {
  const crop = await Crop.findOne({ slug, isActive: true })
    .populate('suggestedProductIds', 'name slug shortDescription images variants category isActive');

  if (!crop) throw new AppError('Crop not found', 404);
  return crop.toJSON();
}

// ─── Superadmin ───────────────────────────────────────────────────────────

export async function listAllCrops() {
  const crops = await Crop.find()
    .sort({ sortOrder: 1, createdAt: -1 })
    .populate('suggestedProductIds', 'name slug images variants');
  return crops.map((c) => c.toJSON());
}

export async function createCrop(input: CreateCropInput, file?: Express.Multer.File) {
  if (!file) throw new AppError('Crop image is required', 400);

  const uploaded = await uploadToCloudinary(file.buffer, 'vaniki/crops');
  const slug = await ensureUniqueSlug(toSlug(input.name));

  const crop = await Crop.create({
    name: input.name,
    slug,
    shortDescription: input.shortDescription,
    description: input.description || '',
    image: { url: uploaded.url, publicId: uploaded.publicId },
    sections: (input.sections || []).map((s, i) => ({ ...s, sortOrder: i })),
    suggestedProductIds: (input.suggestedProductIds || []).map(
      (id: string) => new mongoose.Types.ObjectId(id),
    ),
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  });

  return crop.toJSON();
}

export async function updateCrop(
  cropId: string,
  input: UpdateCropInput,
  file?: Express.Multer.File,
) {
  const crop = await Crop.findById(cropId);
  if (!crop) throw new AppError('Crop not found', 404);

  if (input.name && input.name !== crop.name) {
    const newSlug = await ensureUniqueSlug(toSlug(input.name), cropId);
    crop.slug = newSlug;
    crop.name = input.name;
  }

  if (input.shortDescription !== undefined) crop.shortDescription = input.shortDescription;
  if (input.description !== undefined) crop.description = input.description;
  if (input.isActive !== undefined) crop.isActive = input.isActive;
  if (input.sortOrder !== undefined) crop.sortOrder = input.sortOrder;

  if (input.sections !== undefined) {
    crop.sections = input.sections.map((s: any, i: number) => ({ ...s, sortOrder: i })) as any;
  }

  if (input.suggestedProductIds !== undefined) {
    crop.suggestedProductIds = (input.suggestedProductIds as string[]).map(
      (id: string) => new mongoose.Types.ObjectId(id),
    ) as any;
  }

  if (file) {
    // Delete old image
    if (crop.image?.publicId) {
      await deleteFromCloudinary(crop.image.publicId);
    }
    const uploaded = await uploadToCloudinary(file.buffer, 'vaniki/crops');
    crop.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await crop.save();
  return crop.toJSON();
}

export async function toggleCropActive(cropId: string, isActive: boolean) {
  const crop = await Crop.findByIdAndUpdate(cropId, { isActive }, { new: true });
  if (!crop) throw new AppError('Crop not found', 404);
  return crop.toJSON();
}

export async function deleteCrop(cropId: string): Promise<void> {
  const crop = await Crop.findById(cropId);
  if (!crop) throw new AppError('Crop not found', 404);

  if (crop.image?.publicId) {
    await deleteFromCloudinary(crop.image.publicId);
  }

  await Crop.deleteOne({ _id: crop._id });
}
