import { FOCUS_RING } from '../../../components/styles';
import { PencilIcon, SortIcon, TrashIcon } from '../../../components/icons';
import type { Product, ProductSortField, SortOrder } from '../../../types/product';
import { formatCurrency, formatInteger } from '../../../utils/formatters';
import { ProductStatusBadge } from './ProductStatusBadge';

type SortableField = Extract<ProductSortField, 'name' | 'price' | 'stock'>;

interface ProductTableProps {
  products: Product[];
  sortBy: ProductSortField;
  order: SortOrder;
  onSort: (field: SortableField) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ICON_BUTTON = `inline-flex size-11 items-center justify-center rounded-lg transition-colors ${FOCUS_RING}`;

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
  sortBy: ProductSortField;
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

/** Tablet and desktop view (spec §5.2). Category is only shown from lg: (spec §7). */
export function ProductTable({ products, sortBy, order, onSort, onEdit, onDelete }: ProductTableProps) {
  const headerProps = { sortBy, order, onSort };

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <caption className="sr-only">Listado de productos</caption>
        <thead className="bg-navy-50 text-navy-500">
          <tr>
            <SortableHeader field="name" label="Nombre" {...headerProps} />
            <th scope="col" className="px-4 py-3 text-left font-semibold">SKU</th>
            <th scope="col" className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Categoría</th>
            <SortableHeader field="price" label="Precio" align="right" {...headerProps} />
            <SortableHeader field="stock" label="Stock" align="right" {...headerProps} />
            <th scope="col" className="px-4 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {products.map((product) => (
            <tr key={product._id} className="hover:bg-navy-50/50">
              <td className="max-w-xs px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{product.name}</span>
                  {!product.isActive && <ProductStatusBadge isActive={false} />}
                </div>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-navy-500">{product.sku}</td>
              <td className="hidden px-4 py-2 text-navy-400 lg:table-cell">{product.category || '—'}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">{formatCurrency(product.price)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatInteger(product.stock)}</td>
              <td className="px-2 py-1">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    aria-label={`Editar ${product.name}`}
                    title="Editar"
                    className={`${ICON_BUTTON} text-navy-500 hover:bg-navy-50`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    aria-label={`Eliminar ${product.name}`}
                    title="Eliminar"
                    className={`${ICON_BUTTON} text-red-600 hover:bg-red-50`}
                  >
                    <TrashIcon />
                  </button>
                </div>
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
