import { CloseIcon } from '../../../components/icons';
import { FOCUS_RING } from '../../../components/styles';
import type { ResolvedCatalogQuery } from '../../../utils/catalogQuery';
import { formatCurrency } from '../../../utils/formatters';

interface ActiveFilterChipsProps {
  query: ResolvedCatalogQuery;
  onRemove: (changes: Partial<ResolvedCatalogQuery>) => void;
  onClear: () => void;
}

function priceLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min !== undefined) return `Desde ${formatCurrency(min)}`;
  return `Hasta ${formatCurrency(max ?? 0)}`;
}

/** One chip per active filter, each with an ✕, plus "Limpiar filtros" (spec 03 §13.5). */
export function ActiveFilterChips({ query, onRemove, onClear }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; remove: Partial<ResolvedCatalogQuery> }[] = [];
  if (query.category) chips.push({ key: 'category', label: query.category, remove: { category: undefined } });
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    chips.push({
      key: 'price',
      label: priceLabel(query.minPrice, query.maxPrice),
      remove: { minPrice: undefined, maxPrice: undefined },
    });
  }
  if (query.onSale) chips.push({ key: 'onSale', label: 'Con descuento', remove: { onSale: false } });
  if (query.inStock) chips.push({ key: 'inStock', label: 'Disponibles', remove: { inStock: false } });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => onRemove(chip.remove)}
              aria-label={`Quitar filtro: ${chip.label}`}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-navy-200 bg-white py-1 pr-2 pl-3 text-sm text-navy-500 hover:bg-navy-50 ${FOCUS_RING}`}
            >
              {chip.label}
              <CloseIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClear}
        className={`min-h-9 rounded px-1 text-sm font-medium text-brand-700 hover:underline ${FOCUS_RING}`}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
