import express from 'express';
import { getRecommendations, logInteraction } from '../controller/recommendation/controller';

import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.get('/recommendations', authenticateUser, getRecommendations);
router.post('/recommendations/interaction', authenticateUser, logInteraction);

export { router as RecommendationRoutes }