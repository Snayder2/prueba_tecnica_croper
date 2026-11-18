interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = 'size-5' }: SpinnerProps) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centered loader for whole-screen waits (e.g. restoring the session). */
export function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-navy-500" role="status">
      <Spinner className="size-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
