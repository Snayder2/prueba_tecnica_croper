import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { CloseIcon } from '../../components/icons';
import { hideNotification, type Notification, type NotificationType } from './uiSlice';

// Spec §14.4: white text on leaf-600 / red-600 / navy-500 all meet WCAG AA.
const STYLES: Record<NotificationType, string> = {
  success: 'bg-leaf-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-navy-500 text-white',
};

const DURATION_MS: Record<NotificationType, number> = { success: 4000, info: 5000, error: 7000 };

function Toast({ notification }: { notification: Notification }) {
  const dispatch = useAppDispatch();
  const { id, type, message } = notification;

  useEffect(() => {
    const timer = setTimeout(() => dispatch(hideNotification(id)), DURATION_MS[type]);
    return () => clearTimeout(timer);
  }, [dispatch, id, type]);

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${STYLES[type]}`}
    >
      <p className="flex-1 pt-0.5">{message}</p>
      <button
        type="button"
        onClick={() => dispatch(hideNotification(id))}
        aria-label="Cerrar notificación"
        className="-m-1 rounded p-1 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}

/** Toast stack fed by uiSlice; any part of the app can dispatch showNotification. */
export function Notifications() {
  const notifications = useAppSelector((state) => state.ui.notifications);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
