import { Request, Response } from 'express';
import { RecommendationService } from '../../services/recommendation/service';
import { ContentService } from '../../services/content/service';
import { Logger } from '../../utils/logger';
// import { validateRequest } from '../utils/validation';

const recommendationService = new RecommendationService();
const contentService = new ContentService();

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    // validateRequest(req);

    const recommendations = await recommendationService.getRecommendationsForUser(
      userId,
      Number(limit)
    );

    // Enrich content data
    const enrichedRecs = await Promise.all(
      recommendations.map(async (rec: any) => {
        const enriched = await contentService.enrichContentData(rec);
        return enriched;
      })
    );

    res.json({
      success: true,
      message: 'Recommendations fetched successfully',
      data: enrichedRecs,
    });
  } catch (error) {
    Logger.error('Error in getRecommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
      data: null
    });
  }
};

export const logInteraction = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const { contentId, interactionType, duration } = req.body;

    // validateRequest(req);

    await recommendationService.logInteraction(
      userId,
      contentId,
      interactionType,
      duration
    );

    res.json({
      success: true,
      message: 'Interaction logged successfully'
    });
  } catch (error) {
    Logger.error('Error in logInteraction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log interaction',
      data: null
    });
  }
};