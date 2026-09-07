import type { TicketEvent } from '../api/types';
import type { User } from '../api/types';
import { formatDateTime, titleCase } from '../lib/format';

const EVENT_LABEL: Record<TicketEvent['type'], string> = {
  CREATED: 'Ticket created',
  UPDATED: 'Field updated',
  STATUS_CHANGED: 'Status changed',
  PRIORITY_CHANGED: 'Priority changed',
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  ESCALATED: 'Escalated',
  COMMENTED: 'Comment added',
  SLA_RESPONSE_BREACHED: 'Response SLA breached',
  SLA_RESOLUTION_BREACHED: 'Resolution SLA breached',
  REOPENED: 'Reopened',
};

const FIELD_LABEL: Record<string, string> = {
  assigneeId: 'Assignee',
  status: 'Status',
  priority: 'Priority',
  subject: 'Subject',
  description: 'Description',
  category: 'Category',
  channel: 'Channel',
};

function resolveValue(value: string | null, usersById: Map<string, User>): string {
  if (value === null) return '—';
  return usersById.get(value)?.name ?? titleCase(value);
}

export function EventLine({
  event,
  usersById,
}: {
  event: TicketEvent;
  usersById: Map<string, User>;
}) {
  const isPersonRef = event.field === 'assigneeId';
  const from = isPersonRef ? resolveValue(event.fromValue, usersById) : event.fromValue;
  const to = isPersonRef ? resolveValue(event.toValue, usersById) : event.toValue;

  return (
    <li className={`event-line event-${event.type.toLowerCase()}`}>
      <div className="event-line-head">
        <strong>{EVENT_LABEL[event.type]}</strong>
        <span className="muted">{formatDateTime(event.createdAt)}</span>
      </div>
      <div className="event-line-body">
        {event.field && from !== null && to !== null && (
          <span>
            {FIELD_LABEL[event.field] ?? titleCase(event.field)}: <code>{from ?? '—'}</code> →{' '}
            <code>{to ?? '—'}</code>
          </span>
        )}
        {event.note && <span>{event.note}</span>}
        <span className="muted"> · by {event.actor?.name ?? 'system'}</span>
      </div>
    </li>
  );
}
