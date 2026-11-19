import type { ReactNode } from 'react';
import { FOCUS_RING } from '../../../components/styles';
import { SortIcon } from '../../../components/icons';
import { PriceTag } from '../../../components/PriceTag';
import type { Product, SellerProductSortField, SortOrder } from '../../../types/product';
import { formatInteger } from '../../../utils/formatters';
import { ProductActionsMenu, type ProductAction } from './ProductActionsMenu';
import { ProductThumbnail } from './ProductThumbnail';
import { StockBadge } from './StockBadge';

type SortableField = Extract<SellerProductSortField, 'name' | 'finalPrice' | 'stock'>;

interface ProductTableProps {
  products: Product[];
  sortBy: SellerProductSortField;
  order: SortOrder;
  onSort: (field: SortableField) => void;
  onAction: (action: ProductAction, product: Product) => void;
  /** Content of the Estado column (badge or visibility switch). */
  status: (product: Product) => ReactNode;
  /** Actions offered in the menu (all of them by default). */
  actions?: readonly ProductAction[];
}

function SortableHeader({
  field,
  label,
  sortBy,
  order,
  onSort,
  align = 'left',
}: {
  field: SortableField;
  label: string;
  sortBy: SellerProductSortField;
  order: SortOrder;
  onSort: (field: SortableField) => void;
  align?: 'left' | 'right';
}) {
  const active = sortBy === field;
  const direction = active ? order : null;
  const ariaSort = !active ? 'none' : order === 'asc' ? 'ascending' : 'descending';

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 rounded font-semibold hover:text-navy-700 ${FOCUS_RING}`}
      >
        {label}
        <SortIcon sortDirection={direction} className={`size-4 ${active ? 'text-brand-700' : 'text-navy-300'}`} />
        <span className="sr-only">
          {active ? `, orden ${order === 'asc' ? 'ascendente' : 'descendente'}` : ', sin ordenar'}
        </span>
      </button>
    </th>
  );
}

/**
 * Tablet and desktop view (spec 02 §5.2, spec 03 §13.4). Category is only
 * shown from lg: (spec 02 §7).
 */
export function ProductTable({ products, sortBy, order, onSort, onAction, status, actions }: ProductTableProps) {
  const headerProps = { sortBy, order, onSort };

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <caption className="sr-only">Listado de productos</caption>
        <thead className="bg-navy-50 text-navy-500">
          <tr>
            <th scope="col" className="w-14 px-4 py-3">
              <span className="sr-only">Imagen</span>
            </th>
            <SortableHeader field="name" label="Nombre" {...headerProps} />
            <th scope="col" className="px-4 py-3 text-left font-semibold">SKU</th>
            <th scope="col" className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Categoría</th>
            <SortableHeader field="finalPrice" label="Precio" align="right" {...headerProps} />
            <SortableHeader field="stock" label="Stock" align="right" {...headerProps} />
            <th scope="col" className="px-4 py-3 text-left font-semibold">Estado</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {products.map((product) => (
            <tr key={product._id} className="hover:bg-navy-50/50">
              <td className="px-4 py-2">
                <ProductThumbnail product={product} />
              </td>
              <td className="max-w-xs px-4 py-2 font-medium text-ink">{product.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-navy-500">{product.sku}</td>
              <td className="hidden px-4 py-2 text-navy-400 lg:table-cell">{product.category || '—'}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <PriceTag
                  price={product.price}
                  finalPrice={product.finalPrice}
                  discountPercent={product.discountPercent}
                />
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular-nums">{formatInteger(product.stock)}</span>
                  <StockBadge stock={product.stock} />
                </div>
              </td>
              <td className="px-4 py-2">{status(product)}</td>
              <td className="px-2 py-1 text-right">
                <ProductActionsMenu product={product} onAction={onAction} available={actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white shadow-sm" aria-hidden="true">
      <div className="h-11 rounded-t-xl bg-navy-50" />
      <div className="divide-y divide-navy-100">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
            <div className="h-4 flex-[3] rounded bg-navy-100" />
            <div className="h-4 flex-[2] rounded bg-navy-100" />
            <div className="hidden h-4 flex-[2] rounded bg-navy-100 lg:block" />
            <div className="h-4 flex-1 rounded bg-navy-100" />
            <div className="h-4 flex-1 rounded bg-navy-100" />
            <div className="h-8 w-20 rounded bg-navy-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
