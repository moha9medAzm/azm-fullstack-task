import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCustomer, useUpdateCustomer, useDeleteCustomer } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const customer = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', company: '', notes: '' });

  if (customer.isLoading) return <Spinner label="Loading customer…" />;
  if (customer.isError) return <ErrorBanner error={customer.error} />;
  const c = customer.data!;

  function startEdit() {
    setDraft({ name: c.name, phone: c.phone ?? '', company: c.company ?? '', notes: c.notes ?? '' });
    setEditing(true);
  }

  async function saveEdit() {
    await updateCustomer.mutateAsync({ id: c.id, ...draft });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${c.name}? This is only possible once all their tickets are closed.`)) return;
    try {
      await deleteCustomer.mutateAsync(c.id);
      navigate('/customers');
    } catch {
      // error surfaced via deleteCustomer.error below
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <h1>{c.name}</h1>
        {user?.role === 'ADMIN' && (
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleteCustomer.isPending}>
            Delete
          </button>
        )}
      </div>
      {deleteCustomer.isError && <ErrorBanner error={deleteCustomer.error} />}

      <section className="panel">
        <div className="page-header">
          <h2>Profile</h2>
          {!editing && (
            <button type="button" className="btn" onClick={startEdit}>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="form-card">
            <label className="field">
              <span>Name</span>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
            </label>
            <label className="field">
              <span>Company</span>
              <input value={draft.company} onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea rows={4} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
            </label>
            {updateCustomer.isError && <ErrorBanner error={updateCustomer.error} />}
            <div className="comment-form-actions">
              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={updateCustomer.isPending}>
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="detail-list">
            <dt>Email</dt>
            <dd>{c.email}</dd>
            <dt>Phone</dt>
            <dd>{c.phone ?? '—'}</dd>
            <dt>Company</dt>
            <dd>{c.company ?? '—'}</dd>
            <dt>Notes</dt>
            <dd>{c.notes ?? '—'}</dd>
            <dt>Customer since</dt>
            <dd>{formatDateTime(c.createdAt)}</dd>
          </dl>
        )}
      </section>

      <section className="panel">
        <h2>Ticket history</h2>
        {c.tickets && c.tickets.length === 0 && <p className="muted">No tickets yet.</p>}
        <ul className="ticket-mini-list">
          {c.tickets?.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`}>
                {t.reference} — {t.subject}
              </Link>
              <span className="muted">
                {' '}
                · <StatusBadge status={t.status} /> <PriorityBadge priority={t.priority} /> · {formatDateTime(t.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
