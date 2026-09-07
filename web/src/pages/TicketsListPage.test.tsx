import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketsListPage } from './TicketsListPage';
import { setToken } from '../api/client';
import { Providers } from '../test/testUtils';

const baseTicket = {
  id: 't1',
  reference: 'TKT-0001',
  subject: 'Cannot log in',
  status: 'OPEN',
  priority: 'HIGH',
  isEscalated: false,
  createdAt: new Date().toISOString(),
  customer: { id: 'c1', name: 'Ada Lovelace' },
  assignee: null,
};

beforeEach(() => {
  localStorage.clear();
  setToken('fake-jwt');
});

function fetchMock(ticketsForStatus: Record<string, unknown[]>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    if (url.pathname === '/api/users') {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.pathname === '/api/tickets') {
      const status = url.searchParams.get('status') ?? 'ALL';
      const data = ticketsForStatus[status] ?? ticketsForStatus.ALL ?? [];
      return new Response(JSON.stringify({ data, page: 1, pageSize: 20, total: data.length }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unhandled request: ${url.pathname}`);
  });
}

describe('TicketsListPage', () => {
  it('renders tickets from the API', async () => {
    globalThis.fetch = fetchMock({ ALL: [baseTicket] });

    render(<TicketsListPage />, { wrapper: ({ children }) => <Providers>{children}</Providers> });

    await waitFor(() => expect(screen.getByText('TKT-0001')).toBeInTheDocument());
    expect(screen.getByText('Cannot log in')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('refetches with a status filter when the status select changes', async () => {
    globalThis.fetch = fetchMock({
      ALL: [baseTicket],
      RESOLVED: [
        {
          ...baseTicket,
          id: 't2',
          reference: 'TKT-0002',
          subject: 'Already fixed',
          status: 'RESOLVED',
        },
      ],
    });

    render(<TicketsListPage />, { wrapper: ({ children }) => <Providers>{children}</Providers> });
    await waitFor(() => expect(screen.getByText('TKT-0001')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'RESOLVED');

    await waitFor(() => expect(screen.getByText('TKT-0002')).toBeInTheDocument());
    expect(screen.queryByText('TKT-0001')).not.toBeInTheDocument();
  });
});
