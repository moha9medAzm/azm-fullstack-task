import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { Providers } from '../test/testUtils';

beforeEach(() => {
  localStorage.clear();
});

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', async () => {
    render(
      <Providers initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Secret dashboard</div>} />
          </Route>
        </Routes>
      </Providers>,
    );

    await waitFor(() => expect(screen.getByText('Login screen')).toBeInTheDocument());
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });
});
