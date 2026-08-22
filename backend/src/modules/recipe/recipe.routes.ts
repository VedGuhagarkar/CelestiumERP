import { Router } from 'express';
import { recipeController } from './recipe.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createRecipeSchema,
  updateRecipeSchema,
  approveRecipeSchema,
  rejectRecipeSchema,
  queryRecipeSchema
} from './recipe.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const recipeRouter = Router();

// Search & List Recipes
recipeRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_VIEW),
  validateRequest(queryRecipeSchema),
  asyncHandler(recipeController.searchRecipes)
);

// Register New Recipe (DRAFT)
recipeRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_CREATE),
  validateRequest(createRecipeSchema),
  asyncHandler(recipeController.createRecipe)
);

// Retrieve Latest Active Recipe Revision
recipeRouter.get(
  '/latest/:code',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_VIEW),
  asyncHandler(recipeController.getLatestActiveRecipe)
);

// Retrieve Recipe by Code and Revision Number
recipeRouter.get(
  '/code/:code/revision/:revision',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_VIEW),
  asyncHandler(recipeController.getRecipeByCodeAndRevision)
);

// Retrieve Recipe by ID
recipeRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_VIEW),
  asyncHandler(recipeController.getRecipeById)
);

// Update Recipe in DRAFT Status
recipeRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_UPDATE),
  validateRequest(updateRecipeSchema),
  asyncHandler(recipeController.updateRecipe)
);

// Submit Recipe for Metallurgical Approval
recipeRouter.post(
  '/:id/submit-approval',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_UPDATE),
  asyncHandler(recipeController.submitForApproval)
);

// Approve and Release Recipe Revision (Metallurgist / Admin)
recipeRouter.post(
  '/:id/approve',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_APPROVE),
  validateRequest(approveRecipeSchema),
  asyncHandler(recipeController.approveRecipe)
);

// Reject Recipe
recipeRouter.post(
  '/:id/reject',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_APPROVE),
  validateRequest(rejectRecipeSchema),
  asyncHandler(recipeController.rejectRecipe)
);

// Create New Revision from Existing Recipe
recipeRouter.post(
  '/:id/new-revision',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_CREATE),
  asyncHandler(recipeController.createNewRevision)
);

// Retire Recipe Revision
recipeRouter.post(
  '/:id/retire',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_RECIPE_APPROVE),
  asyncHandler(recipeController.retireRecipe)
);
