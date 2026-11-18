import { Button } from '../../../components/Button';
import { PencilIcon, TrashIcon } from '../../../components/icons';
import type { Product } from '../../../types/product';
import { formatCurrency, formatInteger } from '../../../utils/formatters';
import { ProductStatusBadge } from './ProductStatusBadge';

interface ProductCardListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

/** Mobile view (< 768 px): the same data and actions as the table, as cards. */
export function ProductCardList({ products, onEdit, onDelete }: ProductCardListProps) {
  return (
    <ul className="space-y-3" aria-label="Listado de productos">
      {products.map((product) => (
        <li key={product._id} className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold break-words text-ink">{product.name}</h3>
              <p className="mt-0.5 font-mono text-xs text-navy-400">{product.sku}</p>
            </div>
            <ProductStatusBadge isActive={product.isActive} />
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-navy-400">Precio</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(product.price)}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-400">Stock</dt>
              <dd className="font-medium tabular-nums">{formatInteger(product.stock)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-navy-400">Categoría</dt>
              <dd className="truncate">{product.category || '—'}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onEdit(product)} aria-label={`Editar ${product.name}`}>
              <PencilIcon className="size-4" />
              Editar
            </Button>
            <Button
              variant="dangerOutline"
              onClick={() => onDelete(product)}
              aria-label={`Eliminar ${product.name}`}
            >
              <TrashIcon className="size-4" />
              Eliminar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <div className="h-4 w-2/3 rounded bg-navy-100" />
          <div className="mt-2 h-3 w-1/3 rounded bg-navy-100" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-8 rounded bg-navy-100" />
            <div className="h-8 rounded bg-navy-100" />
            <div className="h-8 rounded bg-navy-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
