import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Customer,
  DashboardStats,
  Paginated,
  Ticket,
  TicketCategory,
  TicketChannel,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  User,
} from './types';

// ---------- Users ----------

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ data: User[] }>('/users').then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      role: 'ADMIN' | 'AGENT';
    }) => api.post<{ user: User }>('/users', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      role?: 'ADMIN' | 'AGENT';
      isActive?: boolean;
    }) => api.patch<{ user: User }>(`/users/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ---------- Customers ----------

export type CustomerListQuery = { page?: number; pageSize?: number; q?: string };

export function useCustomers(query: CustomerListQuery) {
  return useQuery({
    queryKey: ['customers', query],
    queryFn: () => api.get<Paginated<Customer>>('/customers', query),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get<{ customer: Customer }>(`/customers/${id}`).then((r) => r.customer),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
      notes?: string;
    }) => api.post<{ customer: Customer }>('/customers', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<
      Pick<Customer, 'name' | 'email' | 'phone' | 'company' | 'notes'>
    >) => api.patch<{ customer: Customer }>(`/customers/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers', vars.id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

// ---------- Tickets ----------

export type TicketListQuery = {
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  channel?: TicketChannel;
  assigneeId?: string;
  customerId?: string;
  mine?: boolean;
  unassigned?: boolean;
  breaching?: boolean;
  q?: string;
  sort?: string;
};

export function useTickets(query: TicketListQuery) {
  return useQuery({
    queryKey: ['tickets', query],
    queryFn: () =>
      api.get<Paginated<Ticket>>(
        '/tickets',
        query as Record<string, string | number | boolean | undefined>,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => api.get<{ ticket: Ticket }>(`/tickets/${id}`).then((r) => r.ticket),
    enabled: Boolean(id),
    refetchInterval: 30_000, // keep SLA countdowns/badges reasonably fresh
  });
}

export function useTicketEvents(id: string | undefined) {
  return useQuery({
    queryKey: ['tickets', id, 'events'],
    queryFn: () => api.get<{ data: TicketEvent[] }>(`/tickets/${id}/events`).then((r) => r.data),
    enabled: Boolean(id),
  });
}

function invalidateTicket(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['tickets'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  void id;
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subject: string;
      description: string;
      customerId: string;
      priority?: TicketPriority;
      category?: TicketCategory;
      channel?: TicketChannel;
      assigneeId?: string | null;
    }) => api.post<{ ticket: Ticket }>('/tickets', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<{
        subject: string;
        description: string;
        status: TicketStatus;
        priority: TicketPriority;
        category: TicketCategory;
        channel: TicketChannel;
        assigneeId: string | null;
      }>,
    ) => api.patch<{ ticket: Ticket }>(`/tickets/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', id] });
      qc.invalidateQueries({ queryKey: ['tickets', id, 'events'] });
      invalidateTicket(qc, id);
    },
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.post<{ ticket: Ticket }>(`/tickets/${id}/assign`, { assigneeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', id] });
      qc.invalidateQueries({ queryKey: ['tickets', id, 'events'] });
      invalidateTicket(qc, id);
    },
  });
}

export function useEscalateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ticket: Ticket }>(`/tickets/${id}/escalate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', id] });
      qc.invalidateQueries({ queryKey: ['tickets', id, 'events'] });
      invalidateTicket(qc, id);
    },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; isInternal?: boolean }) =>
      api.post<{ comment: TicketComment }>(`/tickets/${id}/comments`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', id] });
      qc.invalidateQueries({ queryKey: ['tickets', id, 'events'] });
    },
  });
}

// ---------- Dashboard ----------

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
    refetchInterval: 30_000,
  });
}
