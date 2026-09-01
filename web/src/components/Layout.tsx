import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-logo">Support CRM</span>
          <nav className="app-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/tickets">Tickets</NavLink>
            <NavLink to="/customers">Customers</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/admin/users">Users</NavLink>}
          </nav>
          <div className="app-user">
            <span>
              {user?.name} <span className="muted">({user?.role})</span>
            </span>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
