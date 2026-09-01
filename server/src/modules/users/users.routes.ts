import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { prisma } from '../../db/prisma';
import { hashPassword } from '../../lib/password';
import { NotFoundError } from '../../lib/errors';
import { toPublicUser } from '../auth/auth.service';
import { createUserSchema, updateUserSchema, idParamSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.use(authenticate);

// Any authenticated user can list users — agents need active ones for
// assignment pickers; admins manage the roster and also need to see
// deactivated accounts to reactivate them.
usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = req.user!.role === 'ADMIN' ? {} : { isActive: true };
    const users = await prisma.user.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ data: users.map(toPublicUser) });
  }),
);

usersRouter.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const body = req.valid.body as ReturnType<typeof createUserSchema.parse>;
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        passwordHash: await hashPassword(body.password),
      },
    });
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

usersRouter.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params as ReturnType<typeof idParamSchema.parse>;
    const body = req.valid.body as ReturnType<typeof updateUserSchema.parse>;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('User');

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      },
    });
    res.json({ user: toPublicUser(user) });
  }),
);
