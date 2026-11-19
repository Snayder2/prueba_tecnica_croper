import type { CatalogQuery, CatalogSortField, SortOrder } from '../types/product';

/** Catalog query with every default applied: what the page and the API use. */
export type ResolvedCatalogQuery = Required<
  Pick<CatalogQuery, 'page' | 'limit' | 'onSale' | 'inStock' | 'sortBy' | 'order'>
> &
  Pick<CatalogQuery, 'search' | 'category' | 'minPrice' | 'maxPrice'>;

export const CATALOG_PAGE_SIZES = [12, 24, 48] as const;

/** Defaults of contract §4.6. */
export const CATALOG_DEFAULTS = {
  page: 1,
  limit: 12,
  onSale: false,
  inStock: false,
  sortBy: 'createdAt',
  order: 'desc',
} as const satisfies Partial<ResolvedCatalogQuery>;

const SORT_FIELDS: readonly CatalogSortField[] = ['createdAt', 'finalPrice', 'name', 'discountPercent'];
const ORDERS: readonly SortOrder[] = ['asc', 'desc'];
const MAX_LIMIT = 48;
const MAX_TEXT = 100;
const MAX_CATEGORY = 50;

function positiveInteger(value: string | null, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= 1 && number <= max ? number : undefined;
}

function price(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function text(value: string | null, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * URL → query (spec 03 §13.3). The URL is the source of truth of the filters.
 * Invalid values are ignored instead of breaking the page: `?page=abc` is page
 * 1, an unknown sortBy is the default, and a min price above the max is dropped.
 */
export function parseCatalogQuery(params: URLSearchParams): ResolvedCatalogQuery {
  const sortBy = params.get('sortBy') as CatalogSortField | null;
  const order = params.get('order') as SortOrder | null;
  const minPrice = price(params.get('minPrice'));
  const maxPrice = price(params.get('maxPrice'));
  const rangeOk = minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice;

  return {
    page: positiveInteger(params.get('page')) ?? CATALOG_DEFAULTS.page,
    limit: positiveInteger(params.get('limit'), MAX_LIMIT) ?? CATALOG_DEFAULTS.limit,
    search: text(params.get('search'), MAX_TEXT),
    category: text(params.get('category'), MAX_CATEGORY),
    minPrice: rangeOk ? minPrice : undefined,
    maxPrice,
    onSale: params.get('onSale') === 'true',
    inStock: params.get('inStock') === 'true',
    sortBy: sortBy && SORT_FIELDS.includes(sortBy) ? sortBy : CATALOG_DEFAULTS.sortBy,
    order: order && ORDERS.includes(order) ? order : CATALOG_DEFAULTS.order,
  };
}

/** Query → URL, leaving out empty values and defaults so links stay short. */
export function toSearchParams(query: Partial<ResolvedCatalogQuery>): URLSearchParams {
  const params = new URLSearchParams();
  const entries: [keyof ResolvedCatalogQuery, unknown][] = [
    ['search', query.search],
    ['category', query.category],
    ['minPrice', query.minPrice],
    ['maxPrice', query.maxPrice],
    ['onSale', query.onSale],
    ['inStock', query.inStock],
    ['sortBy', query.sortBy],
    ['order', query.order],
    ['page', query.page],
    ['limit', query.limit],
  ];
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === '') continue;
    if (key in CATALOG_DEFAULTS && CATALOG_DEFAULTS[key as keyof typeof CATALOG_DEFAULTS] === value) continue;
    params.set(key, String(value));
  }
  return params;
}

/** Filters that count in "Filtros (n)" and as chips (search, sort and paging do not). */
export function activeFilterCount(query: ResolvedCatalogQuery): number {
  return [
    query.category,
    query.minPrice !== undefined || query.maxPrice !== undefined ? 'price' : undefined,
    query.onSale || undefined,
    query.inStock || undefined,
  ].filter(Boolean).length;
}
