import { Router } from 'express';
import { upload } from '../../middleware/upload.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as cropController from './crop.controller.js';
import { validate, createCropSchema, updateCropSchema, toggleCropSchema } from './crop.validator.js';

// ─── Public Routes ────────────────────────────────────────────────────────
export const cropPublicRouter = Router();
cropPublicRouter.get('/', cropController.listActiveCrops);
cropPublicRouter.get('/:slug', cropController.getCropBySlug);

// ─── Superadmin Routes ────────────────────────────────────────────────────
export const cropSuperadminRouter = Router();
cropSuperadminRouter.use(requireAuth, requireSuperAdmin);

cropSuperadminRouter.get('/', cropController.listAllCrops);
cropSuperadminRouter.post(
  '/',
  upload.single('image'),
  validate(createCropSchema),
  cropController.createCrop,
);
cropSuperadminRouter.put(
  '/:id',
  upload.single('image'),
  validate(updateCropSchema),
  cropController.updateCrop,
);
cropSuperadminRouter.patch(
  '/:id/toggle-active',
  validate(toggleCropSchema),
  cropController.toggleCropActive,
);
cropSuperadminRouter.delete('/:id', cropController.deleteCrop);
