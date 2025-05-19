import { model, Schema } from "mongoose";

const RecommendationSchema: Schema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  products: [{
    product: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true 
    },
    score: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100 
    },
    reasons: [{ 
      type: String 
    }]
  }],
  preferencesSnapshot: {
    budget: {
      min: { type: Number, required: true },
      max: { type: Number, required: true }
    },
    categories: [{ type: String }],
    mustHaveFeatures: [{ type: String }],
    deployment: { 
      type: String, 
      enum: ['cloud', 'self-hosted', 'hybrid'],
      required: true 
    },
    teamSize: { 
      type: String, 
      enum: ['individual', 'small-team', 'enterprise'],
      required: true 
    }
  },
  algorithmVersion: { 
    type: String, 
    required: true 
  },
  generatedAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expires: 0 } // TTL index
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
RecommendationSchema.index({ user: 1 });
RecommendationSchema.index({ generatedAt: -1 });
RecommendationSchema.index({ expiresAt: 1 });

export const Recommendation = model("Recommendation", RecommendationSchema)

