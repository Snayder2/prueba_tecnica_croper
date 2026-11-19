import type { ReactNode } from 'react';
import { PriceTag } from '../../../components/PriceTag';
import type { Product } from '../../../types/product';
import { formatInteger } from '../../../utils/formatters';
import { ProductActionsMenu, type ProductAction } from './ProductActionsMenu';
import { ProductThumbnail } from './ProductThumbnail';
import { StockBadge } from './StockBadge';

interface ProductCardListProps {
  products: Product[];
  onAction: (action: ProductAction, product: Product) => void;
  /** Visibility badge or switch, as in the table. */
  status: (product: Product) => ReactNode;
  /** Actions offered in the menu (all of them by default). */
  actions?: readonly ProductAction[];
}

/**
 * Mobile view (< 768 px): thumbnail, price with discount, stock labels and the
 * same actions menu as the table (spec 03 §13.4).
 */
export function ProductCardList({ products, onAction, status, actions }: ProductCardListProps) {
  return (
    <ul className="space-y-3" aria-label="Listado de productos">
      {products.map((product) => (
        <li key={product._id} className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ProductThumbnail product={product} size="size-14" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold break-words text-ink">{product.name}</h3>
              <p className="mt-0.5 font-mono text-xs text-navy-400">{product.sku}</p>
              {product.category && <p className="text-xs text-navy-400">{product.category}</p>}
            </div>
            <ProductActionsMenu product={product} onAction={onAction} available={actions} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-navy-400">Precio</dt>
              <dd>
                <PriceTag
                  layout="inline"
                  price={product.price}
                  finalPrice={product.finalPrice}
                  discountPercent={product.discountPercent}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-400">Stock</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums">{formatInteger(product.stock)}</span>
                <StockBadge stock={product.stock} />
              </dd>
            </div>
          </dl>

          <div className="mt-3 border-t border-navy-100 pt-3">{status(product)}</div>
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
          <div className="flex gap-3">
            <div className="size-14 rounded-lg bg-navy-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-navy-100" />
              <div className="h-3 w-1/3 rounded bg-navy-100" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-8 rounded bg-navy-100" />
            <div className="h-8 rounded bg-navy-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
