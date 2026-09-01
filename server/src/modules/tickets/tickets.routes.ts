import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  idParamSchema,
  createTicketSchema,
  updateTicketSchema,
  assignTicketSchema,
  createCommentSchema,
  listTicketsQuerySchema,
} from './tickets.schemas';
import * as tickets from './tickets.service';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate, authorize('ADMIN', 'AGENT'));

ticketsRouter.get(
  '/',
  validate({ query: listTicketsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.valid.query as ReturnType<typeof listTicketsQuerySchema.parse>;
    const result = await tickets.listTickets(query, req.user!);
    res.json(result);
  }),
);

ticketsRouter.post(
  '/',
  validate({ body: createTicketSchema }),
  asyncHandler(async (req, res) => {
    const body = req.valid.body as ReturnType<typeof createTicketSchema.parse>;
    const ticket = await tickets.createTicket(body, req.user!);
    res.status(201).json({ ticket });
  }),
);

ticketsRouter.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const ticket = await tickets.getTicketFull(id);
    res.json({ ticket });
  }),
);

ticketsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateTicketSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const body = req.valid.body as ReturnType<typeof updateTicketSchema.parse>;
    const ticket = await tickets.updateTicket(id, body, req.user!);
    res.json({ ticket });
  }),
);

ticketsRouter.post(
  '/:id/assign',
  validate({ params: idParamSchema, body: assignTicketSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const { assigneeId } = req.valid.body as ReturnType<typeof assignTicketSchema.parse>;
    const ticket = await tickets.assignTicket(id, assigneeId, req.user!);
    res.json({ ticket });
  }),
);

ticketsRouter.post(
  '/:id/escalate',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const ticket = await tickets.escalateTicket(id, req.user!);
    res.json({ ticket });
  }),
);

ticketsRouter.post(
  '/:id/comments',
  validate({ params: idParamSchema, body: createCommentSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const body = req.valid.body as ReturnType<typeof createCommentSchema.parse>;
    const comment = await tickets.addComment(id, body, req.user!);
    res.status(201).json({ comment });
  }),
);

ticketsRouter.get(
  '/:id/events',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const events = await tickets.getTicketEvents(id);
    res.json({ data: events });
  }),
);
