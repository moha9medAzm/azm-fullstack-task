import { Router } from 'express';

/**
 * Everything under `/api`. Feature routers are mounted here as each module
 * lands (auth, users, customers, tickets, dashboard, admin).
 */
export const apiRouter = Router();
