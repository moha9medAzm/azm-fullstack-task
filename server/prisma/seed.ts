/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { computeSlaDueDates } from '../src/lib/sla';
import type { TicketPriority, TicketCategory, TicketChannel } from '../src/types/enums';

const prisma = new PrismaClient();

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function main() {
  console.log('Seeding database…');

  await prisma.ticketEvent.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const [admin, alice, bob] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Nadia Haddad',
        email: 'admin@example.com',
        passwordHash: await hashPassword('Admin123!'),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Alice Chen',
        email: 'alice@example.com',
        passwordHash: await hashPassword('Agent123!'),
        role: 'AGENT',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bilal Rahman',
        email: 'bilal@example.com',
        passwordHash: await hashPassword('Agent123!'),
        role: 'AGENT',
      },
    }),
  ]);
  const agents = [alice, bob];

  const customerSeed = [
    {
      name: 'Grace Hopper',
      email: 'grace@compugroup.example',
      company: 'CompuGroup',
      phone: '+1-202-555-0101',
    },
    {
      name: 'Ada Lovelace',
      email: 'ada@analyticalworks.example',
      company: 'Analytical Works',
      phone: '+1-202-555-0102',
    },
    {
      name: 'Linus Torvalds',
      email: 'linus@kernelco.example',
      company: 'Kernel Co',
      phone: '+1-202-555-0103',
    },
    {
      name: 'Margaret Hamilton',
      email: 'margaret@aptech.example',
      company: 'Apollo Tech',
      phone: '+1-202-555-0104',
    },
    {
      name: 'Katherine Johnson',
      email: 'katherine@orbitals.example',
      company: 'Orbitals Inc',
      phone: '+1-202-555-0105',
    },
    {
      name: 'Tim Berners-Lee',
      email: 'tim@webfoundation.example',
      company: 'Web Foundation',
      phone: '+1-202-555-0106',
    },
    {
      name: 'Radia Perlman',
      email: 'radia@netlayer.example',
      company: 'NetLayer',
      phone: '+1-202-555-0107',
    },
    {
      name: 'Sami Al-Amin',
      email: 'sami@nileretail.example',
      company: 'Nile Retail',
      phone: '+20-2-555-0108',
    },
  ];
  const customers = await Promise.all(customerSeed.map((c) => prisma.customer.create({ data: c })));

  const subjects = [
    'Cannot reset my password',
    'Invoice amount looks wrong',
    'App crashes on checkout',
    'Feature request: dark mode',
    'Order not received after 2 weeks',
    'API returns 500 on /orders',
    'How do I change my subscription plan?',
    'Duplicate charge on my card',
    'Export to CSV is missing columns',
    'Account locked after failed logins',
    'Mobile app is very slow',
    'Need an itemized receipt',
    'Integration with our ERP fails silently',
    'Typo in the shipping confirmation email',
    'Cannot invite teammates to workspace',
  ];

  const priorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const categories: TicketCategory[] = [
    'GENERAL',
    'TECHNICAL',
    'BILLING',
    'ACCOUNT',
    'FEATURE_REQUEST',
  ];
  const channels: TicketChannel[] = ['WEB', 'EMAIL', 'PHONE', 'CHAT', 'WHATSAPP', 'SMS'];

  let refCounter = 1;
  const nextRef = () => `TKT-${String(refCounter++).padStart(4, '0')}`;

  type Plan = {
    ageHours: number;
    priority: TicketPriority;
    status: 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED';
    assigned: boolean;
    responded: boolean;
    breachResponse?: boolean;
    breachResolution?: boolean;
    escalated?: boolean;
  };

  // A spread of ages/states/priorities, including some that are breaching SLA
  // right now so the seeded dashboard has something to show.
  const plans: Plan[] = [
    { ageHours: 200, priority: 'LOW', status: 'CLOSED', assigned: true, responded: true },
    { ageHours: 150, priority: 'LOW', status: 'RESOLVED', assigned: true, responded: true },
    { ageHours: 100, priority: 'MEDIUM', status: 'RESOLVED', assigned: true, responded: true },
    { ageHours: 90, priority: 'MEDIUM', status: 'CLOSED', assigned: true, responded: true },
    { ageHours: 80, priority: 'HIGH', status: 'IN_PROGRESS', assigned: true, responded: true },
    {
      ageHours: 76,
      priority: 'HIGH',
      status: 'PENDING',
      assigned: true,
      responded: true,
      breachResolution: true,
    },
    {
      ageHours: 70,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      assigned: true,
      responded: true,
      breachResolution: true,
      escalated: true,
    },
    {
      ageHours: 60,
      priority: 'MEDIUM',
      status: 'OPEN',
      assigned: false,
      responded: false,
      breachResponse: true,
    },
    { ageHours: 50, priority: 'LOW', status: 'OPEN', assigned: true, responded: true },
    { ageHours: 40, priority: 'MEDIUM', status: 'IN_PROGRESS', assigned: true, responded: true },
    { ageHours: 30, priority: 'HIGH', status: 'OPEN', assigned: false, responded: false },
    {
      ageHours: 20,
      priority: 'URGENT',
      status: 'OPEN',
      assigned: false,
      responded: false,
      breachResponse: true,
      breachResolution: true,
    },
    { ageHours: 15, priority: 'LOW', status: 'PENDING', assigned: true, responded: true },
    { ageHours: 10, priority: 'MEDIUM', status: 'OPEN', assigned: true, responded: false },
    { ageHours: 8, priority: 'HIGH', status: 'IN_PROGRESS', assigned: true, responded: true },
    { ageHours: 6, priority: 'LOW', status: 'OPEN', assigned: false, responded: false },
    { ageHours: 5, priority: 'MEDIUM', status: 'OPEN', assigned: true, responded: false },
    { ageHours: 4, priority: 'URGENT', status: 'OPEN', assigned: true, responded: false },
    { ageHours: 3, priority: 'HIGH', status: 'OPEN', assigned: false, responded: false },
    { ageHours: 2, priority: 'LOW', status: 'OPEN', assigned: true, responded: false },
    { ageHours: 2, priority: 'MEDIUM', status: 'OPEN', assigned: false, responded: false },
    { ageHours: 1, priority: 'HIGH', status: 'OPEN', assigned: true, responded: false },
    { ageHours: 0.5, priority: 'URGENT', status: 'OPEN', assigned: false, responded: false },
    { ageHours: 0.25, priority: 'LOW', status: 'OPEN', assigned: false, responded: false },
    { ageHours: 0.1, priority: 'MEDIUM', status: 'OPEN', assigned: true, responded: false },
  ];

  for (const [i, plan] of plans.entries()) {
    const createdAt = hoursAgo(plan.ageHours);
    const customer = customers[i % customers.length]!;
    const subject = subjects[i % subjects.length]!;
    const category = categories[i % categories.length]!;
    const channel = channels[i % channels.length]!;
    const assignee = plan.assigned ? agents[i % agents.length]! : null;
    const createdBy = agents[i % agents.length]!;

    const base = computeSlaDueDates(plan.priority, createdAt);
    let slaResponseDueAt = base.slaResponseDueAt;
    let slaResolutionDueAt = base.slaResolutionDueAt;
    if (plan.breachResponse) slaResponseDueAt = hoursAgo(0.1);
    if (plan.breachResolution) slaResolutionDueAt = hoursAgo(0.1);

    const firstRespondedAt = plan.responded ? new Date(createdAt.getTime() + 20 * 60_000) : null;
    const resolvedAt =
      plan.status === 'RESOLVED' || plan.status === 'CLOSED' ? hoursAgo(plan.ageHours / 3) : null;
    const closedAt = plan.status === 'CLOSED' ? hoursAgo(plan.ageHours / 4) : null;

    const ticket = await prisma.ticket.create({
      data: {
        reference: nextRef(),
        subject,
        description: `${subject}. Customer reported this via ${channel.toLowerCase()}.`,
        status: plan.status,
        priority: plan.priority,
        category,
        channel,
        isEscalated: plan.escalated ?? false,
        customerId: customer.id,
        assigneeId: assignee?.id ?? null,
        createdById: createdBy.id,
        slaResponseDueAt,
        slaResolutionDueAt,
        firstRespondedAt,
        resolvedAt,
        closedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: createdBy.id, type: 'CREATED', createdAt },
    });
    if (assignee) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: createdBy.id,
          type: 'ASSIGNED',
          field: 'assigneeId',
          toValue: assignee.id,
          createdAt,
        },
      });
    }
    if (plan.responded) {
      await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: assignee?.id ?? createdBy.id,
          body: 'Thanks for reaching out — looking into this now.',
          createdAt: firstRespondedAt!,
        },
      });
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: assignee?.id ?? createdBy.id,
          type: 'COMMENTED',
          note: 'reply to customer',
          createdAt: firstRespondedAt!,
        },
      });
    }
    if (plan.escalated) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: 'ESCALATED',
          field: 'priority',
          toValue: plan.priority,
          createdAt: hoursAgo(plan.ageHours / 2),
        },
      });
    }
  }

  console.log(`Seeded ${plans.length} tickets, ${customers.length} customers, 3 users.`);
  console.log('Login with:');
  console.log('  admin@example.com / Admin123!');
  console.log('  alice@example.com / Agent123!');
  console.log('  bilal@example.com / Agent123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
