import type { ReactNode } from 'react';
import { AlertIcon, LeafLogo } from '../../components/icons';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared frame for the login and register screens. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LeafLogo className="size-10" />
          <span className="text-lg font-semibold text-navy-500">Mercado agro</span>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold text-navy-500">{title}</h1>
          <p className="mt-1 text-sm text-navy-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-navy-400">{footer}</p>
      </div>
    </main>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
