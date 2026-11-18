// Class helpers for the theme in spec §14.4. Kept apart from components so
// Fast Refresh works (component files only export components).

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' | 'onDark';

// Primary uses navy text on brand-500: white on brand-500 fails contrast (2.2:1).
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-navy-500 font-semibold hover:bg-brand-400',
  secondary: 'border border-navy-200 bg-white text-navy-500 hover:bg-navy-50',
  danger: 'bg-red-600 text-white font-semibold hover:bg-red-700',
  dangerOutline: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
  ghost: 'text-navy-500 hover:bg-navy-50',
  onDark: 'border border-white/40 text-white hover:bg-navy-600',
};

/** Visible focus on every interactive element (spec §8). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

/**
 * `extra` is for layout only (width, margins). Do not pass classes that the
 * base already sets (display, padding, colors): Tailwind does not resolve
 * conflicts by order, so the result would be unpredictable.
 */
export function buttonClassName(variant: ButtonVariant = 'primary', extra = ''): string {
  // min-h-11 = 44px touch target (spec §7).
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${BUTTON_VARIANTS[variant]} ${extra}`;
}

export function inputClassName(hasError: boolean, extra = ''): string {
  const border = hasError
    ? 'border-red-500 focus-visible:ring-red-500'
    : 'border-navy-200 focus-visible:ring-brand-500';
  return `block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${border} ${extra}`;
}

/** aria props for a control inside a FormField. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
