import { model, Schema } from "mongoose";
import { IContent } from "../types/content.types";

const ContentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'link', 'video'], required: true },
    url: { type: String },
    textContent: { type: String },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    businessId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Content = model<IContent>('Content', ContentSchema);