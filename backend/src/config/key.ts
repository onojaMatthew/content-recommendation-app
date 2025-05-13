
export const key = {
  MONGO_URI: process.env.MONGO_URI,
  SECRET: process.env.JWT_SECRET as string,
  EXPIRES_IN: process.env.JWT_EXPIRES_IN as string
}