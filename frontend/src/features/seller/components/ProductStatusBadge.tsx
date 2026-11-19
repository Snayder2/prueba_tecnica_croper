/** Catalog visibility of a product (isActive). */
export function ProductStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-700">
      Visible
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-400">
      Oculto
    </span>
  );
}
