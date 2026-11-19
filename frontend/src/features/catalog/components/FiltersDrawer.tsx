import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { CloseIcon } from '../../../components/icons';
import { FOCUS_RING } from '../../../components/styles';
import type { ResolvedCatalogQuery } from '../../../utils/catalogQuery';
import {
  EMPTY_FILTERS,
  filtersFromQuery,
  filtersToQuery,
  validatePrices,
  type FilterValues,
} from '../catalogFilters';
import { CatalogFilters } from './CatalogFilters';

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  query: ResolvedCatalogQuery;
  categories: string[];
  onApply: (changes: Partial<ResolvedCatalogQuery>) => void;
}

/**
 * Mobile and tablet filters (spec 03 §13.5): a side panel (Headless UI Dialog)
 * that edits a draft and applies it with "Aplicar"; "Limpiar" clears it.
 */
export function FiltersDrawer({ open, onClose, query, categories, onApply }: FiltersDrawerProps) {
  const [draft, setDraft] = useState<FilterValues>(() => filtersFromQuery(query));
  const [priceError, setPriceError] = useState<string | null>(null);

  // Each time it opens, the draft starts from the current URL.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(filtersFromQuery(query));
      setPriceError(null);
    }
  }

  const apply = (values: FilterValues) => {
    const error = validatePrices(values);
    setPriceError(error);
    if (error) return;
    onApply(filtersToQuery(values));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-40 lg:hidden">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-navy-900/50 transition-opacity duration-150 data-closed:opacity-0"
      />
      <div className="fixed inset-y-0 right-0 flex w-full max-w-sm">
        <DialogPanel
          transition
          className="flex w-full flex-col bg-white shadow-xl transition duration-200 data-closed:translate-x-full"
        >
          <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
            <DialogTitle className="text-lg font-semibold text-navy-500">Filtros</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={`inline-flex size-11 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 ${FOCUS_RING}`}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <CatalogFilters values={draft} categories={categories} onChange={setDraft} priceError={priceError} />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-navy-100 px-5 py-4">
            <Button variant="secondary" onClick={() => apply(EMPTY_FILTERS)}>
              Limpiar
            </Button>
            <Button onClick={() => apply(draft)}>Aplicar</Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
