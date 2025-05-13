import mongoose from 'mongoose';
import { Logger } from '../utils/logger';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    Logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    Logger.error(`Error connecting to MongoDB: ${error}`);
    process.exit(1);
  }
};

export default connectDB;