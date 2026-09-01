import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { prisma } from '../../db/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { paginate, skipTake } from '../../lib/pagination';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
  idParamSchema,
} from './customers.schemas';

export const customersRouter = Router();

customersRouter.use(authenticate, authorize('ADMIN', 'AGENT'));

customersRouter.get(
  '/',
  validate({ query: listCustomersQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, q } = req.valid.query as ReturnType<typeof listCustomersQuerySchema.parse>;
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { company: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(page, pageSize) }),
      prisma.customer.count({ where }),
    ]);

    res.json(paginate(data, page, pageSize, total));
  }),
);

customersRouter.post(
  '/',
  validate({ body: createCustomerSchema }),
  asyncHandler(async (req, res) => {
    const body = req.valid.body as ReturnType<typeof createCustomerSchema.parse>;
    const customer = await prisma.customer.create({ data: body });
    res.status(201).json({ customer });
  }),
);

customersRouter.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        tickets: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            reference: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundError('Customer');
    res.json({ customer });
  }),
);

customersRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const body = req.valid.body as ReturnType<typeof updateCustomerSchema.parse>;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Customer');

    const customer = await prisma.customer.update({ where: { id }, data: body });
    res.json({ customer });
  }),
);

customersRouter.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Customer');

    const openTicketCount = await prisma.ticket.count({
      where: { customerId: id, status: { not: 'CLOSED' } },
    });
    if (openTicketCount > 0) {
      throw new ConflictError(
        'CUSTOMER_HAS_OPEN_TICKETS',
        `Cannot delete customer with ${openTicketCount} non-closed ticket(s)`,
      );
    }

    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  }),
);
