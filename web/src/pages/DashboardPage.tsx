import { Link } from 'react-router-dom';
import { useDashboardStats, useTickets } from '../api/hooks';
import { StatCard } from '../components/StatCard';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { formatRelative } from '../lib/format';
import { titleCase } from '../lib/format';

export function DashboardPage() {
  const stats = useDashboardStats();
  const breaching = useTickets({ breaching: true, pageSize: 5, sort: 'slaResolutionDueAt' });
  const unassigned = useTickets({ unassigned: true, pageSize: 5, sort: '-priority' });

  if (stats.isLoading) return <Spinner label="Loading dashboard…" />;
  if (stats.isError) return <ErrorBanner error={stats.error} />;
  const data = stats.data!;

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="stat-grid">
        <StatCard label="My open tickets" value={data.myOpen} />
        <StatCard label="Unassigned" value={data.unassigned} tone={data.unassigned > 0 ? 'warn' : 'default'} />
        <StatCard label="Response SLA breaching" value={data.breachingResponse} tone={data.breachingResponse > 0 ? 'danger' : 'default'} />
        <StatCard label="Resolution SLA breaching" value={data.breachingResolution} tone={data.breachingResolution > 0 ? 'danger' : 'default'} />
        <StatCard label="Resolved (7 days)" value={data.resolvedLast7d} />
      </div>

      <section className="panel">
        <h2>Queue by status</h2>
        <div className="pill-row">
          {Object.entries(data.byStatus).map(([status, count]) => (
            <Link key={status} to={`/tickets?status=${status}`} className="pill">
              <StatusBadge status={status as never} /> <strong>{count}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Queue by priority</h2>
        <div className="pill-row">
          {Object.entries(data.byPriority).map(([priority, count]) => (
            <Link key={priority} to={`/tickets?priority=${priority}`} className="pill">
              <PriorityBadge priority={priority as never} /> <strong>{count}</strong>
            </Link>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Breaching SLA soonest</h2>
          {breaching.isLoading && <Spinner />}
          {breaching.data && breaching.data.data.length === 0 && <p className="muted">Nothing breaching — nice work.</p>}
          <ul className="ticket-mini-list">
            {breaching.data?.data.map((t) => (
              <li key={t.id}>
                <Link to={`/tickets/${t.id}`}>
                  {t.reference} — {t.subject}
                </Link>
                <span className="muted"> · {titleCase(t.status)} · due {formatRelative(t.slaResolutionDueAt)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Unassigned, highest priority first</h2>
          {unassigned.isLoading && <Spinner />}
          <ul className="ticket-mini-list">
            {unassigned.data?.data.map((t) => (
              <li key={t.id}>
                <Link to={`/tickets/${t.id}`}>
                  {t.reference} — {t.subject}
                </Link>
                <span className="muted">
                  {' '}
                  · <PriorityBadge priority={t.priority} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
