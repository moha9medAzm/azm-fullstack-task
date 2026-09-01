import { prisma } from '../../src/db/prisma';

/** Wipe all rows between tests, children first to respect FKs. */
export async function resetDb() {
  await prisma.ticketEvent.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
