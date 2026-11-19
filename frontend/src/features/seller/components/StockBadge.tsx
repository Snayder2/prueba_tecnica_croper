/** Products with this stock or less are flagged as "Stock bajo" (spec 03 §13.4). */
export const LOW_STOCK = 5;

/** "Agotado" (0) or "Stock bajo" (≤ 5); nothing otherwise. */
export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Agotado
      </span>
    );
  }
  if (stock <= LOW_STOCK) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Stock bajo
      </span>
    );
  }
  return null;
}
