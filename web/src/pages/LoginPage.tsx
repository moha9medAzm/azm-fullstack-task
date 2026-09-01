import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Login failed');
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Support CRM</h1>
        <p className="muted">Sign in to your agent console</p>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" {...register('email')} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </label>

        {serverError && (
          <div className="error-banner" role="alert">
            {serverError}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="auth-hint">
          <p>Seeded accounts:</p>
          <code>admin@example.com / Admin123!</code>
          <code>alice@example.com / Agent123!</code>
        </div>
      </form>
    </div>
  );
}
