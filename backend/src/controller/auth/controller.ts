import { Request, Response } from 'express';
import { AuthService } from '../../services/auth/service';
import { UserRole } from '../../models/user';
// import { validateRequest } from '../utils/validation';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      // validateRequest(req);

      const { name, email, password, businessName, role } = req.body;
      
      const { user, token, business } = await AuthService.register(
        name,
        email,
        password,
        businessName,
        role || UserRole.USER
      );

      res.status(201).json({
        success: true,
        data: { user, business },
        token,
        message: 'Registration successful'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      // validateRequest(req);

      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);

      res.json({
        success: true,
        data: user,
        token,
        message: 'Login successful'
      });
    } catch (error: any) {
      console.log(error);
      res.status(401).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  static async me(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token provided');

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