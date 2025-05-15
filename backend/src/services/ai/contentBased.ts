import * as tf from '@tensorflow/tfjs';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { redis } from '../../config/redis';
import {Logger} from '../../utils/logger';
import { IContent } from '../../types/content.types';

export class ContentBasedFiltering {
  private model: tf.LayersModel;
  private contentEmbeddings: Record<string, number[]> = {};
  private readonly embeddingSize = 20;
  private readonly featureSize = 100;

  constructor() {
    this.model = this.buildModel();
  }

  // In your ContentBasedFiltering class
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // Encoder
    model.add(tf.layers.dense({
      units: 64,
      inputShape: [this.featureSize],
      activation: 'relu'
    }));

    // Embedding
    model.add(tf.layers.dense({
      units: this.embeddingSize,
      activation: 'relu',
      name: 'embedding'
    }));

    // Decoder
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));

    // Final reconstruction
    model.add(tf.layers.dense({
      units: this.featureSize, // match the input
      activation: 'linear'
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }

  // private buildModel(): tf.LayersModel {
  //   const model = tf.sequential();
    
  //   // Input layer should match your feature vector size
  //   model.add(tf.layers.dense({
  //     units: 64,  // This should match your embedding size
  //     inputShape: [100],  // This should match your feature vector size
  //     activation: 'relu'
  //   }));
    
  //   // Additional layers...
  //   model.add(tf.layers.dense({units: 64, activation: 'relu'}));
  //   model.add(tf.layers.dense({units: 32, activation: 'relu'}));
    
  //   // Output embedding
  //   model.add(tf.layers.dense({
  //     units: 64,  // This must match your embedding size
  //     activation: 'linear',
  //     name: 'content_embedding'
  //   }));
    
  //   model.compile({
  //     optimizer: tf.train.adam(0.001),
  //     loss: 'meanSquaredError'
  //   });
    
  //   return model;
  // }

  // private buildModel(): tf.LayersModel {
  //   const model = tf.sequential();
    
  //   // Encoder
  //   model.add(tf.layers.dense({
  //     units: 64,
  //     inputShape: [this.featureSize],
  //     activation: 'relu'
  //   }));
    
  //   // Embedding layer
  //   model.add(tf.layers.dense({
  //     units: this.embeddingSize,
  //     activation: 'sigmoid',
  //     name: 'embedding'
  //   }));
    
  //   // Decoder
  //   model.add(tf.layers.dense({
  //     units: 64,
  //     activation: 'relu'
  //   }));
    
  //   model.add(tf.layers.dense({
  //     units: this.featureSize,
  //     activation: 'linear'
  //   }));

  //   model.compile({
  //     optimizer: tf.train.adam(0.001),
  //     loss: 'meanSquaredError'
  //   });

  //   return model;
  // }

  public async train(): Promise<void> {
    try {
      const contents = await Content.find().lean();
      const features = this.generateFeatureVectors(contents);
      
      await this.model.fit(features, features, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            Logger.info(`ContentBased Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });

      await this.generateAndCacheEmbeddings(contents);
      Logger.info('Content-based model training completed');
    } catch (error) {
      Logger.error('Error training content-based model:', error);
      throw error;
    }
  }

  private generateFeatureVectors(contents: IContent[]): tf.Tensor2D {
    const features = contents.map(content => {
      return [
        // Normalized text features
        Math.min(content.title.length / 100, 1),
        Math.min(content.description.length / 500, 1),
        Math.min(content.tags.length / 10, 1),
        
        // One-hot encoded type
        ...['text', 'image', 'video', 'link'].map(t => 
          content.type === t ? 1 : 0
        ),
        
        // Metadata features
        content.metadata?.popularity || 0,
        content.metadata?.engagement || 0,
        
        // Padding
        ...new Array(this.featureSize - 7).fill(0)
      ].slice(0, this.featureSize);
    });

    return tf.tensor2d(features, [contents.length, this.featureSize]);
  }

  private async generateAndCacheEmbeddings(contents: IContent[]): Promise<void> {
    const features = this.generateFeatureVectors(contents);
    const embeddingModel = tf.model({
      inputs: this.model.inputs,
      outputs: this.model.getLayer('embedding').output
    });

    const embeddings = embeddingModel.predict(features) as tf.Tensor;
    const embeddingArray = await embeddings.array() as number[][];
    
    // Store in memory and Redis
    const pipeline = redis.pipeline();
    contents.forEach((content, index) => {
      const contentId = content._id!.toString();
      this.contentEmbeddings[contentId] = embeddingArray[index];
      pipeline.set(`embedding:content:${contentId}`, JSON.stringify(embeddingArray[index]), 'EX', 86400);
    });

    try {
      await pipeline.exec();
    } catch (error) {
      Logger.error('Redis pipeline execution failed', error);
      throw error;
    } finally {
      // Only dispose tensors, not models
      tf.dispose([features, embeddings]);
      
      
    }
    

  }

  public async recommendForUser(userId: string, limit: number = 10): Promise<string[]> {
    try {
      const interactions = await Interaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      if (interactions.length === 0) {
        return this.getPopularContent(limit);
      }

      const contentIds = interactions.map(i => i.contentId.toString());
      const embeddings = await this.getEmbeddings(contentIds);
      const userVector = this.calculateAverageVector(embeddings);

      return this.findSimilarContent(userVector, contentIds, limit);
    } catch (error) {
      Logger.error('Content-based recommendation error:', error);
      return this.getPopularContent(limit);
    }
  }

  private async getEmbeddings(contentIds: string[]): Promise<number[][]> {
    const pipeline = redis.pipeline();
    contentIds.forEach(id => pipeline.get(`embedding:content:${id}`));
    
    const results = await pipeline.exec();
    return results.map(([err, cached]: any, i: any) => 
      err ? this.contentEmbeddings[contentIds[i]] : JSON.parse(cached)
    ).filter(Boolean);
  }

  private calculateAverageVector(embeddings: number[][]): number[] {
    const sum = new Array(this.embeddingSize).fill(0);
    embeddings.forEach(embedding => {
      embedding.forEach((val, i) => sum[i] += val);
    });
    return sum.map(val => val / embeddings.length);
  }

  private async findSimilarContent(
    userVector: number[],
    excludeIds: string[],
    limit: number
  ): Promise<string[]> {
    const allContents = await Content.find({ 
      _id: { $nin: excludeIds } 
    }).lean();

    const similarities = await Promise.all(
      allContents.map(async content => {
        const embedding = await this.getCachedEmbedding(content._id.toString());
        return {
          id: content._id.toString(),
          score: embedding ? this.cosineSimilarity(userVector, embedding) : 0
        };
      })
    );

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.id);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async getPopularContent(limit: number): Promise<string[]> {
    const popular = await Interaction.aggregate([
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    return popular.map(item => item._id.toString());
  }

  private async getCachedEmbedding(contentId: string): Promise<number[] | null> {
    const cached = await redis.get(`embedding:content:${contentId}`);
    return cached ? JSON.parse(cached) : this.contentEmbeddings[contentId] || null;
  }

  public async updateContentVectors(contentId: string): Promise<void> {
    try {
      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error(`Content ${contentId} not found`);
      }

      // Ensure your feature processing matches the expected input shape
      const features = this.processContentFeatures(content);
      
      // Reshape features to match model input shape
      const inputTensor = tf.tensor2d([features], [1, features.length]);
      
      // Get embedding
      const embedding = this.model.predict(inputTensor) as tf.Tensor;
      
      // Ensure you're getting the correct layer output
      const embeddingArray = await embedding.array() as number[][];
      
      // Store embedding
      await redis.call('set', 
        `embedding:content:${contentId}`,
        JSON.stringify(embeddingArray[0]),
        'EX',
        86400
      );
            
      // Clean up tensors
      tf.dispose([inputTensor, embedding]);
    } catch (error) {
      Logger.error(`Error updating vectors for content ${contentId}:`, error);
      throw error;
    }
  }

   private processContentFeatures(content: IContent): number[] {
    // Initialize feature array with zeros
    const features = new Array(100).fill(0);

    // Example feature extraction - adjust based on your actual content structure
    // 1. Text features (word counts, TF-IDF, etc.)
    if (content.title) {
      const titleWords = content.title.toLowerCase().split(/\s+/);
      titleWords.forEach(word => {
        const hash = this.hashString(word) % 30; // First 30 features for title
        features[hash] += 1;
      });
    }

    if (content.description) {
      const descWords = content.description.toLowerCase().split(/\s+/);
      descWords.forEach(word => {
        const hash = (this.hashString(word) % 30) + 30; // Next 30 features for description
        features[hash] += 1;
      });
    }

    // 2. Categorical features (one-hot encoded)
    if (content.category) {
      const categoryHash = this.hashString(content.category) % 10; // 10 features for categories
      features[60 + categoryHash] = 1;
    }

    // 3. Numerical features (normalized)
    if (content.duration) {
      features[70] = Math.min(content.duration / 3600, 1); // Normalized hours
    }

    // 4. Timestamp features
    if (content.createdAt) {
      const ageInDays = (Date.now() - content.createdAt.getTime()) / (1000 * 86400);
      features[71] = Math.exp(-ageInDays / 30); // Exponential decay over 30 days
    }

    // 5. Remaining features could be tags, ratings, etc.
    if (content.tags) {
      content.tags.forEach(tag => {
        const hash = (this.hashString(tag) % 28) + 72; // Last 28 features for tags
        features[hash] = 1;
      });
    }

    return features;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // public async updateContentVectors(contentId: string): Promise<void> {
  //   try {
  //     const content = await Content.findById(contentId).lean();
  //     if (!content) return;

  //     const features = this.generateFeatureVectors([content]);
  //     const embedding = (this.model.getLayer('embedding') as tf.layers.Layer)
  //       .apply(features) as tf.Tensor;
      
  //     const embeddingArray = (await embedding.array() as number[][])[0];
      
  //     this.contentEmbeddings[contentId] = embeddingArray;
  //     await redis.set(
  //       `embedding:content:${contentId}`,
  //       JSON.stringify(embeddingArray),
  //       { EX: 86400 }
  //     );

  //     tf.dispose([features, embedding]);
  //   } catch (error) {
  //     Logger.error(`Error updating vectors for content ${contentId}:`, error);
  //   }
  // }
}