import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { RecipeModel, RecipeDocument } from './recipe.model.js';
import { RecipeFilterQuery } from './recipe.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IRecipeRepository extends IBaseRepository<RecipeDocument> {
  findByCodeAndRevision(tenantId: string, recipeCode: string, revision: number): Promise<RecipeDocument | null>;
  findLatestActiveRevision(tenantId: string, recipeCode: string): Promise<RecipeDocument | null>;
  findHighestRevision(tenantId: string, recipeCode: string): Promise<RecipeDocument | null>;
  searchRecipes(
    tenantId: string,
    filters: RecipeFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<RecipeDocument>>;
  supersedePreviousRevisions(tenantId: string, recipeCode: string, currentRevision: number): Promise<void>;
  incrementJobCounters(tenantId: string, recipeId: string, delta: number): Promise<RecipeDocument | null>;
}

export class RecipeRepository extends BaseRepository<RecipeDocument> implements IRecipeRepository {
  constructor() {
    super(RecipeModel);
  }

  public async findByCodeAndRevision(
    tenantId: string,
    recipeCode: string,
    revision: number
  ): Promise<RecipeDocument | null> {
    return this.findOne(tenantId, {
      recipeCode: recipeCode.toUpperCase(),
      revision
    });
  }

  public async findLatestActiveRevision(tenantId: string, recipeCode: string): Promise<RecipeDocument | null> {
    return this.findOne(
      tenantId,
      {
        recipeCode: recipeCode.toUpperCase(),
        status: 'ACTIVE'
      },
      undefined,
      { sort: { revision: -1 } }
    );
  }

  public async findHighestRevision(tenantId: string, recipeCode: string): Promise<RecipeDocument | null> {
    return this.findOne(
      tenantId,
      { recipeCode: recipeCode.toUpperCase() },
      undefined,
      { sort: { revision: -1 } }
    );
  }

  public async searchRecipes(
    tenantId: string,
    filters: RecipeFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<RecipeDocument>> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { recipeCode: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
        { applicableMaterialGrades: searchRegex }
      ];
    }

    if (filters.processFamily) {
      query.processFamily = filters.processFamily;
    }

    if (filters.materialGrade) {
      query.applicableMaterialGrades = new RegExp(filters.materialGrade, 'i');
    }

    if (filters.status) {
      query.status = filters.status;
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async supersedePreviousRevisions(
    tenantId: string,
    recipeCode: string,
    currentRevision: number
  ): Promise<void> {
    await this.model.updateMany(
      this.withTenant(tenantId, {
        recipeCode: recipeCode.toUpperCase(),
        revision: { $lt: currentRevision },
        status: { $in: ['APPROVED', 'ACTIVE'] }
      }),
      {
        $set: {
          status: 'SUPERSEDED',
          effectiveTo: new Date()
        }
      }
    );
  }

  public async incrementJobCounters(
    tenantId: string,
    recipeId: string,
    delta: number
  ): Promise<RecipeDocument | null> {
    return this.updateById(tenantId, recipeId, {
      $inc: { referencedJobCount: delta }
    });
  }
}

export const recipeRepository = new RecipeRepository();
