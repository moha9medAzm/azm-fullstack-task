import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUsers, useCreateUser, useUpdateUser } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { ROLES } from '../api/types';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(ROLES),
});
type FormValues = z.infer<typeof schema>;

export function AdminUsersPage() {
  const users = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'AGENT' } });

  async function onSubmit(values: FormValues) {
    await createUser.mutateAsync(values);
    reset();
    setShowForm(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New user'}
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
              <span>Temporary password</span>
              <input type="password" {...register('password')} />
              {errors.password && <span className="field-error">{errors.password.message}</span>}
            </label>
            <label className="field">
              <span>Role</span>
              <select {...register('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createUser.isError && <ErrorBanner error={createUser.error} />}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Create user
          </button>
        </form>
      )}

      {users.isLoading && <Spinner label="Loading users…" />}
      {users.isError && <ErrorBanner error={users.error} />}

      {users.data && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) =>
                        updateUser.mutate({
                          id: u.id,
                          role: e.target.value as (typeof ROLES)[number],
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {updateUser.isError && <ErrorBanner error={updateUser.error} />}
    </div>
  );
}
