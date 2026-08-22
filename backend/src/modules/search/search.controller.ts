import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { searchService, SearchService, IActorSearchContext } from './search.service.js';

export class SearchController extends BaseController {
  constructor(private readonly service: SearchService = searchService) {
    super();
  }

  private getActorSearchContext(req: Request): IActorSearchContext {
    const user = this.getUser(req);
    return {
      userId: user.userId,
      roles: user.roles || [],
      permissions: user.permissions || (req as any).userPermissions || []
    };
  }

  public globalSearch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorSearchContext(req);
      const result = await this.service.search(tenantId, actor, req.query as any);
      this.sendSuccess(res, result, `Found ${result.totalResults} results`);
    } catch (error) {
      next(error);
    }
  };

  public getQuickActions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actor = this.getActorSearchContext(req);
      const actions = this.service.getQuickActionsForActor(actor);
      this.sendSuccess(res, actions);
    } catch (error) {
      next(error);
    }
  };

  public getSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const suggestions = this.service.getSuggestionsForQuery(query);
      this.sendSuccess(res, suggestions);
    } catch (error) {
      next(error);
    }
  };
}

export const searchController = new SearchController();
