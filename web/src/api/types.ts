// Mirrors server/src/types/enums.ts — kept as a small manual copy since the
// two workspaces don't share a package in this MVP (see PLAN.md §1).

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

export type TicketEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'ESCALATED'
  | 'COMMENTED'
  | 'SLA_RESPONSE_BREACHED'
  | 'SLA_RESOLUTION_BREACHED'
  | 'REOPENED';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tickets?: Array<
    Pick<Ticket, 'id' | 'reference' | 'subject' | 'status' | 'priority' | 'createdAt'>
  >;
};

export type TicketComment = {
  id: string;
  ticketId: string;
  authorId: string;
  author: { id: string; name: string };
  body: string;
  isInternal: boolean;
  createdAt: string;
};

export type TicketEvent = {
  id: string;
  ticketId: string;
  actorId: string | null;
  actor: { id: string; name: string } | null;
  type: TicketEventType;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
};

export type Ticket = {
  id: string;
  reference: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  channel: TicketChannel;
  isEscalated: boolean;
  slaResponseDueAt: string;
  slaResolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  customer: Customer;
  assigneeId: string | null;
  assignee: { id: string; name: string; email: string; role: Role } | null;
  createdById: string;
  createdBy: { id: string; name: string; email: string; role: Role };
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  slaResponseRemainingMs: number;
  slaResolutionRemainingMs: number;
  comments?: TicketComment[];
  events?: TicketEvent[];
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type DashboardStats = {
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  myOpen: number;
  unassigned: number;
  breachingResolution: number;
  breachingResponse: number;
  resolvedLast7d: number;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> };
};
