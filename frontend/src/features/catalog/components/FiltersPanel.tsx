import { useState } from 'react';
import { Button } from '../../../components/Button';
import type { ResolvedCatalogQuery } from '../../../utils/catalogQuery';
import { filtersFromQuery, filtersToQuery, validatePrices, type FilterValues } from '../catalogFilters';
import { CatalogFilters } from './CatalogFilters';

interface FiltersPanelProps {
  query: ResolvedCatalogQuery;
  categories: string[];
  onApply: (changes: Partial<ResolvedCatalogQuery>) => void;
}

/**
 * Desktop panel (lg:, fixed on the left). Category and checkboxes apply right
 * away; prices apply when leaving the field or with "Aplicar", not on each key.
 */
export function FiltersPanel({ query, categories, onApply }: FiltersPanelProps) {
  const fromUrl = filtersFromQuery(query);
  const [prices, setPrices] = useState({ minPrice: fromUrl.minPrice, maxPrice: fromUrl.maxPrice });
  const [priceError, setPriceError] = useState<string | null>(null);

  // The URL is the source of truth: a chip removed or "Limpiar filtros" resets the drafts.
  const [lastUrlPrices, setLastUrlPrices] = useState(prices);
  if (fromUrl.minPrice !== lastUrlPrices.minPrice || fromUrl.maxPrice !== lastUrlPrices.maxPrice) {
    const next = { minPrice: fromUrl.minPrice, maxPrice: fromUrl.maxPrice };
    setLastUrlPrices(next);
    setPrices(next);
    setPriceError(null);
  }

  const values: FilterValues = { ...fromUrl, ...prices };

  const applyPrices = () => {
    if (prices.minPrice === fromUrl.minPrice && prices.maxPrice === fromUrl.maxPrice) return;
    const error = validatePrices(values);
    setPriceError(error);
    if (!error) {
      const { minPrice, maxPrice } = filtersToQuery(values);
      onApply({ minPrice, maxPrice });
    }
  };

  const onChange = (next: FilterValues) => {
    if (next.minPrice !== values.minPrice || next.maxPrice !== values.maxPrice) {
      setPrices({ minPrice: next.minPrice, maxPrice: next.maxPrice });
      return;
    }
    const { category, onSale, inStock } = filtersToQuery(next);
    onApply({ category, onSale, inStock });
  };

  return (
    <aside aria-labelledby="filters-title" className="space-y-4 rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <h2 id="filters-title" className="font-semibold text-navy-500">
        Filtros
      </h2>
      <CatalogFilters
        values={values}
        categories={categories}
        onChange={onChange}
        onPriceBlur={applyPrices}
        priceError={priceError}
      />
      <Button variant="secondary" onClick={applyPrices} className="w-full">
        Aplicar precio
      </Button>
    </aside>
  );
}
