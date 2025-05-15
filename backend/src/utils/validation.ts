import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { Logger } from './logger';

// Base validation schema
const baseSchema = Joi.object({
  headers: Joi.object({
    authorization: Joi.string().pattern(/^Bearer /).optional()
  }).unknown(),
  params: Joi.object().unknown(),
  query: Joi.object().unknown(),
  body: Joi.object().unknown()
});

// Common schemas
export const schemas = {
  idParam: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validate base request structure
      await baseSchema.validateAsync(req);

      // 2. Validate custom schema if provided
      if (schema) {
        const value = await schema.validateAsync({
          body: req.body,
          query: req.query,
          params: req.params
        });

        // Replace request data with validated values
        req.body = value.body || req.body;
        req.query = value.query || req.query;
        req.params = value.params || req.params;
      }

      next();
    } catch (error: any) {
      Logger.error('Validation error:', error);
      res.status(400).json({
        success: false,
        message: error.details?.[0]?.message || 'Validation failed',
        details: error.details
      });
    }
  };
};