import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { FOCUS_RING } from '../../components/styles';
import { EmptyState } from '../../components/EmptyState';
import { AlertIcon, BoxIcon, PlusIcon, SearchIcon } from '../../components/icons';
import { Spinner } from '../../components/Spinner';
import type { Product, SellerProductSortField } from '../../types/product';
import { formatInteger } from '../../utils/formatters';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import { Pagination } from '../../components/Pagination';
import { ProductCardList, ProductCardSkeleton } from './components/ProductCardList';
import { ProductFormDialog } from './components/ProductFormDialog';
import { ProductsToolbar } from './components/ProductsToolbar';
import { ProductTable, ProductTableSkeleton } from './components/ProductTable';
import type { ProductAction } from './components/ProductActionsMenu';
import { DiscountDialog } from './components/DiscountDialog';
import { ProductImagesDialog } from './components/ProductImagesDialog';
import { StockAdjustDialog } from './components/StockAdjustDialog';
import { VisibilitySwitch } from './components/VisibilitySwitch';
import { fetchProducts, PAGE_SIZES, setLimit, setPage, setSort } from './sellerProductsSlice';

/** Menu actions with a dialog on this screen. */
const ACTIONS: readonly ProductAction[] = ['edit', 'images', 'stock', 'discount', 'delete'];

/** Seller product management (spec 03 §13.4): the 1.0 table plus images, stock and discounts. */
export function SellerProductsPage() {
  const dispatch = useAppDispatch();
  const { items, meta, filters, status, error } = useAppSelector((state) => state.sellerProducts);

  // Dialog state is local to this screen (spec §4.1).
  const [form, setForm] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [stockProductId, setStockProductId] = useState<string | null>(null);
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<{ product: Product | null; intro: string | null }>({
    product: null,
    intro: null,
  });

  // Reload when page, size or filters change; a newer request aborts the previous one.
  useEffect(() => {
    const request = dispatch(fetchProducts());
    return () => request.abort();
  }, [dispatch, meta.page, meta.limit, filters.search, filters.sortBy, filters.order]);

  const openCreate = () => setForm({ open: true, product: null });
  const openEdit = (product: Product) => setForm({ open: true, product });
  const closeForm = () => setForm((current) => ({ ...current, open: false }));

  const onSort = (field: Extract<SellerProductSortField, 'name' | 'finalPrice' | 'stock'>) => {
    const order = filters.sortBy === field && filters.order === 'asc' ? 'desc' : 'asc';
    dispatch(setSort({ sortBy: field, order }));
  };

  const onAction = (action: ProductAction, product: Product) => {
    if (action === 'edit') openEdit(product);
    if (action === 'images') setImages({ product, intro: null });
    if (action === 'stock') setStockProductId(product._id);
    if (action === 'discount') setDiscountProduct(product);
    if (action === 'delete') setToDelete(product);
  };
  const renderStatus = (product: Product) => <VisibilitySwitch product={product} />;

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
              onAction={onAction}
              status={renderStatus}
              actions={ACTIONS}
            />
          </div>
          <div className="md:hidden">
            <ProductCardList products={items} onAction={onAction} status={renderStatus} actions={ACTIONS} />
          </div>
          <Pagination
            meta={meta}
            pageSizes={PAGE_SIZES}
            onPageChange={(page) => dispatch(setPage(page))}
            onLimitChange={(limit) => dispatch(setLimit(limit))}
            disabled={status === 'loading'}
            label="Paginación de productos"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy-500">Mis productos</h1>
        <p className="text-sm text-navy-400">
          {status === 'succeeded' || reloading
            ? `${formatInteger(meta.total)} ${meta.total === 1 ? 'producto' : 'productos'}${filters.search ? ` para «${filters.search}»` : ''}`
            : 'Gestiona tus productos, su stock, descuentos e imágenes.'}
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

      <ProductFormDialog
        open={form.open}
        product={form.product}
        onClose={closeForm}
        onAdjustStock={(product) => {
          closeForm();
          setStockProductId(product._id);
        }}
        onCreated={(product) =>
          setImages({ product, intro: 'Producto creado. Ahora agrega sus imágenes.' })
        }
      />
      <ProductImagesDialog
        product={images.product}
        intro={images.intro}
        onClose={() => setImages({ product: null, intro: null })}
      />
      <StockAdjustDialog productId={stockProductId} onClose={() => setStockProductId(null)} />
      <DiscountDialog product={discountProduct} onClose={() => setDiscountProduct(null)} />
      <DeleteProductDialog product={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
