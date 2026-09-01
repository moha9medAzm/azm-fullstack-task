import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { ticketsRouter } from './modules/tickets/tickets.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { adminRouter } from './modules/admin/admin.routes';

/** Everything under `/api`. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/admin', adminRouter);
