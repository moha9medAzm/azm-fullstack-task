import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { computeSlaDueDates, recomputeSlaOnPriorityChange, bumpPriority, deriveSlaFields } from '../../lib/sla';
import { assertTransition, isReopen } from './transitions';
import type { TicketPriority } from '../../types/enums';
import type { createTicketSchema, updateTicketSchema, listTicketsQuerySchema } from './tickets.schemas';
import type { z } from 'zod';

type Tx = Prisma.TransactionClient | PrismaClient;
type Actor = { id: string; role: string };

export const ticketInclude = {
  customer: true,
  assignee: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** Attach derived, never-persisted SLA fields for API responses. */
export function attachDerived<T extends { slaResponseDueAt: Date; slaResolutionDueAt: Date; firstRespondedAt: Date | null; resolvedAt: Date | null }>(
  ticket: T,
  now = new Date(),
) {
  return { ...ticket, ...deriveSlaFields(now, ticket) };
}

async function nextReference(tx: Tx): Promise<string> {
  const last = await tx.ticket.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { reference: true },
  });
  const lastNum = last ? Number(last.reference.replace(/\D/g, '')) || 0 : 0;
  return `TKT-${String(lastNum + 1).padStart(4, '0')}`;
}

async function getOr404(tx: Tx, id: string) {
  const ticket = await tx.ticket.findUnique({ where: { id } });
  if (!ticket) throw new NotFoundError('Ticket');
  return ticket;
}

async function assertActiveUser(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new ValidationError([{ path: 'assigneeId', message: 'Assignee must be an active user' }]);
  }
}

export async function createTicket(input: z.infer<typeof createTicketSchema>, actor: Actor) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new ValidationError([{ path: 'customerId', message: 'Customer not found' }]);
  if (input.assigneeId) await assertActiveUser(prisma, input.assigneeId);

  const now = new Date();
  const { slaResponseDueAt, slaResolutionDueAt } = computeSlaDueDates(input.priority as TicketPriority, now);

  return prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    const ticket = await tx.ticket.create({
      data: {
        reference,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        category: input.category,
        channel: input.channel,
        customerId: input.customerId,
        assigneeId: input.assigneeId ?? null,
        createdById: actor.id,
        slaResponseDueAt,
        slaResolutionDueAt,
      },
      include: ticketInclude,
    });

    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: 'CREATED' },
    });
    if (ticket.assigneeId) {
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: actor.id,
          type: 'ASSIGNED',
          field: 'assigneeId',
          toValue: ticket.assigneeId,
        },
      });
    }

    return attachDerived(ticket, now);
  });
}

export async function getTicketFull(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketInclude,
      comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
      events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true } } } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket');
  return attachDerived(ticket);
}

export async function getTicketEvents(id: string) {
  await getOr404(prisma, id);
  return prisma.ticketEvent.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, name: true } } },
  });
}

const PRIORITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

export async function listTickets(
  query: z.infer<typeof listTicketsQuerySchema>,
  actor: Actor,
) {
  const now = new Date();
  const where: Prisma.TicketWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = query.category;
  if (query.channel) where.channel = query.channel;
  if (query.customerId) where.customerId = query.customerId;
  if (query.assigneeId) where.assigneeId = query.assigneeId;
  if (query.mine) where.assigneeId = actor.id;
  if (query.q) {
    where.OR = [
      { subject: { contains: query.q } },
      { description: { contains: query.q } },
      { reference: { contains: query.q } },
    ];
  }
  if (query.breaching) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { AND: [{ resolvedAt: null }, { slaResolutionDueAt: { lt: now } }] },
          { AND: [{ firstRespondedAt: null }, { slaResponseDueAt: { lt: now } }] },
        ],
      },
    ];
  }

  const isPrioritySort = query.sort === 'priority' || query.sort === '-priority';

  if (!isPrioritySort) {
    const orderBy: Prisma.TicketOrderByWithRelationInput =
      query.sort === 'createdAt'
        ? { createdAt: 'asc' }
        : query.sort === 'slaResolutionDueAt'
          ? { slaResolutionDueAt: 'asc' }
          : query.sort === '-slaResolutionDueAt'
            ? { slaResolutionDueAt: 'desc' }
            : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: ticketInclude,
      }),
      prisma.ticket.count({ where }),
    ]);
    return { data: rows.map((t) => attachDerived(t, now)), page: query.page, pageSize: query.pageSize, total };
  }

  // Priority has no natural SQL ordering as a string column — sort in memory.
  // Bounded to a sane cap; fine at this application's scale (SPEC assumption).
  const CAP = 2000;
  const all = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: CAP,
    include: ticketInclude,
  });
  const sorted = [...all].sort((a, b) => {
    const diff = PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]!;
    return query.sort === 'priority' ? diff : -diff;
  });
  const total = sorted.length;
  const page = sorted.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  return { data: page.map((t) => attachDerived(t, now)), page: query.page, pageSize: query.pageSize, total };
}

