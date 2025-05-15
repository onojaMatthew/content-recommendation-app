import { Router } from 'express';
import { AuthController } from '../controller/auth/controller';

const router = Router();

router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.get('/auth/me', AuthController.me);

export { router as AuthRoutes };