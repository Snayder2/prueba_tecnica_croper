import { Link } from 'react-router';
import { ImageIcon } from '../../../components/icons';
import { DiscountBadge, PriceTag } from '../../../components/PriceTag';
import { FOCUS_RING } from '../../../components/styles';
import type { Product } from '../../../types/product';
import type { FromCatalogState } from '../ProductDetailPage';

/**
 * Catalog card (spec 03 §13.5): square image, discount badge, "Agotado" layer,
 * name in 2 lines, category, seller and price. The whole card links to the detail.
 */
export function ProductCard({ product }: { product: Product }) {
  const [main] = product.images;
  const soldOut = product.stock === 0;

  return (
    <Link
      to={`/catalog/${product._id}`}
      state={{ fromCatalog: true } satisfies FromCatalogState}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm transition-shadow hover:shadow-md ${FOCUS_RING}`}
    >
      <div className="relative aspect-square bg-navy-50">
        {main ? (
          <img
            src={main.thumbUrl}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-navy-300" aria-hidden="true">
            <ImageIcon className="size-10" />
          </div>
        )}
        {product.discountPercent > 0 && (
          <span className="absolute top-2 left-2">
            <DiscountBadge percent={product.discountPercent} />
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-500/80">
            <span className="text-sm font-semibold text-white">Agotado</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-ink group-hover:text-navy-700">{product.name}</h3>
        {product.category && <p className="text-xs text-navy-400">{product.category}</p>}
        <p className="text-xs text-navy-400">por {product.seller.name}</p>
        <div className="mt-auto pt-2">
          <PriceTag
            layout="inline"
            price={product.price}
            finalPrice={product.finalPrice}
            discountPercent={product.discountPercent}
            showBadge={false}
          />
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm" aria-hidden="true">
      <div className="aspect-square bg-navy-100" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-4/5 rounded bg-navy-100" />
        <div className="h-3 w-1/2 rounded bg-navy-100" />
        <div className="h-5 w-1/3 rounded bg-navy-100" />
      </div>
    </div>
  );
}
