import { NextFunction, Request, Response } from 'express';
import { User } from '../../models/user';
import { redis } from '../../config/redis';
import { Logger } from '../../utils/logger';
import { IUser } from '../../types/user.types';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { AppError } from '../../utils/errorHandler';

// Cache TTL in seconds
const USER_CACHE_TTL = 3600; // 1 hour
const USERS_LIST_TTL = 300; // 5 minutes

// Get user by ID with caching
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.query;
    const cacheKey = `user:${id}`;

    // Try cache first
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      Logger.debug(`Cache hit for user ${id}`);
      res.json({
        success: true, message: 'User retrieved from cache', data: JSON.parse(cachedUser), });
    }

    // Cache miss - fetch from database
    Logger.debug(`Cache miss for user ${id}`);
    const user = await User.findById(id).select('-password').lean();

    if (!user) return next(new AppError("User not found", 404));

    // Cache the user
    await redis.set(cacheKey, JSON.stringify(user), { EX: USER_CACHE_TTL });

    res.json({ success: true, data: user, message: 'User retrieved from database' });
  } catch (error) {
    Logger.error('Error fetching user:', error);
    return next(new AppError("Failed to fech user", 500));
  }
}

// Get all users
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cacheKey = 'users:all';
    const { businessId } = req.query;

    // Try cache first
    const cachedUsers = await redis.get(cacheKey);
    if (cachedUsers && !businessId) {
      Logger.debug('Cache hit for all users');
      res.json({ success: true, message: 'Users retrieved from cache', data: JSON.parse(cachedUsers) });
    }

    // Cache miss - fetch from database
    Logger.debug('Cache miss for users');
    const query = businessId ? { businessId } : {};
    const users = await User.find(query).select('-password').lean();

    // Cache the results (only if not filtered)
    if (!businessId)  await redis.set(cacheKey, JSON.stringify(users), { EX: USERS_LIST_TTL });

    res.json({  success: true,
      message: 'Users retrieved from database',
      data: users
    });
  } catch (error) {
    Logger.error('Error fetching users:', error);
    return next(new AppError("Failed to fetch users", 500));
  }
}

// Update user with cache invalidation
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, req.body, { new: true, lean: true }).select("-password");
    if (!user) return next(new AppError("User not found", 404));
    res.json({ success: true, message: "User updated successfully", data: user });
  } catch (err) {
    return next(new AppError("Internal Server Error", 500));
  }
}

// Delete user with cache invalidation
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id).lean();

    if (!user)  return next(new AppError("User not found", 404));

    // Invalidate relevant caches
    await Promise.all([
      redis.del(`user:${id}`),
      redis.del('users:all'),
      redis.del(`users:business:${(user as IUser).businessId}`)
    ]);

    res.json({ success: true, message: 'User deleted successfully', data: null });
  } catch (error) {
    Logger.error('Error deleting user:', error);
    return next(new AppError("Failed to delete user", 500));
  }
}

// Get user statistics with caching
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = `user:stats:${id}`;

    // Try cache first
    const cachedStats = await redis.get(cacheKey);
    if (cachedStats) res.json({ success: true,  message: 'Stats retrieved from cache', data: JSON.parse(cachedStats), });

    // Cache miss - calculate stats
    const stats = {
      contentCount: await Content.countDocuments({ userId: id }),
      lastActivity: await Interaction.findOne({ userId: id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean(),
      engagementRate: await calculateEngagementRate(id),
      lastUpdated: new Date()
    };

    // Cache stats with shorter TTL (5 minutes)
    await redis.set(cacheKey, JSON.stringify(stats), { EX: 300 });

    res.json({ success: true, message: 'Stats calculated', data: stats });
  } catch (error) {
    Logger.error('Error getting user stats:', error);
    return next(new AppError("Failed to get user stats", 500));
  }
}
 
export const calculateEngagementRate = async (userId: string): Promise<number> => {
  const [interactionCount, contentCount] = await Promise.all([
    Interaction.countDocuments({ userId }),
    Content.countDocuments()
  ]);

  const totalPossible = contentCount * 3; // Assuming 3 interaction types per content

  return totalPossible > 0 ? interactionCount / totalPossible : 0;
}
 