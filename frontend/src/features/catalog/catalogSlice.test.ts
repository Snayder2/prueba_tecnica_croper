import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../api/catalogApi';
import { setupStore } from '../../app/store';
import type { AppError } from '../../types/api';
import type { Product } from '../../types/product';
import { logout } from '../auth/authSlice';
import catalogReducer, {
  fetchCatalog,
  fetchCatalogProduct,
  fetchCategories,
  initialCatalogState,
} from './catalogSlice';

vi.mock('../../api/catalogApi', () => ({
  catalogApi: { list: vi.fn(), categories: vi.fn(), get: vi.fn() },
}));
const api = vi.mocked(catalogApi);

const product = (n: number): Product => ({
  _id: `6739f3b2c4e5b8a9d0f1${String(n).padStart(4, '0')}`,
  name: `Producto ${n}`,
  price: 1000 * n,
  discountPercent: 0,
  finalPrice: 1000 * n,
  stock: n,
  sku: `PROD-${n}`,
  isActive: true,
  images: [],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
});

const appError = (status: number | null, message: string): AppError => ({
  status,
  message,
  fieldErrors: {},
  handled: false,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('catalogSlice', () => {
  it('has the documented initial state', () => {
    expect(catalogReducer(undefined, { type: '@@init' })).toEqual({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
      categories: [],
      selected: null,
      status: 'idle',
      error: null,
      selectedStatus: 'idle',
      selectedError: null,
    });
  });

  it('fetchCatalog sends the query from the URL and stores the page', async () => {
    const meta = { page: 2, limit: 12, total: 13, totalPages: 2 };
    api.list.mockResolvedValue({ data: [product(13)], meta });
    const store = setupStore();
    const query = { page: 2, limit: 12, onSale: true, sortBy: 'finalPrice' as const, order: 'asc' as const };

    const pending = store.dispatch(fetchCatalog(query));
    expect(store.getState().catalog.status).toBe('loading');
    await pending;

    expect(api.list).toHaveBeenCalledWith(query, expect.any(AbortSignal));
    expect(store.getState().catalog).toMatchObject({ items: [product(13)], meta, status: 'succeeded' });
  });

  it('fetchCatalog rejected: status "failed" with the friendly message', async () => {
    api.list.mockRejectedValue(appError(null, 'No pudimos conectar con el servidor.'));
    const store = setupStore();

    await store.dispatch(fetchCatalog({}));

    expect(store.getState().catalog).toMatchObject({
      status: 'failed',
      error: 'No pudimos conectar con el servidor.',
    });
  });

  it('an aborted request (the filters changed) is not shown as an error', async () => {
    api.list.mockImplementation(
      (_query, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const store = setupStore();

    const request = store.dispatch(fetchCatalog({}));
    request.abort();
    await request;

    expect(store.getState().catalog.status).toBe('loading');
    expect(store.getState().catalog.error).toBeNull();
  });

  it('fetchCategories stores the list', async () => {
    api.categories.mockResolvedValue(['Abonos', 'Café']);
    const store = setupStore();

    await store.dispatch(fetchCategories());

    expect(store.getState().catalog.categories).toEqual(['Abonos', 'Café']);
  });

  it('fetchCatalogProduct stores the detail, and keeps the 404 status for its own screen', async () => {
    api.get.mockResolvedValueOnce(product(1)).mockRejectedValueOnce(appError(404, 'El producto ya no existe.'));
    const store = setupStore();

    await store.dispatch(fetchCatalogProduct(product(1)._id));
    expect(store.getState().catalog).toMatchObject({ selected: product(1), selectedStatus: 'succeeded' });

    await store.dispatch(fetchCatalogProduct(product(2)._id));
    expect(store.getState().catalog).toMatchObject({
      selected: null,
      selectedStatus: 'failed',
      selectedError: { status: 404 },
    });
  });

  it('logout clears the catalog', () => {
    const state = catalogReducer({ ...initialCatalogState, items: [product(1)], categories: ['Café'] }, logout());
    expect(state).toEqual(initialCatalogState);
  });
});
