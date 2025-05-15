import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { key } from './key';

class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private isConnected: boolean = false;

  private constructor() {
    this.client = new Redis(key.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (retries) => {
        if (retries > 5) {
          Logger.error('Too many retries on REDIS. Connection Terminated');
          return null;
        }
        return Math.min(retries * 100, 5000); // Wait up to 5 seconds
      }
    });

    this.client.on('connect', () => {
      Logger.info('Redis connection established');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      Logger.error(`Redis Client Error: ${err.message}`);
      this.isConnected = false;
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

  public async call(...args: (string | number)[]): Promise<any> {
    return (this.client as any).call(...args);
  } 

  public pipeline(): any {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client.pipeline();
  }

  // Add pipeline operations method
  public async pipelineExec(commands: [string, ...any[]][]): Promise<Array<[error: Error | null, result: any]>> {
    const pipeline = this.pipeline();
    commands.forEach(([command, ...args]) => {
      (pipeline as any)[command](...args);
    });
    return pipeline.exec();
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      Logger.error(`Redis GET error for key ${key}: ${error}`);
      return null;
    }
  }

  public async cacheEmbedding(
    contentId: string,
    embedding: number[],
    ttlSeconds: number = 86400
  ): Promise<void> {
    try {
      await this.client.set(
        `embedding:content:${contentId}`,
        JSON.stringify(embedding),
        'EX',
        ttlSeconds
      );
    } catch (error) {
      Logger.error(`Failed caching embedding for ${contentId}`, error);
      throw error;
    }
  } 

  public async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean }
  ): Promise<boolean> {
    try {
      if (options?.EX && options?.NX) {
        const result = await this.client.set(key, value, 'EX', options.EX, 'NX');
        return result === 'OK';
      } else if (options?.EX) {
        const result = await this.client.set(key, value, 'EX', options.EX);
        return result === 'OK';
      } else if (options?.NX) {
        const result = await this.client.set(key, value, 'NX');
        return result === 'OK';
      } else {
        const result = await this.client.set(key, value);
        return result === 'OK';
      }
    } catch (error) {
      Logger.error(`Redis SET error for key ${key}: ${error}`);
      return false;
    }
  }


  public async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      Logger.error(`Redis DEL error for key ${key}: ${error}`);
      return false;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      Logger.error(`Redis KEYS error for pattern ${pattern}: ${error}`);
      return [];
    }
  }

  public async hSet(key: string, field: string, value: string): Promise<boolean> {
    try {
      const result = await this.client.hset(key, field, value);
      return result > 0;
    } catch (error) {
      Logger.error(`Redis HSET error for key ${key}: ${error}`);
      return false;
    }
  }

  public async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      Logger.error(`Redis HGET error for key ${key}: ${error}`);
      return null;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return (await this.client.expire(key, seconds)) === 1;
    } catch (error) {
      Logger.error(`Redis EXPIRE error for key ${key}: ${error}`);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      Logger.error(`Redis disconnect error: ${error}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      Logger.error(`Redis health check failed: ${error}`);
      return false;
    }
  }
}

// Singleton instance
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
