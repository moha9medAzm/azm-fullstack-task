import type { TicketPriority, TicketStatus } from '../api/types';
import type { SlaTone } from '../lib/sla';
import { titleCase } from '../lib/format';

const STATUS_TONE: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'amber',
  PENDING: 'purple',
  RESOLVED: 'green',
  CLOSED: 'gray',
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'amber',
  URGENT: 'red',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge badge-${STATUS_TONE[status]}`}>{titleCase(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`badge badge-${PRIORITY_TONE[priority]}`}>{titleCase(priority)}</span>;
}

const SLA_TONE_CLASS: Record<SlaTone, string> = { ok: 'green', warn: 'amber', danger: 'red' };

export function SlaBadge({ tone, label }: { tone: SlaTone; label: string }) {
  return <span className={`badge badge-${SLA_TONE_CLASS[tone]}`}>{label}</span>;
}
