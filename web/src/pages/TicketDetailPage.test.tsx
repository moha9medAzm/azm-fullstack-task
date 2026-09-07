import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { TicketDetailPage } from './TicketDetailPage';
import { setToken } from '../api/client';
import { Providers } from '../test/testUtils';

const now = new Date().toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    reference: 'TKT-0001',
    subject: 'Cannot log in',
    description: 'Getting a 500 error on login',
    status: 'OPEN',
    priority: 'HIGH',
    category: 'TECHNICAL',
    channel: 'WEB',
    isEscalated: false,
    slaResponseDueAt: future,
    slaResolutionDueAt: future,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    customerId: 'c1',
    customer: { id: 'c1', name: 'Ada Lovelace', email: 'ada@example.com', company: null },
    assigneeId: null,
    assignee: null,
    createdById: 'u1',
    createdBy: { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'AGENT' },
    slaResponseBreached: false,
    slaResolutionBreached: false,
    slaResponseRemainingMs: 3_600_000,
    slaResolutionRemainingMs: 3_600_000,
    comments: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  setToken('fake-jwt');
});

describe('TicketDetailPage', () => {
  it('posts a new comment and shows it after refetch', async () => {
    let commentPosted = false;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.pathname === '/api/users') {
        return json({ data: [] });
      }
      if (url.pathname === '/api/tickets/t1/events') {
        return json({ data: [] });
      }
      if (url.pathname === '/api/tickets/t1/comments' && method === 'POST') {
        commentPosted = true;
        return json(
          {
            comment: {
              id: 'cm1',
              body: 'On it',
              isInternal: false,
              author: { id: 'u1', name: 'Alice' },
              createdAt: now,
            },
          },
          201,
        );
      }
      if (url.pathname === '/api/tickets/t1') {
        const comments = commentPosted
          ? [
              {
                id: 'cm1',
                body: 'On it',
                isInternal: false,
                author: { id: 'u1', name: 'Alice' },
                createdAt: now,
              },
            ]
          : [];
        return json({
          ticket: baseTicket({ comments, firstRespondedAt: commentPosted ? now : null }),
        });
      }
      throw new Error(`Unhandled request: ${method} ${url.pathname}`);
    });

    render(
      <Providers initialEntries={['/tickets/t1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </Providers>,
    );

    await waitFor(() => expect(screen.getByText('Cannot log in')).toBeInTheDocument());
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/write a reply/i), 'On it');
    await user.click(screen.getByRole('button', { name: /^post$/i }));

    await waitFor(() => expect(screen.getByText('On it')).toBeInTheDocument());
    expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument();
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
