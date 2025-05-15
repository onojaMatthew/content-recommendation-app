import * as tf from '@tensorflow/tfjs';
import { User } from '../../models/user';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { redis } from '../../config/redis';
import { Logger } from '../../utils/logger';

export class CollaborativeFiltering {
  public isTrained: boolean = false;
  private model: tf.LayersModel;
  private numUsers: number = 0;
  private numContents: number = 0;
  private readonly latentDimensions = 20;
  private readonly batchSize = 64;
  private readonly epochs = 30;

  constructor() {
    this.model = this.buildModel();
  }

  private buildModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Update input shape to match your data (100 features)
    model.add(tf.layers.dense({
        units: 64,
        inputShape: [100],  // Changed from 64 to 100
        activation: 'relu'
    }));
    
    // Additional layers...
    model.add(tf.layers.dense({units: 64, activation: 'relu'}));
    model.add(tf.layers.dense({units: 32, activation: 'relu'}));
    
    // Output layer
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }));
    
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
    });
    
    return model;
  }

  public async train(): Promise<void> {
    try {
      [this.numUsers, this.numContents] = await Promise.all([
        User.countDocuments(),
        Content.countDocuments()
      ]);

      const interactions = await Interaction.find().lean();
      if (interactions.length === 0) {
        this.isTrained = false;
        throw new Error('No interactions available for training');
      }

      const { userIndices, contentIndices, ratings } = this.prepareTrainingData(interactions);

      await this.model.fit(
        [userIndices, contentIndices],
        ratings,
        {
          batchSize: this.batchSize,
          epochs: this.epochs,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              Logger.info(`CF Epoch ${epoch + 1}/${this.epochs} - loss: ${logs?.loss.toFixed(4)}`);
            }
          }
        }
      );
      this.isTrained = true;
      Logger.info('Collaborative filtering model trained');
    } catch (error) {
      Logger.error('Error training collaborative model:', error);
      throw error;
    }
  }

  private prepareTrainingData(interactions: any[]) {
    return {
      userIndices: tf.tensor2d(
        interactions.map(i => [this.userIdToIndex(i.userId)]),
        [interactions.length, 1],
        'int32'
      ),
      contentIndices: tf.tensor2d(
        interactions.map(i => [this.contentIdToIndex(i.contentId)]),
        [interactions.length, 1],
        'int32'
      ),
      ratings: tf.tensor2d(
        interactions.map(i => [i.rating || 0.5]),
        [interactions.length, 1],
        'float32'
      )
    };
  }

  public async recommendForUser(userId: string, limit: number = 10): Promise<string[]> {
    try {
      const allContents = await Content.find().select('_id').lean();
      const contentIds = allContents.map(c => c._id.toString());

      const userInput = tf.tensor2d(
        new Array(contentIds.length).fill([this.userIdToIndex(userId)]),
        [contentIds.length, 1],
        'int32'
      );

      const contentInput = tf.tensor2d(
        contentIds.map(id => [this.contentIdToIndex(id)]),
        [contentIds.length, 1],
        'int32'
      );

      const predictions = this.model.predict([userInput, contentInput]) as tf.Tensor;
      const scores = await predictions.array() as number[][];

      const ranked = contentIds
        .map((id, i) => ({ id, score: scores[i][0] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.id);

      tf.dispose([userInput, contentInput, predictions]);
      return ranked;
    } catch (error) {
      Logger.error('CF recommendation error:', error);
      return this.getPopularContent(limit);
    }
  }

  private userIdToIndex(userId: string): number {
    return parseInt(userId.toString().replace(/\D/g, '')) % (this.numUsers + 1);
  }

  private contentIdToIndex(contentId: string): number {
    return parseInt(contentId.toString().replace(/\D/g, '')) % (this.numContents + 1);
  }

  private async getPopularContent(limit: number): Promise<string[]> {
    const popular = await Interaction.aggregate([
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    return popular.map(item => item._id.toString());
  }

  public async updateUserPreferences(userId: string, contentId: string): Promise<void> {
    try {
      const recentInteractions = await Interaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      if (recentInteractions.length >= 30) {
        const { userIndices, contentIndices, ratings } = 
          this.prepareTrainingData(recentInteractions);

        await this.model.fit(
          [userIndices, contentIndices],
          ratings,
          {
            batchSize: Math.min(32, recentInteractions.length),
            epochs: 3,
            shuffle: true
          }
        );

        tf.dispose([userIndices, contentIndices, ratings]);
      }
    } catch (error) {
      Logger.error('Error updating user preferences:', error);
    }
  }
}