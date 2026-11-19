import type { CatalogSortField, SortOrder } from '../../types/product';
import type { ResolvedCatalogQuery } from '../../utils/catalogQuery';

/** Values of the filter controls. Prices stay as text while the user types. */
export interface FilterValues {
  category: string;
  minPrice: string;
  maxPrice: string;
  onSale: boolean;
  inStock: boolean;
}

export const EMPTY_FILTERS: FilterValues = {
  category: '',
  minPrice: '',
  maxPrice: '',
  onSale: false,
  inStock: false,
};

/** "Ordenar" options of spec 03 §13.5. */
export const SORT_OPTIONS: { value: `${CatalogSortField}:${SortOrder}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'finalPrice:asc', label: 'Menor precio' },
  { value: 'finalPrice:desc', label: 'Mayor precio' },
  { value: 'name:asc', label: 'Nombre A–Z' },
  { value: 'discountPercent:desc', label: 'Mayor descuento' },
];

export function filtersFromQuery(query: ResolvedCatalogQuery): FilterValues {
  return {
    category: query.category ?? '',
    minPrice: query.minPrice === undefined ? '' : String(query.minPrice),
    maxPrice: query.maxPrice === undefined ? '' : String(query.maxPrice),
    onSale: query.onSale,
    inStock: query.inStock,
  };
}

function parsePrice(text: string): number | null | undefined {
  const value = text.trim();
  if (value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Same rule as the backend (contract §4.6): prices ≥ 0 and min ≤ max. */
export function validatePrices(values: FilterValues): string | null {
  const min = parsePrice(values.minPrice);
  const max = parsePrice(values.maxPrice);
  if (min === null || max === null) return 'Ingresa un precio válido (un número mayor o igual a 0).';
  if (min !== undefined && max !== undefined && min > max) {
    return 'El precio mínimo no puede ser mayor que el máximo.';
  }
  return null;
}

/** Filter values → query changes for the URL. Call validatePrices first. */
export function filtersToQuery(values: FilterValues): Partial<ResolvedCatalogQuery> {
  return {
    category: values.category || undefined,
    minPrice: parsePrice(values.minPrice) ?? undefined,
    maxPrice: parsePrice(values.maxPrice) ?? undefined,
    onSale: values.onSale,
    inStock: values.inStock,
  };
}
