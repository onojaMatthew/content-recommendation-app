import { Document, Schema } from "mongoose";

export interface IContent extends Document {
  title: string;
  slug: string;
  description: string;
  textContent: string;
  type: 'text' | 'image' | 'link' | 'video';
  relatedProducts: Schema.Types.ObjectId[];
  businessId: Schema.Types.ObjectId;
  createdAt: Date;
  tags: [];
  duration: number;
  metadata: Record<string, any>;
  updatedAt: Date;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  status: 'draft' | 'published' | 'archived';
}