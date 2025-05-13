
import { redis } from "../../config/redis";
import { Content } from "../../models/content";
import { Interaction } from "../../models/interaction";
import { Logger } from "../../utils/logger";


export class ContentService {
  private static CACHE_TTL = 3600;

  public async enrichContentData(content: any): Promise<any> {
    try {
      const enriched = {
        ...content,
        metadata: {
          ...content.metadata,
          enrichedAt: new Date()
        },
        
        stats: await this.getContentStats(content._id)
      };

      return enriched;
    } catch (error) {
      Logger.error(`Error enriching content ${content._id}:`, error);
      return content; // Return original if enrichment fails
    }
  }

  private async getContentStats(contentId: string): Promise<{
    viewCount: number;
    likeCount: number;
    shareCount: number;
  }> {
    
    return {
      viewCount: await Interaction.countDocuments({ 
        contentId, 
        interactionType: 'view' 
      }),
      likeCount: await Interaction.countDocuments({ 
        contentId, 
        interactionType: 'like' 
      }),
      shareCount: await Interaction.countDocuments({ 
        contentId, 
        interactionType: 'share' 
      })
    };
  }


  public async getContentById(contentId: string): Promise<any> {
    const cacheKey = `content:${contentId}`;
    
    // Try to get from cache first
    const cachedContent = await redis.get(cacheKey);
    if (cachedContent) {
      Logger.debug(`Cache hit for content ${contentId}`);
      return JSON.parse(cachedContent);
    }

    // Cache miss - fetch from database
    Logger.debug(`Cache miss for content ${contentId}`);
    const content = await Content.findById(contentId).lean();
    
    if (content) {
      // Cache the content
      await redis.set(
        cacheKey, 
        JSON.stringify(content), 
        { EX: ContentService.CACHE_TTL }
      );
    }

    return content;
  }

  public async getContentsByBusiness(
    businessId: string,
    limit: number = 100
  ): Promise<any[]> {
    const cacheKey = `contents:business:${businessId}:${limit}`;
    
    // Try cache first
    const cachedContents = await redis.get(cacheKey);
    if (cachedContents) {
      return JSON.parse(cachedContents);
    }

    // Fetch from database
    const contents = await Content.find({ businessId })
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    // Cache the results
    await redis.set(
      cacheKey,
      JSON.stringify(contents),
      { EX: ContentService.CACHE_TTL }
    );

    return contents;
  }

  public async invalidateContentCache(contentId: string): Promise<void> {
    const contentKey = `content:${contentId}`;
    const businessPattern = `contents:business:*`;
    
    // Delete specific content cache
    await redis.del(contentKey);
    
    // Find and delete all business content lists that might include this content
    const businessKeys = await redis.keys(businessPattern);
    if (businessKeys.length > 0) {
      await Promise.all(businessKeys.map(key => redis.del(key)));
    }
  }
}