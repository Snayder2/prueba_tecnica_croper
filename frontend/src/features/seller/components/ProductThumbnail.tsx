import { ImageIcon } from '../../../components/icons';
import type { Product } from '../../../types/product';

/** 40 px thumbnail of the main image, or a gray icon without images (spec 03 §13.4). */
export function ProductThumbnail({ product, size = 'size-10' }: { product: Product; size?: string }) {
  const [main] = product.images;
  if (!main) {
    return (
      <span
        className={`${size} inline-flex shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-300`}
        aria-hidden="true"
      >
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={main.thumbUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className={`${size} shrink-0 rounded-lg border border-navy-100 object-cover`}
    />
  );
}
