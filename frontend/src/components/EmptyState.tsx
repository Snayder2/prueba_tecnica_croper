import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Use "alert" for error states so screen readers announce them. */
  role?: 'status' | 'alert';
}

export function EmptyState({ icon, title, description, action, role = 'status' }: EmptyStateProps) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-3 rounded-xl border border-navy-100 bg-white px-6 py-12 text-center shadow-sm"
    >
      {icon && <div className="rounded-full bg-navy-50 p-3 text-navy-400">{icon}</div>}
      <h2 className="text-lg font-semibold text-navy-500">{title}</h2>
      {description && <p className="max-w-md text-sm text-navy-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
