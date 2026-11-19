import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { AlertIcon, BoxIcon, SearchIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { Spinner } from '../../components/Spinner';
import { activeFilterCount, CATALOG_PAGE_SIZES } from '../../utils/catalogQuery';
import { formatInteger } from '../../utils/formatters';
import { fetchCatalog, fetchCategories } from './catalogSlice';
import { ActiveFilterChips } from './components/ActiveFilterChips';
import { CatalogToolbar } from './components/CatalogToolbar';
import { FiltersDrawer } from './components/FiltersDrawer';
import { FiltersPanel } from './components/FiltersPanel';
import { ProductGrid, ProductGridSkeleton } from './components/ProductGrid';
import { useCatalogQuery } from './useCatalogQuery';

/**
 * Buyer's catalog (spec 03 §13.5): cards of every seller with filters. On lg:
 * the filters are a fixed panel on the left; below, a side drawer.
 */
export function CatalogPage() {
  const dispatch = useAppDispatch();
  const { items, meta, categories, status, error } = useAppSelector((state) => state.catalog);
  const { query, update, clearFilters, clearAll } = useCatalogQuery();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterCount = activeFilterCount(query);

  // URL → request. A newer query aborts the previous request.
  useEffect(() => {
    const request = dispatch(fetchCatalog(query));
    return () => request.abort();
  }, [dispatch, query]);

  useEffect(() => {
    void dispatch(fetchCategories());
  }, [dispatch]);

  const firstLoad = (status === 'idle' || status === 'loading') && items.length === 0;
  const reloading = status === 'loading' && items.length > 0;
  const narrowed = filterCount > 0 || Boolean(query.search);

  // States of spec 03 §13.5.
  let content;
  if (status === 'failed') {
    content = (
      <EmptyState
        role="alert"
        icon={<AlertIcon className="size-7" />}
        title="No pudimos cargar el catálogo"
        description={error ?? undefined}
        action={<Button onClick={() => void dispatch(fetchCatalog(query))}>Reintentar</Button>}
      />
    );
  } else if (firstLoad) {
    content = <ProductGridSkeleton count={Math.min(query.limit, 8)} />;
  } else if (items.length === 0 && meta.total > 0) {
    // A shared or old link to a page that no longer exists.
    content = (
      <EmptyState
        icon={<SearchIcon className="size-7" />}
        title="Esta página no tiene productos"
        action={<Button onClick={() => update({ page: 1 })}>Ir a la primera página</Button>}
      />
    );
  } else if (items.length === 0 && narrowed) {
    content = (
      <EmptyState
        icon={<SearchIcon className="size-7" />}
        title="No encontramos productos con esos filtros"
        action={<Button onClick={clearAll}>Limpiar filtros</Button>}
      />
    );
  } else if (items.length === 0) {
    content = <EmptyState icon={<BoxIcon className="size-7" />} title="Todavía no hay productos publicados" />;
  } else {
    content = (
      <div className="relative" aria-busy={reloading}>
        {reloading && (
          <div className="absolute inset-x-0 -top-3 z-10 flex justify-center" role="status">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-navy-500 shadow">
              <Spinner className="size-3.5" />
              Actualizando…
            </span>
          </div>
        )}
        <div className={`space-y-5 transition-opacity ${reloading ? 'opacity-60' : ''}`}>
          <ProductGrid products={items} />
          <Pagination
            meta={meta}
            pageSizes={CATALOG_PAGE_SIZES}
            onPageChange={(page) => update({ page })}
            onLimitChange={(limit) => update({ limit })}
            disabled={status === 'loading'}
            label="Paginación del catálogo"
          />
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="catalog-title" className="space-y-4">
      <h1 id="catalog-title" className="text-2xl font-semibold text-navy-500">
        Catálogo
      </h1>

      <div className="flex items-start gap-6">
        <div className="hidden w-64 shrink-0 lg:sticky lg:top-4 lg:block">
          <FiltersPanel query={query} categories={categories} onApply={update} />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <CatalogToolbar
            query={query}
            onChange={update}
            activeFilters={filterCount}
            onOpenFilters={() => setDrawerOpen(true)}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {status === 'succeeded' && (
              <p className="text-sm text-navy-400" aria-live="polite">
                {formatInteger(meta.total)} {meta.total === 1 ? 'producto' : 'productos'}
              </p>
            )}
            <ActiveFilterChips query={query} onRemove={update} onClear={clearFilters} />
          </div>
          {content}
        </div>
      </div>

      <FiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        query={query}
        categories={categories}
        onApply={update}
      />
    </section>
  );
}
