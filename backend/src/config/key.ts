import { config } from "dotenv";
config();

export const key = {
  MONGO_URI: process.env.MONGO_URI,
  SECRET: process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET missing") })(),
  EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? (() => { throw new Error("JWT_EXPIRES_IN missing") })(),
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TTL_CONTENT: process.env.REDIS_TTL_CONTENT,
  REDIS_TTL_RECOMMENDATIONS: process.env.REDIS_TTL_RECOMMENDATIONS,
  REDIS_TTL_ANALYTICS: process.env.REDIS_TTL_ANALYTICS,
}