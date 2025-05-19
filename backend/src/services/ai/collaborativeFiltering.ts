import * as tf from '@tensorflow/tfjs';
import { User } from '../../models/user';
import { Content } from '../../models/content';
import { Interaction } from '../../models/interaction';
import { redis } from '../../config/redis';
import { Logger } from '../../utils/logger';

export class CollaborativeFiltering {
  private model: tf.LayersModel;
  private numUsers: number = 0;
  private numContents: number = 0;
  private readonly latentDimensions = 20;
  private readonly batchSize = 64;
  private readonly epochs = 30;
  public isTrained: boolean = false;

  constructor() {
    this.model = this.buildModel();
  }

  private buildModel(): tf.LayersModel {
    // User input branch
    const userInput = tf.input({ shape: [1], name: 'user_input' });
    const userEmbedding = tf.layers.embedding({
      inputDim: this.numUsers + 1,
      outputDim: this.latentDimensions,
      inputLength: 1
    }).apply(userInput) as tf.SymbolicTensor;

    // Content input branch
    const contentInput = tf.input({ shape: [1], name: 'content_input' });
    const contentEmbedding = tf.layers.embedding({
      inputDim: this.numContents + 1,
      outputDim: this.latentDimensions,
      inputLength: 1
    }).apply(contentInput) as tf.SymbolicTensor;

    // Dot product similarity
    const dotProduct = tf.layers.dot({
      axes: -1,
      normalize: true
    }).apply([userEmbedding, contentEmbedding]) as tf.SymbolicTensor;

    // Final prediction
    const flattened = tf.layers.flatten().apply(dotProduct) as tf.SymbolicTensor;
    const output = tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }).apply(flattened) as tf.SymbolicTensor;

    const model = tf.model({
      inputs: [userInput, contentInput],
      outputs: output
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  private userIdToIndex(userId: string): number {
    // Ensure the index is within bounds
    const index = parseInt(userId.replace(/\D/g, '')) % (this.numUsers + 1);
    return Math.min(index, this.numUsers - 1);
  }

  private contentIdToIndex(contentId: string): number {
    // Ensure the index is within bounds
    const index = parseInt(contentId.replace(/\D/g, '')) % (this.numContents + 1);
    return Math.min(index, this.numContents - 1);
  }

  public async train(): Promise<void> {
    try {
      // Get counts first
      [this.numUsers, this.numContents] = await Promise.all([
        User.countDocuments(),
        Content.countDocuments()
      ]);

      // Ensure we have at least 1 user and content
      if (this.numUsers === 0 || this.numContents === 0) {
        throw new Error('No users or contents available for training');
      }

      // Rebuild model with correct dimensions
      this.model = this.buildModel();

      const interactions = await Interaction.find()
        .select('userId contentId rating')
        .limit(20000)
        .lean();

      if (interactions.length === 0) {
        this.isTrained = false;
        throw new Error('No interactions available for training');
      }

      // ... [rest of training code]
    } catch (error) {
      this.isTrained = false;
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