
import { Document, Types } from "mongoose";
import { UserRole, SubscriptionPlan } from "../models/user";
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  businessName: string;
  businessId: Types.ObjectId; // For multi-tenancy
  subscription: {
    plan: SubscriptionPlan;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
  };
  avatar?: string;
  isVerified: boolean;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  toJSON(): any;
}