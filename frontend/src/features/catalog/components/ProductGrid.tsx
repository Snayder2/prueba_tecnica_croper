import type { Product } from '../../../types/product';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

/** 2 columns on mobile, 3 on tablet and 4 on wide screens (spec 03 §13.5). */
const GRID = 'grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4';

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className={GRID} aria-label="Productos del catálogo">
      {products.map((product) => (
        <li key={product._id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count }: { count: number }) {
  return (
    <div className={GRID} role="status" aria-label="Cargando productos">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
