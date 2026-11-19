import { useId } from 'react';
import type { PaginationMeta } from '../types/api';
import { formatInteger } from '../utils/formatters';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { FOCUS_RING, inputClassName } from './styles';

interface PaginationProps {
  meta: PaginationMeta;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  /** Disables the buttons while a page is loading. */
  disabled?: boolean;
  /** aria-label of the navigation, e.g. "Paginación de productos". */
  label: string;
}

type PageItem = number | 'gap';

const ARROW_BUTTON = `inline-flex size-11 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-500 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

/** 1 … 4 5 6 … 12: first, last and two pages around the current one. */
function pageItems(page: number, lastPage: number): PageItem[] {
  const pages = new Set([1, lastPage, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= lastPage).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) items.push('gap');
    items.push(n);
  });
  return items;
}

/**
 * "1–10 de 42", page size and numbered pages (spec 02 §5.2, spec 03 §13.5).
 * Shared by the seller table and the catalog grid.
 */
export function Pagination({
  meta,
  pageSizes,
  onPageChange,
  onLimitChange,
  disabled = false,
  label,
}: PaginationProps) {
  const sizeId = useId();
  const { page, limit, total, totalPages } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const lastPage = Math.max(totalPages, 1);

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 text-sm text-navy-500 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p aria-live="polite">
          <span className="font-semibold">
            {formatInteger(from)}–{formatInteger(to)}
          </span>{' '}
          de <span className="font-semibold">{formatInteger(total)}</span>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="whitespace-nowrap">
            Por página
          </label>
          <select
            id={sizeId}
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className={inputClassName(false, 'w-20')}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={ARROW_BUTTON}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon />
        </button>
        {/* Below sm: the numbered pages do not fit at 360 px; "3 / 10" instead. */}
        <span className="min-w-16 text-center tabular-nums sm:hidden" aria-hidden="true">
          {page} / {lastPage}
        </span>
        <ol className="hidden items-center gap-1 sm:flex">
          {pageItems(page, lastPage).map((item, index) =>
            item === 'gap' ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-navy-300">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onPageChange(item)}
                  disabled={disabled}
                  aria-label={`Página ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  className={`inline-flex size-11 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed ${FOCUS_RING} ${
                    item === page
                      ? 'bg-navy-500 text-white'
                      : 'text-navy-500 hover:bg-navy-50'
                  }`}
                >
                  {item}
                </button>
              </li>
            ),
          )}
        </ol>
        <button
          type="button"
          className={ARROW_BUTTON}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage || disabled}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </nav>
  );
}
