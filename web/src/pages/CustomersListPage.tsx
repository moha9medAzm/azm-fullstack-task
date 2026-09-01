import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCustomers, useCreateCustomer } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatDateTime } from '../lib/format';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CustomersListPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const customers = useCustomers({ q: q || undefined, page, pageSize: 20 });
  const createCustomer = useCreateCustomer();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    await createCustomer.mutateAsync(values);
    reset();
    setShowForm(false);
  }

  const totalPages = customers.data ? Math.max(1, Math.ceil(customers.data.total / 20)) : 1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customers</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New customer'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input {...register('name')} />
              {errors.name && <span className="field-error">{errors.name.message}</span>}
            </label>
            <label className="field">
              <span>Email</span>
              <input {...register('email')} />
              {errors.email && <span className="field-error">{errors.email.message}</span>}
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Phone</span>
              <input {...register('phone')} />
            </label>
            <label className="field">
              <span>Company</span>
              <input {...register('company')} />
            </label>
          </div>
          {createCustomer.isError && <ErrorBanner error={createCustomer.error} />}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Create customer
          </button>
        </form>
      )}

      <input
        type="search"
        placeholder="Search by name, email, company, phone…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="search-input"
      />

      {customers.isLoading && <Spinner label="Loading customers…" />}
      {customers.isError && <ErrorBanner error={customers.error} />}

      {customers.data && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted center">
                      No customers found.
                    </td>
                  </tr>
                )}
                {customers.data.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/customers/${c.id}`}>{c.name}</Link>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.company ?? '—'}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td className="muted">{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages} ({customers.data.total} total)
            </span>
            <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
