import { model, Schema } from "mongoose";
import { IBusiness } from "../types/business.types";

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    settings: {
      contentApprovalRequired: { type: Boolean, default: false },
      defaultLanguage: { type: String, default: 'en' }
    }
  },
  { timestamps: true }
);

export const Business = model<IBusiness>('Business', BusinessSchema);
