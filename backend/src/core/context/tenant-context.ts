import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  userRoles?: string[];
  correlationId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * TenantContextHolder
 * Provides thread-safe / asynchronous request-scoped tenant context tracking
 * using Node.js AsyncLocalStorage.
 *
 * ARCHITECTURAL CONTRACT:
 * - Automatically populated by tenantMiddleware during HTTP request lifecycle.
 * - Accessible by services and repositories for invariant validation.
 * - Guarantees tenant isolation even across asynchronous promise chains.
 */
export class TenantContextHolder {
  /**
   * Runs an asynchronous callback inside a dedicated tenant context
   */
  public static run<R>(context: TenantContext, callback: () => R): R {
    return tenantStorage.run(context, callback);
  }

  /**
   * Retrieves the active tenant context
   */
  public static getContext(): TenantContext | undefined {
    return tenantStorage.getStore();
  }

  /**
   * Retrieves the current tenantId or undefined if outside request scope
   */
  public static getTenantId(): string | undefined {
    return tenantStorage.getStore()?.tenantId;
  }

  /**
   * Retrieves current tenantId or throws an error if missing
   */
  public static getRequiredTenantId(): string {
    const tenantId = TenantContextHolder.getTenantId();
    if (!tenantId) {
      throw new Error('FATAL: Tenant context is required but was not found in AsyncLocalStorage');
    }
    return tenantId;
  }
}
