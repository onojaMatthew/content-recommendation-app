import express from 'express';

import { authenticateUser } from '../middleware/auth';
import { getAnalytics } from '../controller/analytics/controller';

const router = express.Router();

router.get('/analytics', authenticateUser, getAnalytics);

export { router as AnalyticsRoutes }