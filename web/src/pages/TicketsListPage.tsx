import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTickets, useUsers } from '../api/hooks';
import type { TicketListQuery } from '../api/hooks';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatRelative } from '../lib/format';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../api/types';

const PAGE_SIZE = 20;

export function TicketsListPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const page = Number(params.get('page') ?? '1');
  const users = useUsers();

  const query: TicketListQuery = {
    page,
    pageSize: PAGE_SIZE,
    status: (params.get('status') as TicketListQuery['status']) || undefined,
    priority: (params.get('priority') as TicketListQuery['priority']) || undefined,
    category: (params.get('category') as TicketListQuery['category']) || undefined,
    assigneeId: params.get('assigneeId') || undefined,
    mine: params.get('mine') === 'true' || undefined,
    unassigned: params.get('unassigned') === 'true' || undefined,
    breaching: params.get('breaching') === 'true' || undefined,
    q: params.get('q') || undefined,
    sort: params.get('sort') || '-createdAt',
  };

  const tickets = useTickets(query);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam('q', q || null);
  }

  const totalPages = tickets.data ? Math.max(1, Math.ceil(tickets.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tickets</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          New ticket
        </Link>
      </div>

      <form className="filter-bar" onSubmit={submitSearch}>
        <input
          type="search"
          placeholder="Search subject, description, reference…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          value={params.get('status') ?? ''}
          onChange={(e) => updateParam('status', e.target.value || null)}
        >
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={params.get('priority') ?? ''}
          onChange={(e) => updateParam('priority', e.target.value || null)}
        >
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={params.get('category') ?? ''}
          onChange={(e) => updateParam('category', e.target.value || null)}
        >
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={params.get('assigneeId') ?? ''}
          onChange={(e) => updateParam('assigneeId', e.target.value || null)}
        >
          <option value="">Any assignee</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={params.get('mine') === 'true'}
            onChange={(e) => updateParam('mine', e.target.checked ? 'true' : null)}
          />
          Mine
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={params.get('unassigned') === 'true'}
            onChange={(e) => updateParam('unassigned', e.target.checked ? 'true' : null)}
          />
          Unassigned
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={params.get('breaching') === 'true'}
            onChange={(e) => updateParam('breaching', e.target.checked ? 'true' : null)}
          />
          Breaching SLA
        </label>

        <select
          value={params.get('sort') ?? '-createdAt'}
          onChange={(e) => updateParam('sort', e.target.value)}
        >
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="-priority">Priority: high to low</option>
          <option value="priority">Priority: low to high</option>
          <option value="slaResolutionDueAt">SLA due soonest</option>
        </select>

        <button type="submit" className="btn">
          Search
        </button>
      </form>

      {tickets.isLoading && <Spinner label="Loading tickets…" />}
      {tickets.isError && <ErrorBanner error={tickets.error} />}

      {tickets.data && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.data.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted center">
                      No tickets match these filters.
                    </td>
                  </tr>
                )}
                {tickets.data.data.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/tickets/${t.id}`}>{t.reference}</Link>
                    </td>
                    <td>
                      {t.subject}
                      {t.isEscalated && (
                        <span className="badge badge-red escalated-tag">Escalated</span>
                      )}
                    </td>
                    <td>{t.customer.name}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td>
                      {t.assignee ? t.assignee.name : <span className="muted">Unassigned</span>}
                    </td>
                    <td className="muted">{formatRelative(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              type="button"
              className="btn"
              disabled={page <= 1}
              onClick={() => updateParam('page', String(page - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} ({tickets.data.total} total)
            </span>
            <button
              type="button"
              className="btn"
              disabled={page >= totalPages}
              onClick={() => updateParam('page', String(page + 1))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
