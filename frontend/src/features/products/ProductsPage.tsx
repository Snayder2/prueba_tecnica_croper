import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { FOCUS_RING } from '../../components/styles';
import { EmptyState } from '../../components/EmptyState';
import { AlertIcon, BoxIcon, PlusIcon, SearchIcon } from '../../components/icons';
import { Spinner } from '../../components/Spinner';
import type { Product, ProductSortField } from '../../types/product';
import { formatInteger } from '../../utils/formatters';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import { Pagination } from './components/Pagination';
import { ProductCardList, ProductCardSkeleton } from './components/ProductCardList';
import { ProductFormDialog } from './components/ProductFormDialog';
import { ProductsToolbar } from './components/ProductsToolbar';
import { ProductTable, ProductTableSkeleton } from './components/ProductTable';
import { fetchProducts, setSort } from './productsSlice';

export function ProductsPage() {
  const dispatch = useAppDispatch();
  const { items, meta, filters, status, error } = useAppSelector((state) => state.products);

  // Dialog state is local to this screen (spec §4.1).
  const [form, setForm] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [toDelete, setToDelete] = useState<Product | null>(null);

  // Reload when page, size or filters change; a newer request aborts the previous one.
  useEffect(() => {
    const request = dispatch(fetchProducts());
    return () => request.abort();
  }, [dispatch, meta.page, meta.limit, filters.search, filters.sortBy, filters.order]);

  const openCreate = () => setForm({ open: true, product: null });
  const openEdit = (product: Product) => setForm({ open: true, product });
  const closeForm = () => setForm((current) => ({ ...current, open: false }));

  const onSort = (field: Exclude<ProductSortField, 'createdAt'>) => {
    const order = filters.sortBy === field && filters.order === 'asc' ? 'desc' : 'asc';
    dispatch(setSort({ sortBy: field, order }));
  };

  const firstLoad = (status === 'idle' || status === 'loading') && items.length === 0;
  const reloading = status === 'loading' && items.length > 0;

  let content;
  if (status === 'failed') {
    content = (
      <EmptyState
        role="alert"
        icon={<AlertIcon className="size-7" />}
        title="No pudimos cargar los productos"
        description={error ?? undefined}
        action={<Button onClick={() => void dispatch(fetchProducts())}>Reintentar</Button>}
      />
    );
  } else if (firstLoad) {
    content = (
      <div role="status" aria-label="Cargando productos">
        <div className="hidden md:block">
          <ProductTableSkeleton rows={Math.min(meta.limit, 8)} />
        </div>
        <div className="md:hidden">
          <ProductCardSkeleton rows={3} />
        </div>
      </div>
    );
  } else if (items.length === 0) {
    content = filters.search ? (
      <EmptyState
        icon={<SearchIcon className="size-7" />}
        title={`No se encontraron productos para «${filters.search}»`}
        description="Prueba con otro nombre o revisa la ortografía."
      />
    ) : (
      <EmptyState
        icon={<BoxIcon className="size-7" />}
        title="Aún no hay productos"
        description="Crea el primero para empezar a gestionar tu catálogo."
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="size-5" />
            Crear el primer producto
          </Button>
        }
      />
    );
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
        <div className={`space-y-4 transition-opacity ${reloading ? 'opacity-60' : ''}`}>
          <div className="hidden md:block">
            <ProductTable
              products={items}
              sortBy={filters.sortBy}
              order={filters.order}
              onSort={onSort}
              onEdit={openEdit}
              onDelete={setToDelete}
            />
          </div>
          <div className="md:hidden">
            <ProductCardList products={items} onEdit={openEdit} onDelete={setToDelete} />
          </div>
          <Pagination />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy-500">Productos</h1>
        <p className="text-sm text-navy-400">
          {status === 'succeeded' || reloading
            ? `${formatInteger(meta.total)} ${meta.total === 1 ? 'producto' : 'productos'}${filters.search ? ` para «${filters.search}»` : ''}`
            : 'Gestiona tu catálogo de productos.'}
        </p>
      </div>

      <ProductsToolbar onCreate={openCreate} />

      {content}

      {/* Mobile: floating "Nuevo" button (spec §7). */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="Nuevo producto"
        className={`fixed right-4 bottom-6 z-30 inline-flex size-14 items-center justify-center rounded-full bg-brand-500 text-navy-500 shadow-lg hover:bg-brand-400 md:hidden ${FOCUS_RING}`}
      >
        <PlusIcon className="size-7" />
      </button>

      <ProductFormDialog open={form.open} product={form.product} onClose={closeForm} />
      <DeleteProductDialog product={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
