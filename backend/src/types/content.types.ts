import { Document, Schema } from "mongoose";

export interface IContent extends Document {
  title: string;
  description: string;
  type: 'text' | 'image' | 'link' | 'video';
  url?: string;
  textContent?: string;
  category?: string;      // Add this
  duration?: number;
  tags: string[];
  metadata: Record<string, any>;
  businessId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}