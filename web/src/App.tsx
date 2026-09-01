import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketsListPage } from './pages/TicketsListPage';
import { TicketNewPage } from './pages/TicketNewPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { CustomersListPage } from './pages/CustomersListPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/tickets" element={<TicketsListPage />} />
                <Route path="/tickets/new" element={<TicketNewPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/customers" element={<CustomersListPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />

                <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
