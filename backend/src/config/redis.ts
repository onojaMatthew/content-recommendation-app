import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/logger';

class RedisClient {
  private client: RedisClientType;
  private static instance: RedisClient;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            Logger.error('Too many retries on REDIS. Connection Terminated');
            return new Error('Redis connection retry limit exceeded');
          }
          return Math.min(retries * 100, 5000); // Wait up to 5 seconds between retries
        }
      }
    });

    this.client.on('error', (err) => {
      Logger.error(`Redis Client Error: ${err.message}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      Logger.info('Redis connection established');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      Logger.info('Redis reconnecting...');
      this.isConnected = false;
    });

    this.client.on('ready', () => {
      Logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      Logger.warn('Redis connection ended');
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
      } catch (error) {
        Logger.error(`Redis connection failed: ${error}`);
        throw error;
      }
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected) await this.connect();
      return await this.client.get(key);
    } catch (error) {
      Logger.error(`Redis GET error for key ${key}: ${error}`);
      return null;
    }
  }

  public async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean }
  ): Promise<boolean> {
    try {
      if (!this.isConnected) await this.connect();
      const result = await this.client.set(key, value, options);
      return result === 'OK';
    } catch (error) {
      Logger.error(`Redis SET error for key ${key}: ${error}`);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) await this.connect();
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      Logger.error(`Redis DEL error for key ${key}: ${error}`);
      return false;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected) await this.connect();
      return await this.client.keys(pattern);
    } catch (error) {
      Logger.error(`Redis KEYS error for pattern ${pattern}: ${error}`);
      return [];
    }
  }

  public async hSet(key: string, field: string, value: string): Promise<boolean> {
    try {
      if (!this.isConnected) await this.connect();
      const result = await this.client.hSet(key, field, value);
      return result > 0;
    } catch (error) {
      Logger.error(`Redis HSET error for key ${key}: ${error}`);
      return false;
    }
  }

  public async hGet(key: string, field: string): Promise<string | null> {
    try {
      if (!this.isConnected) await this.connect();
      return await this.client.hGet(key, field);
    } catch (error) {
      Logger.error(`Redis HGET error for key ${key}: ${error}`);
      return null;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.isConnected) await this.connect();
      return (await this.client.expire(key, seconds)) === 1;
    } catch (error) {
      Logger.error(`Redis EXPIRE error for key ${key}: ${error}`);
      return false;
    }
  }


  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
      }
    } catch (error) {
      Logger.error(`Redis disconnect error: ${error}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) await this.connect();
      await this.client.ping();
      return true;
    } catch (error) {
      Logger.error(`Redis health check failed: ${error}`);
      return false;
    }
  }
}

// Singleton Redis instance
const redis = RedisClient.getInstance();

// Graceful shutdown
process.on('SIGINT', async () => {
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redis.disconnect();
  process.exit(0);
});

export { redis };