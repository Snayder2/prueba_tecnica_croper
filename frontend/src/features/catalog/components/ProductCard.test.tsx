import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductImage } from '../../../types/product';
import { CARD_IMAGE_ROTATION_MS } from '../useRotatingIndex';
import { ProductCard } from './ProductCard';

const image = (n: number): ProductImage => ({
  _id: `673a01c9c4e5b8a9d0f1240${n}`,
  url: `http://localhost:3000/api/v1/products/p1/images/${n}`,
  thumbUrl: `http://localhost:3000/api/v1/products/p1/images/${n}/thumb`,
  width: 1200,
  height: 1200,
});

const product = (images: ProductImage[]): Product => ({
  _id: '6739f3b2c4e5b8a9d0f12346',
  name: 'Café de origen Huila 500 g',
  price: 32000,
  discountPercent: 0,
  finalPrice: 32000,
  stock: 120,
  sku: 'CAF-HUI-500',
  isActive: true,
  images,
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
});

function renderCard(images: ProductImage[]) {
  render(
    <MemoryRouter>
      <ProductCard product={product(images)} />
    </MemoryRouter>,
  );
}

/** The image currently announced (the others are hidden copies with alt=""). */
const visibleThumb = () =>
  screen.getByRole('img', { name: 'Café de origen Huila 500 g' }).getAttribute('src');
const nextImage = () =>
  act(() => {
    vi.advanceTimersByTime(CARD_IMAGE_ROTATION_MS);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProductCard image rotation (spec 03 §13.5)', () => {
  it('rotates through the images and starts over after the last one', () => {
    renderCard([image(1), image(2), image(3)]);

    expect(visibleThumb()).toBe(image(1).thumbUrl);
    expect(screen.getAllByTestId('image-dot')).toHaveLength(3);
    nextImage();
    expect(visibleThumb()).toBe(image(2).thumbUrl);
    nextImage();
    expect(visibleThumb()).toBe(image(3).thumbUrl);
    nextImage();
    expect(visibleThumb()).toBe(image(1).thumbUrl);
    expect(screen.getAllByTestId('image-dot')[0]).toHaveAttribute('data-active', 'true');
  });

  it('pauses while the pointer is on the card', () => {
    renderCard([image(1), image(2)]);
    const card = screen.getByRole('link');

    fireEvent.pointerEnter(card);
    nextImage();
    expect(visibleThumb()).toBe(image(1).thumbUrl);

    fireEvent.pointerLeave(card);
    nextImage();
    expect(visibleThumb()).toBe(image(2).thumbUrl);
  });

  it('does not rotate when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    renderCard([image(1), image(2)]);

    nextImage();
    expect(visibleThumb()).toBe(image(1).thumbUrl);
  });

  it('a single image does not rotate nor show dots', () => {
    renderCard([image(1)]);

    nextImage();
    expect(visibleThumb()).toBe(image(1).thumbUrl);
    expect(screen.queryAllByTestId('image-dot')).toHaveLength(0);
  });
});
