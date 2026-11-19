import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchMe, logout, selectHomePath } from '../features/auth/authSlice';
import { showNotification } from '../features/ui/uiSlice';
import type { UserRole } from '../types/auth';
import { MESSAGES } from '../utils/errorMessages';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { AlertIcon } from './icons';
import { FullScreenLoader } from './Spinner';

interface ProtectedRouteProps {
  /** Roles allowed in the child routes. Without it, any logged-in user. */
  roles?: UserRole[];
}

/**
 * Only renders its child routes with a session. On reload the token comes
 * from localStorage and the user is fetched again with GET /auth/me.
 * With the wrong role it sends the user to the start screen of their own role
 * with a notice (spec 03 §13.1).
 */
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { token, user, status, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (token && !user && status === 'idle') {
      void dispatch(fetchMe());
    }
  }, [token, user, status, dispatch]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
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

  if (roles && !roles.includes(user.role)) {
    return <ForbiddenRedirect />;
  }

  return <Outlet />;
}

/** Goes to the user's start screen and shows "No tienes acceso a esa sección." once. */
function ForbiddenRedirect() {
  const dispatch = useAppDispatch();
  const homePath = useAppSelector(selectHomePath);
  const notified = useRef(false);

  useEffect(() => {
    if (notified.current) return;
    notified.current = true;
    dispatch(showNotification({ type: 'info', message: MESSAGES.forbidden }));
  }, [dispatch]);

  return <Navigate to={homePath} replace />;
}

/** "/" sends each role to its start screen (contract §7.3). */
export function HomeRedirect() {
  const homePath = useAppSelector(selectHomePath);
  return <Navigate to={homePath} replace />;
}

/** Login/registro: with a session there is nothing to do there (spec §5). */
export function PublicOnlyRoute() {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  return token ? <Navigate to={from} replace /> : <Outlet />;
}
