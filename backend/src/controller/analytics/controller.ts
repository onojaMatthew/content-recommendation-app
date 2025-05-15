import { NextFunction, Request, Response } from 'express';
import { Interaction } from '../../models/interaction';
import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/errorHandler';

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.user;
    console.log(businessId.toString(), " the business id")
    const { timeRange = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date(now);
    
    if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(now.getDate() - 90);
    }

    // Get content analytics
    const contentStats = await Interaction.aggregate([
      {
        $match: {
          contentId: { $exists: true },
          createdAt: { $gte: startDate },
          'content.businessId': businessId.toString()
        }
      },
      {
        $lookup: {
          from: 'contents',
          localField: 'contentId',
          foreignField: '_id',
          as: 'content'
        }
      },
      {
        $unwind: '$content'
      },
      {
        $match: {
          'content.businessId': businessId.toString()
        }
      },
      {
        $group: {
          _id: '$contentId',
          title: { $first: '$content.title' },
          type: { $first: '$content.type' },
          views: {
            $sum: {
              $cond: [{ $eq: ['$interactionType', 'view'] }, 1, 0]
            }
          },
          likes: {
            $sum: {
              $cond: [{ $eq: ['$interactionType', 'like'] }, 1, 0]
            }
          },
          shares: {
            $sum: {
              $cond: [{ $eq: ['$interactionType', 'share'] }, 1, 0]
            }
          },
          avgDuration: {
            $avg: '$duration'
          }
        }
      },
      {
        $sort: { views: -1 }
      },
      {
        $limit: 50
      }
    ]);

    // Get overall engagement metrics
    const engagementStats = await Interaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          'content.businessId': businessId.toString()
        }
      },
      {
        $lookup: {
          from: 'contents',
          localField: 'contentId',
          foreignField: '_id',
          as: 'content'
        }
      },
      {
        $unwind: '$content'
      },
      {
        $match: {
          'content.businessId': businessId.toString()
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: { $cond: [{ $eq: ['$interactionType', 'view'] }, 1, 0] } },
          totalLikes: { $sum: { $cond: [{ $eq: ['$interactionType', 'like'] }, 1, 0] } },
          totalShares: { $sum: { $cond: [{ $eq: ['$interactionType', 'share'] }, 1, 0] } },
          avgViewDuration: { $avg: '$duration' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalViews: 1,
          totalLikes: 1,
          totalShares: 1,
          avgViewDuration: 1,
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        contentStats,
        engagementStats: engagementStats[0] || {}
      },
      message: 'Analytics fetched successfully'
    });
  } catch (error) {
    Logger.error('Error in getContentAnalytics:', error);
    return next(new AppError("Failed to fetch analytics", 500));
  }
};