import { ErrorRequestHandler, Request, Response, NextFunction, } from 'express';
import app from './app';
import { Logger } from './utils/logger';
import errorHandler from './middleware/error-handler';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    
    
    // Start the server
    app.listen(PORT, () => {
      Logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }

  
};

startServer();