/**
 * SQLite has no native enum type, so Prisma stores these as `String` columns
 * (see prisma/schema.prisma). These const-array + union-type pairs are the
 * single source of truth for valid values everywhere else (Zod schemas,
 * business logic, seed data, frontend types via manual mirroring).
 */

export const ROLES = ['ADMIN', 'AGENT'] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'GENERAL',
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'FEATURE_REQUEST',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CHANNELS = ['WEB', 'EMAIL', 'PHONE', 'CHAT', 'WHATSAPP', 'SMS'] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export const TICKET_EVENT_TYPES = [
  'CREATED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'ASSIGNED',
  'UNASSIGNED',
  'ESCALATED',
  'COMMENTED',
  'SLA_RESPONSE_BREACHED',
  'SLA_RESOLUTION_BREACHED',
  'REOPENED',
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];
