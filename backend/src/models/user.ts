import { model, Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { IUser } from "../types/user.types";
import { Logger } from "../utils/logger";
import { redis } from "../config/redis";

// Define user roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CONTENT_MANAGER = 'content_manager',
  ANALYST = 'analyst',
  USER = 'user'
}

// Define subscription plans
export enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER
    },
    businessName: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    subscription: {
      plan: {
        type: String,
        enum: Object.values(SubscriptionPlan),
        default: SubscriptionPlan.FREE
      },
      startsAt: { type: Date, default: Date.now },
      endsAt: { type: Date },
      isActive: { type: Boolean, default: true }
    },
    avatar: { type: String },
    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret._id;
        return ret;
      }
    }
  }
);


UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// import jwt from 'jsonwebtoken';

// In your User model methods:
UserSchema.methods.generateAuthToken = function (): string {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN;

  if (!secret) throw new Error("JWT_SECRET is not defined");
  if (!expiresIn) throw new Error("JWT_EXPIRES_IN is not defined");

  const payload = {
    id: this._id.toString(),
    businessId: this.businessId.toString(),
    role: this.role
  };

  return jwt.sign(
    payload,
    secret,
    { expiresIn } as jwt.SignOptions
  );
};

// Cache user data after save
UserSchema.post<IUser>('save', async function (doc) {
  try {
    await redis.set(
      `user:${doc._id}`,
      JSON.stringify(doc.toJSON()),
      { EX: 3600 } // Cache for 1 hour
    );
  } catch (error) {
    Logger.error(`Failed to cache user ${doc._id}: ${error}`);
  }
});

export const User = model<IUser>('User', UserSchema);