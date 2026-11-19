import { formatCurrency } from '../utils/formatters';

interface PriceTagProps {
  price: number;
  finalPrice: number;
  discountPercent: number;
  /** `stacked`: final price above the list price (table); `inline`: side by side (cards). */
  layout?: 'stacked' | 'inline';
  /** Larger final price, for the product detail. */
  size?: 'md' | 'lg';
  /** Shows the "-15%" badge next to the prices. */
  showBadge?: boolean;
}

/** "-15%" label (spec 03 §13.7): white on red-600, 4.8:1. */
export function DiscountBadge({ percent }: { percent: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-red-600 px-2 text-xs font-semibold text-white">
      -{percent}%
    </span>
  );
}

/**
 * Final price highlighted and, with a discount, the list price struck through
 * (spec 03 §13.4 and §13.5). Used by the seller table and the catalog.
 */
export function PriceTag({
  price,
  finalPrice,
  discountPercent,
  layout = 'stacked',
  size = 'md',
  showBadge = true,
}: PriceTagProps) {
  const onSale = discountPercent > 0;
  const finalClass = `font-semibold text-navy-500 tabular-nums ${size === 'lg' ? 'text-2xl' : ''}`;

  return (
    <div
      className={
        layout === 'stacked'
          ? 'flex flex-col items-end gap-0.5'
          : 'flex flex-wrap items-baseline gap-x-2 gap-y-1'
      }
    >
      <span className={finalClass}>
        {onSale && <span className="sr-only">Precio con descuento: </span>}
        {formatCurrency(finalPrice)}
      </span>
      {onSale && (
        <span className="flex items-center gap-1.5">
          <span className="text-sm text-navy-400 tabular-nums line-through">
            <span className="sr-only">Precio anterior: </span>
            {formatCurrency(price)}
          </span>
          {showBadge && <DiscountBadge percent={discountPercent} />}
        </span>
      )}
    </div>
  );
}
