import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../services/auth/service';
import { UserRole } from '../../models/user';
import { AppError } from '../../utils/errorHandler';
import { Logger } from '../../utils/logger';
// import { validateRequest } from '../utils/validation';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, businessName, role } = req.body;
      const { user, token, business } = await AuthService.register(
        name,
        email,
        password,
        businessName
      );

      res.status(201).json({
        success: true,
        data: { user, business, token },
        message: 'Registration successful'
      });
    } catch (error: any) {
      return next(new AppError("Log in request failed", 500));
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { user, token, business } = await AuthService.login(email, password);
      res.json({
        success: true,
        data: {user, token, business},
        message: 'Login successful'
      });
    } catch (error: any) {
      Logger.error(error.message)
      return next(new AppError("Log in request failed", 500));
      
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return next(new AppError("No token provided", 401))

      const { user } = await AuthService.verifyToken(token);

      res.json({
        success: true,
        data: user,
        message: 'User retrieved successfully'
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }
}