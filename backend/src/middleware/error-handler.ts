import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errorHandler';

const errorHandler: ErrorRequestHandler  = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Something went wrong',
      data: null,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    data: null,
  });
};

export default errorHandler;
