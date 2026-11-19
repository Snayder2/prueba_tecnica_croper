import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { FilterIcon, SearchIcon } from '../../../components/icons';
import { inputClassName } from '../../../components/styles';
import { useDebounce } from '../../../hooks/useDebounce';
import type { CatalogSortField, SortOrder } from '../../../types/product';
import type { ResolvedCatalogQuery } from '../../../utils/catalogQuery';
import { SORT_OPTIONS } from '../catalogFilters';

const SEARCH_DEBOUNCE_MS = 400;

interface CatalogToolbarProps {
  query: ResolvedCatalogQuery;
  onChange: (changes: Partial<ResolvedCatalogQuery>) => void;
  /** Number shown in "Filtros (2)". */
  activeFilters: number;
  onOpenFilters: () => void;
}

/** Search (same 400 ms wait as 1.0), sort and, below lg:, the "Filtros (n)" button. */
export function CatalogToolbar({ query, onChange, activeFilters, onOpenFilters }: CatalogToolbarProps) {
  const [term, setTerm] = useState(query.search ?? '');
  const debouncedTerm = useDebounce(term, SEARCH_DEBOUNCE_MS);

  // The URL may change from outside (back button, shared link): show its text.
  const [urlSearch, setUrlSearch] = useState(query.search ?? '');
  if ((query.search ?? '') !== urlSearch) {
    setUrlSearch(query.search ?? '');
    setTerm(query.search ?? '');
  }

  // Only the typed text triggers a search, so the latest URL and callback are
  // read from a ref instead of being dependencies of the effect below.
  const latest = useRef({ search: query.search ?? '', onChange });
  useEffect(() => {
    latest.current = { search: query.search ?? '', onChange };
  });

  useEffect(() => {
    const search = debouncedTerm.trim();
    if (search !== latest.current.search) latest.current.onChange({ search: search || undefined });
  }, [debouncedTerm]);

  const sortValue = `${query.sortBy}:${query.order}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <label htmlFor="catalog-search" className="sr-only">
          Buscar productos por nombre
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-300" />
        <input
          id="catalog-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar productos…"
          autoComplete="off"
          className={inputClassName(false, 'pl-10')}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 sm:w-48 sm:flex-none">
          <label htmlFor="catalog-sort" className="sr-only">
            Ordenar
          </label>
          <select
            id="catalog-sort"
            value={SORT_OPTIONS.some((option) => option.value === sortValue) ? sortValue : 'createdAt:desc'}
            onChange={(event) => {
              const [sortBy, order] = event.target.value.split(':') as [CatalogSortField, SortOrder];
              onChange({ sortBy, order });
            }}
            className={inputClassName(false)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:hidden">
          <Button variant="secondary" onClick={onOpenFilters}>
            <FilterIcon className="size-5" />
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
