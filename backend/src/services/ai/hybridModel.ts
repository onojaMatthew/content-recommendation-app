import { CollaborativeFiltering } from './collaborativeFiltering';
import { ContentBasedFiltering } from './contentBased';
import { Content } from '../../models/content';
import { Logger } from '../../utils/logger';
import { IContent } from '../../types/content.types';

export class HybridRecommendationEngine {
  private cfModel: CollaborativeFiltering;
  private cbModel: ContentBasedFiltering;

  constructor() {
    this.cfModel = new CollaborativeFiltering();
    this.cbModel = new ContentBasedFiltering();
  }

  public async initialize(): Promise<void> {
    await Promise.all([
      this.cfModel.train(),
      this.cbModel.train()
    ]);
    Logger.info('Hybrid recommendation engine initialized');
  }

  private combineAndRankRecommendations(
    cfRecommendations: string[], // Collaborative filtering recommendations (content IDs)
    cbRecommendations: string[]  // Content-based recommendations (content IDs)
  ): string[] {
    // Create a map to track scores
    const recommendationScores = new Map<string, number>();

    // Assign scores from collaborative filtering (higher weight)
    cfRecommendations.forEach((contentId, index) => {
      const score = cfRecommendations.length - index; // Higher score for earlier positions
      recommendationScores.set(contentId, (recommendationScores.get(contentId) || 0) + score * 0.6);
    });

    // Assign scores from content-based (lower weight)
    cbRecommendations.forEach((contentId, index) => {
      const score = cbRecommendations.length - index;
      recommendationScores.set(contentId, (recommendationScores.get(contentId) || 0) + score * 0.4);
    });

    // Convert to array and sort by score
    return Array.from(recommendationScores.entries())
      .sort((a, b) => b[1] - a[1]) // Sort descending by score
      .map(([contentId]) => contentId); // Return just the IDs
  }

  public async recommendForUser(
    userId: string,
    limit: number = 10
  ): Promise<IContent[]> {
    try {
      // Get recommendations from both models
      const [cfRecs, cbRecs] = await Promise.all([
        this.cfModel.recommendForUser(userId, limit * 2),
        this.cbModel.recommendForUser(userId, limit * 2)
      ]);

      // Combine and re-rank results
      const combinedRecommendations = this.combineAndRankRecommendations(cfRecs, cbRecs);
      
      // Fetch full content documents
      const contentItems = await Content.find({
        _id: { $in: combinedRecommendations.slice(0, limit) }
      }).lean();

      return contentItems as IContent[];
    } catch (error) {
      Logger.error('Error in recommendForUser:', error);
      throw error;
    }
  }
}