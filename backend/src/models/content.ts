import { model, Schema } from "mongoose";
import { IContent } from "../types/content.types";

const ContentSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, unique: true, trim: true },
  description: { type: String },
  textContent: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['text', 'image', 'link', 'video']
  },
  relatedProducts: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Product' 
  }],
  businessId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  tags: { type: [String]},
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  featuredImage: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'draft' 
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
ContentSchema.index({ slug: 1 });
ContentSchema.index({ contentType: 1 });
ContentSchema.index({ status: 1 });
ContentSchema.index({ publishedAt: -1 });

// Update the updatedAt field before saving
ContentSchema.pre<IContent>('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Content = model<IContent>('Content', ContentSchema);