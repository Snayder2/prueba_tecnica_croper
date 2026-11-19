import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../api/catalogApi';
import { setupStore } from '../../app/store';
import type { Product } from '../../types/product';
import { CatalogPage } from './CatalogPage';

vi.mock('../../api/catalogApi', () => ({
  catalogApi: { list: vi.fn(), categories: vi.fn(), get: vi.fn() },
}));
const api = vi.mocked(catalogApi);

const product = (n: number, overrides: Partial<Product> = {}): Product => ({
  _id: `6739f3b2c4e5b8a9d0f1${String(n).padStart(4, '0')}`,
  name: `Producto ${n}`,
  price: 1000 * n,
  discountPercent: 0,
  finalPrice: 1000 * n,
  stock: n,
  category: 'Café',
  sku: `PROD-${n}`,
  isActive: true,
  images: [],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
  ...overrides,
});

function renderCatalog(url = '/catalog') {
  const router = createMemoryRouter([{ path: '/catalog', element: <CatalogPage /> }], {
    initialEntries: [url],
  });
  render(
    <Provider store={setupStore()}>
      <RouterProvider router={router} />
    </Provider>,
  );
  const search = () => new URLSearchParams(router.state.location.search);
  return { router, search };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.categories.mockResolvedValue(['Abonos', 'Café']);
  api.list.mockResolvedValue({
    data: [product(1), product(2, { stock: 0, discountPercent: 15, finalPrice: 1700 })],
    meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
  });
});

describe('CatalogPage', () => {
  it('reads the filters from the URL and sends them to the API', async () => {
    renderCatalog('/catalog?category=Caf%C3%A9&onSale=true&page=2');

    await screen.findByText('2 productos');
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Café', onSale: true, page: 2 }),
      expect.any(AbortSignal),
    );
  });

  it('shows cards with "Agotado", the discount badge and the seller', async () => {
    renderCatalog();

    const cards = await screen.findAllByRole('link');
    expect(cards).toHaveLength(2);
    expect(within(cards[1]).getByText('Agotado')).toBeInTheDocument();
    expect(within(cards[1]).getByText('-15%')).toBeInTheDocument();
    expect(within(cards[0]).getByText('por Ana Pérez')).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute('href', `/catalog/${product(1)._id}`);
  });

  it('a filter writes the URL and goes back to page 1', async () => {
    const { search } = renderCatalog('/catalog?page=3');
    await screen.findByText('2 productos');

    const [desktopCategory] = screen.getAllByLabelText('Categoría');
    await userEvent.selectOptions(desktopCategory, 'Abonos');

    expect(search().get('category')).toBe('Abonos');
    expect(search().get('page')).toBeNull();
  });

  it('chips show the active filters; ✕ removes one and "Limpiar filtros" all of them', async () => {
    const { search } = renderCatalog('/catalog?category=Caf%C3%A9&inStock=true&search=cafe');
    const chips = await screen.findByRole('list', { name: 'Filtros activos' });
    expect(within(chips).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Café', 'Disponibles']);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro: Disponibles' }));
    expect(search().get('inStock')).toBeNull();
    expect(search().get('category')).toBe('Café');

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(search().get('category')).toBeNull();
    // The search text is not a filter chip and stays.
    expect(search().get('search')).toBe('cafe');
  });

  it('prices apply on blur, and a minimum above the maximum shows an error instead', async () => {
    const { search } = renderCatalog();
    await screen.findByText('2 productos');
    const [min] = screen.getAllByLabelText('Mínimo');
    const [max] = screen.getAllByLabelText('Máximo');

    await userEvent.type(max, '40000');
    expect(search().get('maxPrice')).toBeNull();
    await userEvent.tab();
    expect(search().get('maxPrice')).toBe('40000');

    await userEvent.type(min, '50000');
    await userEvent.tab();
    expect(screen.getByText('El precio mínimo no puede ser mayor que el máximo.')).toBeInTheDocument();
    expect(search().get('minPrice')).toBeNull();
  });

  it('the mobile drawer applies a draft with "Aplicar" and shows the filter count', async () => {
    const { search } = renderCatalog('/catalog?onSale=true');
    await userEvent.click(await screen.findByRole('button', { name: 'Filtros (1)' }));

    const drawer = await screen.findByRole('dialog', { name: 'Filtros' });
    await userEvent.click(within(drawer).getByLabelText('Solo disponibles'));
    expect(search().get('inStock')).toBeNull();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar' }));

    expect(search().get('inStock')).toBe('true');
    expect(search().get('onSale')).toBe('true');
  });

  it('sorting writes sortBy and order', async () => {
    const { search } = renderCatalog();
    await screen.findByText('2 productos');

    await userEvent.selectOptions(screen.getByLabelText('Ordenar'), 'Menor precio');

    expect(search().get('sortBy')).toBe('finalPrice');
    expect(search().get('order')).toBe('asc');
  });

  describe('states (spec 03 §13.5)', () => {
    const empty = { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } };

    it('first load shows skeleton cards', () => {
      api.list.mockReturnValue(new Promise(() => {}));
      renderCatalog();
      expect(screen.getByRole('status', { name: 'Cargando productos' })).toBeInTheDocument();
    });

    it('an empty catalog says "Todavía no hay productos publicados"', async () => {
      api.list.mockResolvedValue(empty);
      renderCatalog();
      expect(await screen.findByText('Todavía no hay productos publicados')).toBeInTheDocument();
    });

    it('no results with filters offers "Limpiar filtros", which also clears the search', async () => {
      api.list.mockResolvedValue(empty);
      const { search } = renderCatalog('/catalog?onSale=true&search=xyz&sortBy=name&order=asc');

      expect(await screen.findByText('No encontramos productos con esos filtros')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button', { name: 'Limpiar filtros' });
      await userEvent.click(buttons[buttons.length - 1]);

      expect(search().toString()).toBe('sortBy=name&order=asc');
    });

    it('an error shows the friendly message and "Reintentar" loads again', async () => {
      api.list.mockRejectedValueOnce({
        status: null,
        message: 'No pudimos conectar con el servidor.',
        fieldErrors: {},
        handled: false,
      });
      renderCatalog();

      expect(await screen.findByText('No pudimos conectar con el servidor.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByText('2 productos')).toBeInTheDocument();
    });

    it('reloading keeps the current grid with an indicator instead of blinking', async () => {
      const { router } = renderCatalog();
      await screen.findByText('2 productos');
      api.list.mockReturnValue(new Promise(() => {}));

      await router.navigate('/catalog?page=2');

      expect(await screen.findByText('Actualizando…')).toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(2);
    });

    it('a page beyond the last one offers going back to the first page', async () => {
      api.list.mockResolvedValue({ data: [], meta: { page: 9, limit: 12, total: 2, totalPages: 1 } });
      const { search } = renderCatalog('/catalog?page=9');

      await userEvent.click(await screen.findByRole('button', { name: 'Ir a la primera página' }));
      expect(search().get('page')).toBeNull();
    });
  });
});
