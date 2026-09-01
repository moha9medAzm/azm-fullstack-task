import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { useAuth } from '../auth/AuthContext';
import { Providers, mockFetchOnce } from '../test/testUtils';

function Home() {
  const { user } = useAuth();
  return <div>Welcome {user?.name}</div>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('LoginPage', () => {
  it('logs in and lands on the protected home route', async () => {
    globalThis.fetch = mockFetchOnce({
      'POST /api/auth/login': () => ({
        body: { token: 'fake-jwt', user: { id: '1', name: 'Alice Chen', email: 'alice@example.com', role: 'AGENT', isActive: true } },
      }),
    });

    render(
      <Providers initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
          </Route>
        </Routes>
      </Providers>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'Agent123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Welcome Alice Chen')).toBeInTheDocument());
  });

  it('shows a server error on invalid credentials', async () => {
    globalThis.fetch = mockFetchOnce({
      'POST /api/auth/login': () => ({
        status: 401,
        body: { error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' } },
      }),
    });

    render(
      <Providers initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Providers>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
  });
});
