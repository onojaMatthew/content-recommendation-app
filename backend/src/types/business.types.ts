import { Types } from "mongoose";
import { Document } from "mongoose";

// Business Model for Multi-tenancy (src/models/business.model.ts)
export interface IBusiness extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  owner?: Types.ObjectId;
  settings: {
    contentApprovalRequired: boolean;
    defaultLanguage: string;
  };
}