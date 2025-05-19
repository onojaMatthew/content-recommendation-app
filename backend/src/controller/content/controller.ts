import { NextFunction, Request, Response } from 'express';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { redis } from '../../config/redis';
import { Logger } from '../../utils/logger';
import { IContent } from '../../types/content.types';
import { AppError } from '../../utils/errorHandler';

// Cache TTL in seconds
const CACHE_TTL = 3600; // 1 hour
const CONTENT_LIST_TTL = 300; // 5 minutes

export class ContentController {
  // Create content with cache invalidation
  public static async createContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await Content.create(req.body);
      
      // Invalidate cached content lists
      await Promise.all([
        await redis.del('contents:all'),
        await redis.del(`contents:business:${content.businessId}`)
      ]);
      
      
      res.status(201).json({
        success: true,
        data: content,
        message: 'Content created successfully'
      });
    } catch (error) {
      Logger.error('Error creating content:', error);
      return next(new AppError("Failed to create content", 500));
    }
  }

  // Get content by ID with caching
  public static async getContentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `content:${id}`;

      // Try cache first
      const cachedContent = await redis.get(cacheKey);
      if (cachedContent) {
        Logger.debug(`Cache hit for content ${id}`);
        res.json({
          success: true,
          message: 'Content retrieved from cache',
          data: JSON.parse(cachedContent),
        });
        return;
      }

      // Cache miss - fetch from database
      Logger.debug(`Cache miss for content ${id}`);
      const content = await Content.findById(id).lean();

      if (!content) {
        return next(new AppError("Content not found", 404));
      }

      // Cache the content
      await redis.set(cacheKey, JSON.stringify(content), { EX: CACHE_TTL });

      res.json({
        success: true,
        message: 'Content retrieved from database',
        data: content,
      });
    } catch (error) {
      Logger.error('Error fetching content:', error);
      return next(new AppError("Failed to fetch content", 500));
    }
  }

  // Get all content with caching
  public static async getAllContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cacheKey = 'contents:all';
      const { businessId } = req.query;

      // Different cache key if filtered by business
      const finalCacheKey = businessId 
        ? `contents:business:${businessId}`
        : cacheKey;

      // Try cache first
      const cachedContents = await redis.get(finalCacheKey);
      if (cachedContents) {
        Logger.debug(`Cache hit for ${finalCacheKey}`);
        res.json({
          success: true,
          data: JSON.parse(cachedContents),
          message: 'Contents retrieved from cache'
        });
        return;
      }

      // Cache miss - fetch from database
      Logger.debug(`Cache miss for ${finalCacheKey}`);
      const query = businessId ? { businessId } : {};
      const contents = await Content.find(query).lean();

      // Cache the results
      await redis.set(
        finalCacheKey, 
        JSON.stringify(contents), 
        { EX: businessId ? CACHE_TTL : CONTENT_LIST_TTL }
      );

      res.json({
        success: true,
        data: contents,
        message: 'Contents retrieved from database'
      });
    } catch (error) {
      Logger.error('Error fetching contents:', error);
      return next(new AppError("Failed to fetch contents", 500));
    }
  }

  // Update content
  public static async updateContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const content = await Content.findByIdAndUpdate(id, req.body, { 
        new: true,
        lean: true 
      });

      if (!content) {
        res.status(404).json({
          success: false,
          message: 'Content not found'
        });
        return;
      }

      // Invalidate relevant caches
      await Promise.all([
        redis.del(`content:${id}`),
        redis.del('contents:all'),
        redis.del(`contents:business:${content.businessId}`)
      ]);

      res.json({
        success: true,
        data: content,
        message: 'Content updated successfully'
      });
    } catch (error) {
      Logger.error('Error updating content:', error);
      return next(new AppError("Failed to update content", 500));
    }
  }

  // Delete content with cache invalidation
  public static async deleteContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const content = await Content.findByIdAndDelete(id).lean();

      if (!content) {
        res.status(404).json({
          success: false,
          message: 'Content not found'
        });
        return;
      }

      // Invalidate relevant caches
      await Promise.all([
        redis.del(`content:${id}`),
        redis.del('contents:all'),
        redis.del(`contents:business:${(content as IContent).businessId}`)
      ]);

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error) {
      Logger.error('Error deleting content:', error);
      return next(new AppError("Failed to delete content", 500));
    }
  }

  // Get content statistics with caching
  public static async getContentStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.query;
      const cacheKey = `content:stats:${id}`;

      // Try cache first
      const cachedStats = await redis.get(cacheKey);
      if (cachedStats) {
        res.json({
          success: true,
          message: 'Stats retrieved from cache',
          data: JSON.parse(cachedStats),
        });
        return;
      }

      // Cache miss - calculate stats
      const stats = {
        views: await Interaction.countDocuments({ contentId: id, interactionType: 'view' }),
        likes: await Interaction.countDocuments({ contentId: id, interactionType: 'like' }),
        shares: await Interaction.countDocuments({ contentId: id, interactionType: 'share' }),
        lastUpdated: new Date()
      };

      // Cache stats with shorter TTL (5 minutes)
      await redis.set(cacheKey, JSON.stringify(stats), { EX: 300 });

      res.json({
        success: true,
        message: 'Stats calculated',
        data: stats,
      });
    } catch (error) {
      Logger.error('Error getting content stats:', error);
      return next(new AppError("Failed to get content stats", 500));
    }
  }
}