import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
} from '../../types/enums';

export const idParamSchema = z.object({ id: z.string().min(1) });

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  customerId: z.string().min(1),
  priority: z.enum(TICKET_PRIORITIES).default('MEDIUM'),
  category: z.enum(TICKET_CATEGORIES).default('GENERAL'),
  channel: z.enum(TICKET_CHANNELS).default('WEB'),
  assigneeId: z.string().min(1).nullable().optional(),
});

export const updateTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10_000).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    channel: z.enum(TICKET_CHANNELS).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  isInternal: z.boolean().default(false),
});

const boolFromQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const listTicketsQuerySchema = paginationSchema.extend({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  channel: z.enum(TICKET_CHANNELS).optional(),
  assigneeId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  mine: boolFromQuery,
  unassigned: boolFromQuery,
  breaching: boolFromQuery,
  q: z.string().trim().max(200).optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'priority', '-priority', 'slaResolutionDueAt', '-slaResolutionDueAt'])
    .default('-createdAt'),
});
