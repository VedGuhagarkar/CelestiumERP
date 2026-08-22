import { Router } from 'express';
import { searchController } from './search.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { querySearchSchema } from './search.validator.js';

export const searchRouter = Router();

searchRouter.use(authenticateJwt);

searchRouter.get(
  '/',
  validateRequest({ query: querySearchSchema }),
  searchController.globalSearch
);

searchRouter.get('/quick-actions', searchController.getQuickActions);

searchRouter.get('/suggestions', searchController.getSuggestions);
