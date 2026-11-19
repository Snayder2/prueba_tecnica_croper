import { useId } from 'react';
import { inputClassName } from '../../../components/styles';
import type { FilterValues } from '../catalogFilters';

interface CatalogFiltersProps {
  values: FilterValues;
  categories: string[];
  /** Every change of a control. */
  onChange: (values: FilterValues) => void;
  /** Leaving a price field (the desktop panel applies prices here, not on each key). */
  onPriceBlur?: () => void;
  priceError?: string | null;
}

const CHECKBOX =
  'size-5 rounded accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

/**
 * Filter controls of spec 03 §13.5: category, price range on the final price,
 * "Solo con descuento" and "Solo disponibles". Used by the desktop panel and
 * by the mobile drawer, which decide when the values are applied.
 */
export function CatalogFilters({ values, categories, onChange, onPriceBlur, priceError }: CatalogFiltersProps) {
  const id = useId();
  const set = (changes: Partial<FilterValues>) => onChange({ ...values, ...changes });
  const priceErrorId = `${id}-price-error`;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <label htmlFor={`${id}-category`} className="block text-sm font-medium text-navy-500">
          Categoría
        </label>
        <select
          id={`${id}-category`}
          value={values.category}
          onChange={(event) => set({ category: event.target.value })}
          className={inputClassName(false)}
        >
          <option value="">Todas</option>
          {/* A category from a shared link may no longer exist: still show it. */}
          {values.category && !categories.includes(values.category) && (
            <option value={values.category}>{values.category}</option>
          )}
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-navy-500">Precio</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-min`} className="text-xs text-navy-400">
              Mínimo
            </label>
            <input
              id={`${id}-min`}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="$ 0"
              value={values.minPrice}
              onChange={(event) => set({ minPrice: event.target.value })}
              onBlur={onPriceBlur}
              aria-invalid={priceError ? true : undefined}
              aria-describedby={priceError ? priceErrorId : undefined}
              className={inputClassName(Boolean(priceError))}
            />
          </div>
          <div>
            <label htmlFor={`${id}-max`} className="text-xs text-navy-400">
              Máximo
            </label>
            <input
              id={`${id}-max`}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Sin límite"
              value={values.maxPrice}
              onChange={(event) => set({ maxPrice: event.target.value })}
              onBlur={onPriceBlur}
              aria-invalid={priceError ? true : undefined}
              aria-describedby={priceError ? priceErrorId : undefined}
              className={inputClassName(Boolean(priceError))}
            />
          </div>
        </div>
        {priceError && (
          <p id={priceErrorId} className="text-sm text-red-600" role="alert">
            {priceError}
          </p>
        )}
      </fieldset>

      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy-500">
          <input
            type="checkbox"
            checked={values.onSale}
            onChange={(event) => set({ onSale: event.target.checked })}
            className={CHECKBOX}
          />
          Solo con descuento
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy-500">
          <input
            type="checkbox"
            checked={values.inStock}
            onChange={(event) => set({ inStock: event.target.checked })}
            className={CHECKBOX}
          />
          Solo disponibles
        </label>
      </div>
    </div>
  );
}
