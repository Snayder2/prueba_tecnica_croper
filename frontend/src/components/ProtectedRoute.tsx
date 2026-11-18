import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchMe, logout } from '../features/auth/authSlice';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { AlertIcon } from './icons';
import { FullScreenLoader } from './Spinner';

/**
 * Only renders its child routes with a session. On reload the token comes
 * from localStorage and the user is fetched again with GET /auth/me.
 */
export function ProtectedRoute() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { token, user, status, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (token && !user && status === 'idle') {
      void dispatch(fetchMe());
    }
  }, [token, user, status, dispatch]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user) {
    if (status === 'failed') {
      return (
        <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
          <EmptyState
            role="alert"
            icon={<AlertIcon className="size-7" />}
            title="No pudimos recuperar tu sesión"
            description={error ?? undefined}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => void dispatch(fetchMe())}>Reintentar</Button>
                <Button variant="secondary" onClick={() => dispatch(logout())}>
                  Cerrar sesión
                </Button>
              </div>
            }
          />
        </main>
      );
    }
    return <FullScreenLoader label="Cargando tu sesión…" />;
  }

  return <Outlet />;
}

/** Login/registro: with a session there is nothing to do there (spec §5). */
export function PublicOnlyRoute() {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  return token ? <Navigate to={from} replace /> : <Outlet />;
}
