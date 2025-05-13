// import { HybridRecommendationEngine } from './ai/hybridModel';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { Logger } from '../../utils/logger';

export class RecommendationService {
  // private engine: HybridRecommendationEngine;

  constructor() {
    // this.engine = new HybridRecommendationEngine();
    this.initializeEngine();
  }

  private async initializeEngine(): Promise<void> {
    try {
      await this.engine.initialize();
    } catch (error) {
      Logger.error('Failed to initialize recommendation engine:', error);
    }
  }

  public async getRecommendationsForUser(
    userId: string,
    limit: number = 10
  ): Promise<typeof Content[]> {
    try {
      const recommendations = await this.engine.recommendForUser(userId, limit);
      
      // Log the recommendation event
      await Interaction.create({
        userId,
        contentId: null, // Or log each recommended content ID
        interactionType: 'recommendation',
        metadata: {
          recommendedItems: recommendations.map((r: any) => r._id),
          modelVersion: 'hybrid-v1'
        }
      });

      return recommendations;
    } catch (error) {
      Logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  public async logInteraction(
    userId: string,
    contentId: string,
    interactionType: string,
    duration?: number
  ): Promise<void> {
    await Interaction.create({
      userId,
      contentId,
      interactionType,
      duration
    });
    
    // Optionally trigger model retraining if needed
    // this.retrainModelIfNeeded();
  }
}