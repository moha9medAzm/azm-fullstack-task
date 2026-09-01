import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useTicket,
  useTicketEvents,
  useUpdateTicket,
  useAssignTicket,
  useEscalateTicket,
  useAddComment,
  useUsers,
} from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/Badge';
import { EventLine } from '../components/EventLine';
import { formatDateTime, formatRelative, titleCase } from '../lib/format';
import { resolutionSla, responseSla, SLA_TONE_LABEL } from '../lib/sla';
import { TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES, TICKET_STATUSES } from '../api/types';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticket = useTicket(id);
  const events = useTicketEvents(id);
  const users = useUsers();
  const updateTicket = useUpdateTicket(id ?? '');
  const assignTicket = useAssignTicket(id ?? '');
  const escalateTicket = useEscalateTicket(id ?? '');
  const addComment = useAddComment(id ?? '');

  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState('');

  const usersById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data]);

  if (ticket.isLoading) return <Spinner label="Loading ticket…" />;
  if (ticket.isError) return <ErrorBanner error={ticket.error} />;
  const t = ticket.data!;

  const response = responseSla(t);
  const resolution = resolutionSla(t);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await addComment.mutateAsync({ body: commentBody.trim(), isInternal });
    setCommentBody('');
    setIsInternal(false);
  }

  function startEditSubject() {
    setSubjectDraft(t.subject);
    setEditingSubject(true);
  }

  async function saveSubject() {
    if (subjectDraft.trim() && subjectDraft.trim() !== t.subject) {
      await updateTicket.mutateAsync({ subject: subjectDraft.trim() });
    }
    setEditingSubject(false);
  }

  return (
    <div className="page">
      <div className="ticket-header">
        <div>
          <span className="muted">{t.reference}</span>
          {editingSubject ? (
            <div className="inline-edit">
              <input value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} autoFocus />
              <button type="button" className="btn" onClick={saveSubject}>
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingSubject(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <h1 onClick={startEditSubject} title="Click to edit" className="editable-title">
              {t.subject}
            </h1>
          )}
        </div>
        {t.isEscalated && <span className="badge badge-red">Escalated</span>}
      </div>

      {updateTicket.isError && <ErrorBanner error={updateTicket.error} />}
      {assignTicket.isError && <ErrorBanner error={assignTicket.error} />}
      {escalateTicket.isError && <ErrorBanner error={escalateTicket.error} />}

      <div className="ticket-layout">
        <div className="ticket-main">
          <section className="panel">
            <h2>Description</h2>
            <p className="description-text">{t.description}</p>
          </section>

          <section className="panel">
            <h2>Comments</h2>
            <ul className="comment-list">
              {t.comments?.length === 0 && <p className="muted">No comments yet.</p>}
              {t.comments?.map((c) => (
                <li key={c.id} className={c.isInternal ? 'comment comment-internal' : 'comment'}>
                  <div className="comment-head">
                    <strong>{c.author.name}</strong>
                    {c.isInternal && <span className="badge badge-gray">Internal note</span>}
                    <span className="muted">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p>{c.body}</p>
                </li>
              ))}
            </ul>

            <form className="comment-form" onSubmit={submitComment}>
              <textarea
                rows={3}
                placeholder="Write a reply or internal note…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <div className="comment-form-actions">
                <label className="checkbox-field">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Internal note (not visible to customer)
                </label>
                <button type="submit" className="btn btn-primary" disabled={addComment.isPending || !commentBody.trim()}>
                  {addComment.isPending ? 'Posting…' : 'Post'}
                </button>
              </div>
              {addComment.isError && <ErrorBanner error={addComment.error} />}
            </form>
          </section>

          <section className="panel">
            <h2>Activity</h2>
            {events.isLoading && <Spinner />}
            <ul className="event-list">
              {events.data?.map((e) => (
                <EventLine key={e.id} event={e} usersById={usersById} />
              ))}
            </ul>
          </section>
        </div>

        <aside className="ticket-side">
          <section className="panel">
            <h2>Details</h2>

            <label className="field">
              <span>Status</span>
              <select
                value={t.status}
                onChange={(e) => updateTicket.mutate({ status: e.target.value as (typeof TICKET_STATUSES)[number] })}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
              <StatusBadge status={t.status} />
            </label>

            <label className="field">
              <span>Priority</span>
              <select
                value={t.priority}
                onChange={(e) => updateTicket.mutate({ priority: e.target.value as (typeof TICKET_PRIORITIES)[number] })}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <PriorityBadge priority={t.priority} />
            </label>

            <label className="field">
              <span>Category</span>
              <select
                value={t.category}
                onChange={(e) => updateTicket.mutate({ category: e.target.value as (typeof TICKET_CATEGORIES)[number] })}
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Channel</span>
              <select
                value={t.channel}
                onChange={(e) => updateTicket.mutate({ channel: e.target.value as (typeof TICKET_CHANNELS)[number] })}
              >
                {TICKET_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Assignee</span>
              <select value={t.assigneeId ?? ''} onChange={(e) => assignTicket.mutate(e.target.value || null)}>
                <option value="">Unassigned</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => escalateTicket.mutate()}
              disabled={escalateTicket.isPending || (t.isEscalated && t.priority === 'URGENT')}
            >
              {escalateTicket.isPending ? 'Escalating…' : 'Escalate'}
            </button>
          </section>

          <section className="panel">
            <h2>SLA</h2>
            <div className="sla-row">
              <span>First response</span>
              <SlaBadge tone={response.tone} label={t.firstRespondedAt ? 'Responded' : SLA_TONE_LABEL[response.tone]} />
            </div>
            <p className="muted">
              {t.firstRespondedAt ? `Responded ${formatRelative(t.firstRespondedAt)}` : `Due ${formatRelative(t.slaResponseDueAt)}`}
            </p>
            <div className="sla-row">
              <span>Resolution</span>
              <SlaBadge tone={resolution.tone} label={t.resolvedAt ? 'Resolved' : SLA_TONE_LABEL[resolution.tone]} />
            </div>
            <p className="muted">
              {t.resolvedAt ? `Resolved ${formatRelative(t.resolvedAt)}` : `Due ${formatRelative(t.slaResolutionDueAt)}`}
            </p>
          </section>

          <section className="panel">
            <h2>Customer</h2>
            <p>
              <Link to={`/customers/${t.customer.id}`}>{t.customer.name}</Link>
            </p>
            <p className="muted">{t.customer.email}</p>
            {t.customer.company && <p className="muted">{t.customer.company}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
