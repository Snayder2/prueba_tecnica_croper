import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { inputClassName } from '../../../components/styles';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/icons';
import { formatInteger } from '../../../utils/formatters';
import { PAGE_SIZES, setLimit, setPage } from '../productsSlice';

/** "1–10 de 42", page size (5, 10, 25) and previous/next (spec §5.2). */
export function Pagination() {
  const dispatch = useAppDispatch();
  const { page, limit, total, totalPages } = useAppSelector((state) => state.products.meta);
  const loading = useAppSelector((state) => state.products.status === 'loading');

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const lastPage = Math.max(totalPages, 1);

  return (
    <nav
      aria-label="Paginación de productos"
      className="flex flex-col gap-3 text-sm text-navy-500 sm:flex-row sm:items-center sm:justify-between"
    >
      <p aria-live="polite">
        <span className="font-semibold">
          {formatInteger(from)}–{formatInteger(to)}
        </span>{' '}
        de <span className="font-semibold">{formatInteger(total)}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="whitespace-nowrap">
            Por página
          </label>
          <select
            id="page-size"
            value={limit}
            onChange={(event) => dispatch(setLimit(Number(event.target.value)))}
            className={inputClassName(false, 'w-20')}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => dispatch(setPage(page - 1))}
            disabled={page <= 1 || loading}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-24 text-center whitespace-nowrap">
            Página {page} de {lastPage}
          </span>
          <Button
            variant="secondary"
            onClick={() => dispatch(setPage(page + 1))}
            disabled={page >= lastPage || loading}
            aria-label="Página siguiente"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </nav>
  );
}
