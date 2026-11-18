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

/**
 * Price as the user types it, in the Colombian format: dot for thousands and
 * comma for decimals ("1.000" = mil pesos, "1.500,50"). Drops other characters,
 * keeps at most 2 decimals and regroups the thousands.
 */
export function formatPriceInput(text: string): string {
  const [integerRaw, ...decimalParts] = text.split(',');
  const digits = integerRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimalParts.length === 0) return grouped;
  const decimals = decimalParts.join('').replace(/\D/g, '').slice(0, 2);
  return `${grouped || '0'},${decimals}`;
}

/** "1.500,5" → 1500.5. Returns null when the text is not a valid amount. */
export function parsePriceInput(text: string): number | null {
  const value = text.trim();
  if (!/^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$/.test(value)) return null;
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

/** 1500.5 → "1.500,5", to load a stored price into the form. */
export function priceToInput(value: number): string {
  return formatPriceInput(String(value).replace('.', ','));
}

/** ISO 8601 → "17 nov 2026, 4:30 p. m." in local time. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
