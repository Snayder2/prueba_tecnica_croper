import { Radio, RadioGroup } from '@headlessui/react';
import { useState } from 'react';
import { ImageIcon } from '../../../components/icons';
import { FOCUS_RING } from '../../../components/styles';
import type { ProductImage } from '../../../types/product';

interface ImageGalleryProps {
  images: ProductImage[];
  /** Product name, for the alt texts. */
  name: string;
}

/**
 * Detail gallery (spec 03 §13.6): main image (`url`, with width/height to
 * reserve its space) and thumbnails below. The thumbnails are a radio group,
 * so they can be chosen with a click or with the arrow keys.
 */
export function ImageGallery({ images, name }: ImageGalleryProps) {
  const [selectedId, setSelectedId] = useState(images[0]?._id);
  const selected = images.find((image) => image._id === selectedId) ?? images[0];

  if (!selected) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-xl bg-navy-50 text-navy-300"
        aria-hidden="true"
      >
        <ImageIcon className="size-16" />
      </div>
    );
  }

  const position = images.indexOf(selected) + 1;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
        <img
          src={selected.url}
          alt={images.length > 1 ? `${name}, imagen ${position} de ${images.length}` : name}
          width={selected.width}
          height={selected.height}
          className="mx-auto h-auto max-h-[32rem] w-full object-contain"
        />
      </div>
      {images.length > 1 && (
        <RadioGroup
          value={selected._id}
          onChange={setSelectedId}
          aria-label="Imágenes del producto"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((image, index) => (
            <Radio
              key={image._id}
              value={image._id}
              aria-label={`Ver imagen ${index + 1} de ${images.length}`}
              className={`shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-transparent data-[checked]:border-brand-500 ${FOCUS_RING}`}
            >
              <img src={image.thumbUrl} alt="" width={64} height={64} className="size-16 object-cover" />
            </Radio>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
