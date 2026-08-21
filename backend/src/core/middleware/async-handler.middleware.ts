import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Higher-Order Async Request Handler Wrapper
 * Eliminates repetitive try/catch blocks in controllers.
 * Reference: CelestiumERP.md Section 1.10
 */

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
