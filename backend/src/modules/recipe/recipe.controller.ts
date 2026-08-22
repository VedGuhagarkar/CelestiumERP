import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { recipeService, RecipeService } from './recipe.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class RecipeController extends BaseController {
  constructor(private readonly service: RecipeService = recipeService) {
    super();
  }

  private getActorContext(req: Request): ActorContext {
    const user = this.getUser(req);
    return {
      userId: user.userId,
      email: user.email,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      correlationId: (req.headers['x-correlation-id'] as string) || undefined
    };
  }

  public createRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const recipe = await this.service.createRecipe(tenantId, req.body, actor);
    return this.sendCreated(res, recipe, 'Heat-treatment recipe created in DRAFT status');
  };

  public getRecipeById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const recipe = await this.service.getRecipeById(tenantId, id);
    return this.sendSuccess(res, recipe, 'Recipe retrieved successfully');
  };

  public getRecipeByCodeAndRevision = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const revision = parseInt(req.params.revision as string, 10);
    const recipe = await this.service.getRecipeByCodeAndRevision(tenantId, code, revision);
    return this.sendSuccess(res, recipe, 'Recipe revision retrieved successfully');
  };

  public getLatestActiveRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const recipe = await this.service.getLatestActiveRecipe(tenantId, code);
    return this.sendSuccess(res, recipe, 'Latest active recipe retrieved successfully');
  };

  public updateRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const recipe = await this.service.updateRecipe(tenantId, id, req.body, actor);
    return this.sendSuccess(res, recipe, 'Recipe updated successfully');
  };

  public submitForApproval = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const recipe = await this.service.submitForApproval(tenantId, id, actor);
    return this.sendSuccess(res, recipe, 'Recipe submitted for metallurgical approval');
  };

  public approveRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const recipe = await this.service.approveRecipe(tenantId, id, req.body, actor);
    return this.sendSuccess(res, recipe, 'Recipe approved and released for production');
  };

  public rejectRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const recipe = await this.service.rejectRecipe(tenantId, id, req.body, actor);
    return this.sendSuccess(res, recipe, 'Recipe rejected back to DRAFT status');
  };

  public createNewRevision = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const newRevision = await this.service.createNewRevision(tenantId, id, actor);
    return this.sendCreated(res, newRevision, 'New recipe revision created in DRAFT status');
  };

  public retireRecipe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const recipe = await this.service.retireRecipe(tenantId, id, actor);
    return this.sendSuccess(res, recipe, 'Recipe retired successfully');
  };

  public searchRecipes = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      processFamily: req.query.processFamily as any,
      materialGrade: req.query.materialGrade as string,
      status: req.query.status as any
    };

    const result = await this.service.searchRecipes(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Recipes retrieved successfully'
    );
  };
}

export const recipeController = new RecipeController();