export async function updateTicket(
  id: string,
  patch: z.infer<typeof updateTicketSchema>,
  actor: Actor,
) {
  const existing = await getOr404(prisma, id);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const data: Prisma.TicketUncheckedUpdateInput = {};
    const events: Prisma.TicketEventCreateManyInput[] = [];

    for (const field of ['subject', 'description', 'category', 'channel'] as const) {
      const next = patch[field];
      if (next !== undefined && next !== existing[field]) {
        (data as Record<string, unknown>)[field] = next;
        events.push({
          ticketId: id,
          actorId: actor.id,
          type: 'UPDATED',
          field,
          fromValue: String(existing[field]),
          toValue: String(next),
        });
      }
    }

    if (patch.priority !== undefined && patch.priority !== existing.priority) {
      const recomputed = recomputeSlaOnPriorityChange(
        patch.priority as TicketPriority,
        existing.createdAt,
        existing.firstRespondedAt,
        existing.slaResponseDueAt,
      );
      data.priority = patch.priority;
      data.slaResponseDueAt = recomputed.slaResponseDueAt;
      data.slaResolutionDueAt = recomputed.slaResolutionDueAt;
      events.push({
        ticketId: id,
        actorId: actor.id,
        type: 'PRIORITY_CHANGED',
        field: 'priority',
        fromValue: existing.priority,
        toValue: patch.priority,
      });
    }

    if (patch.status !== undefined && patch.status !== existing.status) {
      assertTransition(existing.status as never, patch.status as never);
      data.status = patch.status;

      if (isReopen(existing.status as never, patch.status as never)) {
        data.resolvedAt = null;
        data.closedAt = null;
        events.push({
          ticketId: id,
          actorId: actor.id,
          type: 'REOPENED',
          field: 'status',
          fromValue: existing.status,
          toValue: patch.status,
        });
      } else {
        if (patch.status === 'RESOLVED') data.resolvedAt = now;
        if (patch.status === 'CLOSED') data.closedAt = now;
        events.push({
          ticketId: id,
          actorId: actor.id,
          type: 'STATUS_CHANGED',
          field: 'status',
          fromValue: existing.status,
          toValue: patch.status,
        });
      }

      if (existing.status === 'OPEN' && patch.status === 'IN_PROGRESS' && !existing.firstRespondedAt) {
        data.firstRespondedAt = now;
      }
    }

    if (patch.assigneeId !== undefined && patch.assigneeId !== existing.assigneeId) {
      if (patch.assigneeId) {
        await assertActiveUser(tx, patch.assigneeId);
        data.assigneeId = patch.assigneeId;
        events.push({
          ticketId: id,
          actorId: actor.id,
          type: 'ASSIGNED',
          field: 'assigneeId',
          fromValue: existing.assigneeId,
          toValue: patch.assigneeId,
        });
      } else {
        data.assigneeId = null;
        events.push({
          ticketId: id,
          actorId: actor.id,
          type: 'UNASSIGNED',
          field: 'assigneeId',
          fromValue: existing.assigneeId,
          toValue: null,
        });
      }
    }

    if (Object.keys(data).length === 0) {
      const unchanged = await tx.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
      return attachDerived(unchanged, now);
    }

    const updated = await tx.ticket.update({ where: { id }, data, include: ticketInclude });
    if (events.length > 0) {
      await tx.ticketEvent.createMany({ data: events });
    }
    return attachDerived(updated, now);
  });
}

export async function assignTicket(id: string, assigneeId: string | null, actor: Actor) {
  const existing = await getOr404(prisma, id);
  if (existing.assigneeId === assigneeId) {
    return attachDerived(await prisma.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude }));
  }

  return prisma.$transaction(async (tx) => {
    if (assigneeId) await assertActiveUser(tx, assigneeId);
    const updated = await tx.ticket.update({
      where: { id },
      data: { assigneeId },
      include: ticketInclude,
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: actor.id,
        type: assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
        field: 'assigneeId',
        fromValue: existing.assigneeId,
        toValue: assigneeId,
      },
    });
    return attachDerived(updated);
  });
}

export async function escalateTicket(id: string, actor: Actor) {
  const existing = await getOr404(prisma, id);
  const newPriority = bumpPriority(existing.priority as TicketPriority);
  const { slaResolutionDueAt } = recomputeSlaOnPriorityChange(
    newPriority,
    existing.createdAt,
    existing.firstRespondedAt,
    existing.slaResponseDueAt,
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: { isEscalated: true, priority: newPriority, slaResolutionDueAt },
      include: ticketInclude,
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: actor.id,
        type: 'ESCALATED',
        field: 'priority',
        fromValue: existing.priority,
        toValue: newPriority,
      },
    });
    return attachDerived(updated);
  });
}

export async function addComment(id: string, input: { body: string; isInternal: boolean }, actor: Actor) {
  const existing = await getOr404(prisma, id);

  return prisma.$transaction(async (tx) => {
    const comment = await tx.ticketComment.create({
      data: { ticketId: id, authorId: actor.id, body: input.body, isInternal: input.isInternal },
      include: { author: { select: { id: true, name: true } } },
    });

    if (!input.isInternal && !existing.firstRespondedAt) {
      await tx.ticket.update({ where: { id }, data: { firstRespondedAt: new Date() } });
    }

    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        actorId: actor.id,
        type: 'COMMENTED',
        note: input.isInternal ? 'internal note' : 'reply to customer',
      },
    });

    return comment;
  });
}
