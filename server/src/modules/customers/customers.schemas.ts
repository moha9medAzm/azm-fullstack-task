import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    company: z.string().trim().max(160).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const listCustomersQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});
