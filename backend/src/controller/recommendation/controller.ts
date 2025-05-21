import { NextFunction, Request, Response } from 'express';
import { RecommendationService } from '../../services/recommendation/service';
import { ContentService } from '../../services/content/service';
import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/errorHandler';

const recommendationService = new RecommendationService();
const contentService = new ContentService();

export const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const recommendations = await recommendationService.getRecommendationsForUser(
      userId,
      Number(limit)
    );

    // Enrich content data
    const enrichedRecs = await Promise.all(
      recommendations.map(async (rec) => {
        const enriched = await contentService.enrichContentData(rec);
        return enriched;
      })
    );

    res.json({
      success: true,
      data: enrichedRecs,
      message: 'Recommendations fetched successfully'
    });
  } catch (error) {
    Logger.error('Error in getRecommendations:', error);
    next(new AppError("Internal Server error", 500));
    
  }
};

export const logInteraction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user._id;
    const { contentId, interactionType, duration, value } = req.body;

    await recommendationService.logInteraction(
      userId,
      contentId,
      interactionType,
      duration, 
      value,
    );

    res.json({
      success: true,
      message: 'Interaction logged successfully'
    });
  } catch (error) {
    Logger.error('Error in logInteraction:', error);
    next(new AppError("Internal Server Error", 500));
  }
};