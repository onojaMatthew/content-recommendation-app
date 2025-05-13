import { User } from '../../models/user';
import { IUser } from '../../types/user.types';
import { redis } from '../../config/redis';

export class UserService {
  static async getUserById(userId: string) {
    // Check cache first
    const cachedUser = await redis.get(`user:${userId}`);
    if (cachedUser) return JSON.parse(cachedUser);

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Cache user data
    await redis.set(
      `user:${user._id}`,
      JSON.stringify(user.toJSON()),
      { EX: 3600 } // 1 hour
    );

    return user;
  }

  static async updateUser(userId: string, updates: Partial<IUser>) {
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) throw new Error('User not found');

    // Update cache
    await redis.set(
      `user:${user._id}`,
      JSON.stringify(user.toJSON()),
      { EX: 3600 } // 1 hour
    );

    // If email changed, update email cache
    if (updates.email) {
      await redis.del(`user:email:${updates.email}`);
      await redis.set(
        `user:email:${user.email}`,
        JSON.stringify(user.toJSON()),
        { EX: 3600 } // 1 hour
      );
    }

    return user;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new Error('User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new Error('Current password is incorrect');

    user.password = newPassword;
    await user.save();

    // Invalidate cache
    await redis.del(`user:${user._id}`);
    await redis.del(`user:email:${user.email}`);

    return user;
  }
}