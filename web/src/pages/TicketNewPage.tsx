import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useCreateTicket, useCreateCustomer, useCustomers, useUsers } from '../api/hooks';
import { ErrorBanner } from '../components/ErrorBanner';
import { TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES } from '../api/types';

const schema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(10_000),
  customerId: z.string().min(1, 'Pick a customer'),
  priority: z.enum(TICKET_PRIORITIES),
  category: z.enum(TICKET_CATEGORIES),
  channel: z.enum(TICKET_CHANNELS),
  assigneeId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function TicketNewPage() {
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const createCustomer = useCreateCustomer();
  const users = useUsers();
  const [customerQuery, setCustomerQuery] = useState('');
  const customers = useCustomers({ q: customerQuery, pageSize: 10 });
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '' });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM', category: 'GENERAL', channel: 'WEB' },
  });
  const selectedCustomerId = watch('customerId');

  async function onSubmit(values: FormValues) {
    const ticket = await createTicket.mutateAsync({
      ...values,
      assigneeId: values.assigneeId || null,
    });
    navigate(`/tickets/${ticket.ticket.id}`);
  }

  async function handleCreateCustomer() {
    if (!newCustomer.name || !newCustomer.email) return;
    const result = await createCustomer.mutateAsync(newCustomer);
    setValue('customerId', result.customer.id, { shouldValidate: true });
    setShowNewCustomer(false);
  }

  return (
    <div className="page page-narrow">
      <h1>New ticket</h1>
      <form className="form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="field">
          <span>Subject</span>
          <input {...register('subject')} />
          {errors.subject && <span className="field-error">{errors.subject.message}</span>}
        </label>

        <label className="field">
          <span>Description</span>
          <textarea rows={5} {...register('description')} />
          {errors.description && <span className="field-error">{errors.description.message}</span>}
        </label>

        <div className="field">
          <span>Customer</span>
          <input
            type="search"
            placeholder="Search customers by name/email…"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
          />
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <select {...field}>
                <option value="">Select a customer…</option>
                {customers.data?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            )}
          />
          {errors.customerId && <span className="field-error">{errors.customerId.message}</span>}
          {!showNewCustomer && (
            <button type="button" className="btn btn-link" onClick={() => setShowNewCustomer(true)}>
              + Create a new customer instead
            </button>
          )}
          {showNewCustomer && (
            <div className="inline-create">
              <input
                placeholder="Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))}
              />
              <button
                type="button"
                className="btn"
                onClick={handleCreateCustomer}
                disabled={createCustomer.isPending}
              >
                Add customer
              </button>
              {createCustomer.isError && <ErrorBanner error={createCustomer.error} />}
            </div>
          )}
          {selectedCustomerId && (
            <p className="muted">Selected customer id: {selectedCustomerId}</p>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>Priority</span>
            <select {...register('priority')}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Category</span>
            <select {...register('category')}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Channel</span>
            <select {...register('channel')}>
              {TICKET_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Assign to (optional)</span>
          <select {...register('assigneeId')}>
            <option value="">Unassigned</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        {createTicket.isError && <ErrorBanner error={createTicket.error} />}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || createTicket.isPending}
        >
          {createTicket.isPending ? 'Creating…' : 'Create ticket'}
        </button>
      </form>
    </div>
  );
}
