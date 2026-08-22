import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { authService, AuthService } from './auth.service.js';

export class AuthController extends BaseController {
  constructor(private readonly service: AuthService = authService) {
    super();
  }

  public register = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const result = await this.service.register(tenantId, req.body);
    return this.sendCreated(res, result, 'User registered successfully');
  };

  public login = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    };
    const result = await this.service.login(tenantId, req.body, meta);
    return this.sendSuccess(res, result, 'Login successful');
  };

  public refreshToken = async (req: Request, res: Response): Promise<Response> => {
    const { refreshToken } = req.body;
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    };
    const result = await this.service.refreshToken(refreshToken, meta);
    return this.sendSuccess(res, result, 'Tokens refreshed successfully');
  };

  public logout = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const { refreshToken } = req.body;
    await this.service.logout(tenantId, refreshToken);
    return this.sendSuccess(res, null, 'Logged out successfully');
  };

  public forgotPassword = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const result = await this.service.forgotPassword(tenantId, req.body);
    return this.sendSuccess(res, result, result.message);
  };

  public resetPassword = async (req: Request, res: Response): Promise<Response> => {
    const result = await this.service.resetPassword(req.body);
    return this.sendSuccess(res, result, result.message);
  };

  public getMe = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const userId = this.getUser(req).userId;
    const user = await this.service.getCurrentUser(tenantId, userId);
    return this.sendSuccess(res, user, 'Profile retrieved successfully');
  };

  public revokeAllSessions = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const userId = this.getUser(req).userId;
    await this.service.revokeAllSessions(tenantId, userId);
    return this.sendSuccess(res, null, 'All active sessions have been revoked');
  };
}

export const authController = new AuthController();
