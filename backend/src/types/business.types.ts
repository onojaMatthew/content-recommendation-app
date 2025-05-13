import { Document, Schema } from "mongoose";

// Business Model for Multi-tenancy (src/models/business.model.ts)
export interface IBusiness extends Document {
  name: string;
  slug: string;
  owner?: Schema.Types.ObjectId;
  settings: {
    contentApprovalRequired: boolean;
    defaultLanguage: string;
  };
}