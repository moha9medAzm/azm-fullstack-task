import { z } from 'zod';
import { ROLES } from '../../types/enums';

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES).default('AGENT'),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const idParamSchema = z.object({
  id: z.string().min(1),
});
