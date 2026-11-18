const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const integerFormatter = new Intl.NumberFormat('es-CO');

/** 145000 → "$ 145.000" (pesos colombianos, spec §13). */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

/** ISO 8601 → "17 nov 2026, 4:30 p. m." in local time. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
