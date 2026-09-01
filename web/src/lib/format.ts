import { formatDistanceToNow, format } from 'date-fns';

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy HH:mm');
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
