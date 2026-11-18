import { Outlet } from 'react-router';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { Button } from './Button';
import { LeafLogo, LogoutIcon } from './icons';

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="min-h-screen">
      <header className="bg-navy-500 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <LeafLogo />
            <span className="truncate font-semibold">Gestión de productos</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {user && (
              <span className="hidden truncate text-sm text-navy-100 sm:inline" title={user.email}>
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
