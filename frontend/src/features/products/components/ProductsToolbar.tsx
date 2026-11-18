import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { inputClassName } from '../../../components/styles';
import { PlusIcon, SearchIcon } from '../../../components/icons';
import { useDebounce } from '../../../hooks/useDebounce';
import type { ProductSortField, SortOrder } from '../../../types/product';
import { setSearch, setSort } from '../productsSlice';

const SEARCH_DEBOUNCE_MS = 400;

// Mobile has no table headers, so sorting is offered as a select there.
const SORT_OPTIONS: { value: `${ProductSortField}:${SortOrder}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'name:asc', label: 'Nombre (A–Z)' },
  { value: 'name:desc', label: 'Nombre (Z–A)' },
  { value: 'price:asc', label: 'Precio: menor a mayor' },
  { value: 'price:desc', label: 'Precio: mayor a menor' },
  { value: 'stock:asc', label: 'Stock: menor a mayor' },
  { value: 'stock:desc', label: 'Stock: mayor a menor' },
];

interface ProductsToolbarProps {
  onCreate: () => void;
}

export function ProductsToolbar({ onCreate }: ProductsToolbarProps) {
  const dispatch = useAppDispatch();
  const { search, sortBy, order } = useAppSelector((state) => state.products.filters);
  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term, SEARCH_DEBOUNCE_MS);

  // Search waits 400 ms after the last keystroke (spec §5.2); setSearch resets to page 1.
  useEffect(() => {
    dispatch(setSearch(debouncedTerm));
  }, [debouncedTerm, dispatch]);

  const sortValue = `${sortBy}:${order}`;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <label htmlFor="product-search" className="sr-only">
          Buscar productos por nombre
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-300" />
        <input
          id="product-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por nombre…"
          autoComplete="off"
          className={inputClassName(false, 'pl-10')}
        />
      </div>

      <div className="md:hidden">
        <label htmlFor="product-sort" className="sr-only">
          Ordenar productos
        </label>
        <select
          id="product-sort"
          value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : 'createdAt:desc'}
          onChange={(event) => {
            const [field, direction] = event.target.value.split(':') as [ProductSortField, SortOrder];
            dispatch(setSort({ sortBy: field, order: direction }));
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

      {/* Desktop only; mobile uses the floating button. A wrapper avoids
          fighting the button's own `inline-flex` with `hidden`. */}
      <div className="hidden md:block">
        <Button onClick={onCreate}>
          <PlusIcon className="size-5" />
          Nuevo producto
        </Button>
      </div>
    </div>
  );
}
