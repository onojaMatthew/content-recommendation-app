import express from 'express';
import { getRecommendations, logInteraction } from '../controller/recommendation/controller';

import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/recommendations', protect, getRecommendations);
router.post('/recommendations/interaction', protect, logInteraction);

export { router as RecommendationRoutes }