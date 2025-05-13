import { config } from "dotenv";
config();

export const key = {
  MONGO_URI: process.env.MONGO_URI,
  SECRET: process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET missing") })(),
  EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? (() => { throw new Error("JWT_EXPIRES_IN missing") })()
}