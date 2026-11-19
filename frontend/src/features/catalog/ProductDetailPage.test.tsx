import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../api/catalogApi';
import { setupStore } from '../../app/store';
import type { AppError } from '../../types/api';
import type { Product, ProductImage } from '../../types/product';
import { ProductDetailPage } from './ProductDetailPage';

vi.mock('../../api/catalogApi', () => ({
  catalogApi: { list: vi.fn(), categories: vi.fn(), get: vi.fn() },
}));
const api = vi.mocked(catalogApi);

const image = (n: number): ProductImage => ({
  _id: `673a01c9c4e5b8a9d0f1240${n}`,
  url: `http://localhost:3000/api/v1/products/p1/images/${n}`,
  thumbUrl: `http://localhost:3000/api/v1/products/p1/images/${n}/thumb`,
  width: 1200,
  height: 900,
});

const product: Product = {
  _id: '6739f3b2c4e5b8a9d0f12346',
  name: 'Café de origen Huila 500 g',
  description: 'Café especial tostado medio',
  price: 32000,
  discountPercent: 10,
  finalPrice: 28800,
  stock: 12,
  category: 'Café',
  sku: 'CAF-HUI-500',
  isActive: true,
  images: [image(1), image(2), image(3)],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-18T14:10:00.000Z',
};

function renderDetail(entries: (string | { pathname: string; state?: unknown })[]) {
  const router = createMemoryRouter(
    [
      { path: '/catalog', element: <h1>Catálogo</h1> },
      { path: '/catalog/:id', element: <ProductDetailPage /> },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  render(
    <Provider store={setupStore()}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProductDetailPage (spec 03 §13.6)', () => {
  it('shows name, seller, category, price with discount, availability and description', async () => {
    api.get.mockResolvedValue(product);
    renderDetail([{ pathname: `/catalog/${product._id}` }]);

    expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument();
    expect(screen.getByText('Vendido por Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Café')).toBeInTheDocument();
    expect(screen.getByText(/28\.800/)).toBeInTheDocument();
    expect(screen.getByText(/32\.000/)).toHaveClass('line-through');
    expect(screen.getByText('Disponible · 12 unidades')).toBeInTheDocument();
    expect(screen.getByText('Café especial tostado medio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comprar/i })).not.toBeInTheDocument();
  });

  it('the gallery shows the large image with its size, and thumbnails work with the arrow keys', async () => {
    api.get.mockResolvedValue(product);
    renderDetail([{ pathname: `/catalog/${product._id}` }]);

    const main = await screen.findByRole('img', { name: `${product.name}, imagen 1 de 3` });
    expect(main).toHaveAttribute('src', image(1).url);
    expect(main).toHaveAttribute('width', '1200');
    expect(main).toHaveAttribute('height', '900');

    await userEvent.click(screen.getByRole('radio', { name: 'Ver imagen 2 de 3' }));
    expect(screen.getByRole('img', { name: `${product.name}, imagen 2 de 3` })).toHaveAttribute('src', image(2).url);

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('img', { name: `${product.name}, imagen 3 de 3` })).toBeInTheDocument();
  });

  it('a sold-out product says "Agotado"', async () => {
    api.get.mockResolvedValue({ ...product, stock: 0 });
    renderDetail([{ pathname: `/catalog/${product._id}` }]);
    expect(await screen.findByText('Agotado')).toBeInTheDocument();
  });

  it('404 → "Este producto ya no está disponible" with a link to the catalog', async () => {
    const notFound: AppError = { status: 404, message: 'El producto ya no existe.', fieldErrors: {}, handled: false };
    api.get.mockRejectedValue(notFound);
    renderDetail([{ pathname: `/catalog/${product._id}` }]);

    expect(await screen.findByText('Este producto ya no está disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalog');
  });

  it('"Volver al catálogo" goes back in history (keeping the filters) when coming from the catalog', async () => {
    api.get.mockResolvedValue(product);
    const router = renderDetail([
      '/catalog?category=Caf%C3%A9&page=2',
      { pathname: `/catalog/${product._id}`, state: { fromCatalog: true } },
    ]);

    await userEvent.click(await screen.findByRole('button', { name: 'Volver al catálogo' }));

    expect(router.state.location.pathname).toBe('/catalog');
    expect(router.state.location.search).toBe('?category=Caf%C3%A9&page=2');
  });

  it('"Volver al catálogo" opens /catalog when the detail was opened directly', async () => {
    api.get.mockResolvedValue(product);
    const router = renderDetail([{ pathname: `/catalog/${product._id}` }]);

    await userEvent.click(await screen.findByRole('button', { name: 'Volver al catálogo' }));

    expect(router.state.location.pathname).toBe('/catalog');
    expect(router.state.location.search).toBe('');
  });
});
