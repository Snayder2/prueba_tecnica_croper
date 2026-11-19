import { NavLink, Outlet } from 'react-router';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout, selectRole } from '../features/auth/authSlice';
import type { UserRole } from '../types/auth';
import { Button } from './Button';
import { LeafLogo, LogoutIcon } from './icons';
import { FOCUS_RING } from './styles';

/** Links of the top bar by role (spec 03 §13.1). */
const NAV_LINKS: Record<UserRole, { to: string; label: string }[]> = {
  seller: [
    { to: '/seller/products', label: 'Mis productos' },
    { to: '/catalog', label: 'Catálogo' },
  ],
  buyer: [{ to: '/catalog', label: 'Catálogo' }],
};

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const role = useAppSelector(selectRole);
  const links = role ? NAV_LINKS[role] : [];

  return (
    <div className="min-h-screen">
      <header className="bg-navy-500 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <LeafLogo />
              <span className="hidden font-semibold sm:inline">Mercado agro</span>
            </div>
            <nav aria-label="Principal">
              <ul className="flex items-center gap-1">
                {links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end
                      className={({ isActive }) =>
                        `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${FOCUS_RING} ${
                          isActive ? 'bg-navy-600 text-white' : 'text-navy-100 hover:bg-navy-600 hover:text-white'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {user && (
              <span className="hidden truncate text-sm text-navy-100 md:inline" title={user.email}>
                {user.name}
              </span>
            )}
            <Button variant="onDark" onClick={() => dispatch(logout())} aria-label="Cerrar sesión">
              <LogoutIcon className="size-5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}
