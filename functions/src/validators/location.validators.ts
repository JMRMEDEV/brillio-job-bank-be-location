import * as Joi from 'joi';

export const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(10),
  cursor: Joi.string().optional(),
  search: Joi.string().optional(),
  country: Joi.string().optional(),
  state: Joi.string().optional(),
  city: Joi.string().optional()
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().required().min(1).max(100),
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(50).default(10),
  country: Joi.string().optional(),
  state: Joi.string().optional()
});
