import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  parseCatalogQuery,
  toSearchParams,
  type ResolvedCatalogQuery,
} from '../../utils/catalogQuery';

/**
 * The catalog filters live in the URL (spec 03 §13.3): one-way flow URL →
 * parseCatalogQuery → fetchCatalog. Components change filters by writing the
 * URL, never Redux. Any filter change goes back to page 1.
 */
export function useCatalogQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseCatalogQuery(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<ResolvedCatalogQuery>) => {
      const keepsPage = Object.keys(changes).every((key) => key === 'page');
      const next: Partial<ResolvedCatalogQuery> = {
        ...parseCatalogQuery(searchParams),
        ...changes,
        ...(keepsPage ? {} : { page: 1 }),
      };
      setSearchParams(toSearchParams(next));
    },
    [searchParams, setSearchParams],
  );

  /** Clears the filters but keeps the search text, the order and the page size. */
  const clearFilters = useCallback(() => {
    const { search, sortBy, order, limit } = parseCatalogQuery(searchParams);
    setSearchParams(toSearchParams({ search, sortBy, order, limit }));
  }, [searchParams, setSearchParams]);

  /** Clears the filters and the search text; keeps the order and the page size. */
  const clearAll = useCallback(() => {
    const { sortBy, order, limit } = parseCatalogQuery(searchParams);
    setSearchParams(toSearchParams({ sortBy, order, limit }));
  }, [searchParams, setSearchParams]);

  return { query, update, clearFilters, clearAll };
}
