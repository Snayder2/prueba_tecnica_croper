import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '../../api/productsApi';
import { setupStore } from '../../app/store';
import type { AppError, PaginatedResponse } from '../../types/api';
import type { Product } from '../../types/product';
import { logout } from '../auth/authSlice';
import productsReducer, {
  createProduct,
  deleteProduct,
  fetchProducts,
  initialProductsState,
  setLimit,
  setPage,
  setSearch,
  setSort,
  updateProduct,
  type ProductsState,
} from './productsSlice';

vi.mock('../../api/productsApi', () => ({
  productsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const api = vi.mocked(productsApi);

function makeProduct(n: number): Product {
  return {
    _id: `6739f3b2c4e5b8a9d0f1${String(n).padStart(4, '0')}`,
    name: `Producto ${n}`,
    price: n * 1000,
    stock: n,
    sku: `PROD-${n}`,
    isActive: true,
    createdAt: '2026-11-17T21:35:00.000Z',
    updatedAt: '2026-11-17T21:35:00.000Z',
  };
}

function page(items: Product[], meta: Partial<PaginatedResponse<Product>['meta']> = {}): PaginatedResponse<Product> {
  return { data: items, meta: { page: 1, limit: 10, total: items.length, totalPages: 1, ...meta } };
}

function appError(status: number | null, message: string): AppError {
  return { status, message, fieldErrors: {}, handled: false };
}

function stateWith(overrides: Partial<ProductsState>): ProductsState {
  return { ...initialProductsState, ...overrides, meta: { ...initialProductsState.meta, ...overrides.meta } };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('productsSlice reducers', () => {
  it('has the documented initial state', () => {
    expect(productsReducer(undefined, { type: '@@init' })).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      filters: { search: '', sortBy: 'createdAt', order: 'desc' },
      status: 'idle',
      error: null,
      saving: false,
    });
  });

  it('setPage changes the page and never goes below 1', () => {
    expect(productsReducer(initialProductsState, setPage(3)).meta.page).toBe(3);
    expect(productsReducer(initialProductsState, setPage(0)).meta.page).toBe(1);
  });

  it('setLimit changes the page size and goes back to page 1', () => {
    const state = productsReducer(stateWith({ meta: { page: 4, limit: 10, total: 50, totalPages: 5 } }), setLimit(25));
    expect(state.meta).toMatchObject({ limit: 25, page: 1 });
  });

  it('setSearch trims the text and goes back to page 1', () => {
    const state = productsReducer(stateWith({ meta: { page: 3, limit: 10, total: 30, totalPages: 3 } }), setSearch('  cafe '));
    expect(state.filters.search).toBe('cafe');
    expect(state.meta.page).toBe(1);
  });

  it('setSearch with the same text keeps the current page', () => {
    const current = stateWith({
      filters: { search: 'cafe', sortBy: 'createdAt', order: 'desc' },
      meta: { page: 2, limit: 10, total: 30, totalPages: 3 },
    });
    expect(productsReducer(current, setSearch('cafe')).meta.page).toBe(2);
  });

  it('setSort sets field and order and goes back to page 1', () => {
    const state = productsReducer(
      stateWith({ meta: { page: 2, limit: 10, total: 30, totalPages: 3 } }),
      setSort({ sortBy: 'price', order: 'asc' }),
    );
    expect(state.filters).toMatchObject({ sortBy: 'price', order: 'asc' });
    expect(state.meta.page).toBe(1);
  });

  it('logout clears the products state', () => {
    const state = productsReducer(stateWith({ items: [makeProduct(1)], status: 'succeeded' }), logout());
    expect(state).toEqual(initialProductsState);
  });
});

describe('fetchProducts', () => {
  it('pending: status "loading" and clears the previous error', () => {
    const state = productsReducer(
      stateWith({ status: 'failed', error: 'antes' }),
      fetchProducts.pending('request-1'),
    );
    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
  });

  it('fulfilled: stores items and meta from the backend', async () => {
    const items = [makeProduct(6), makeProduct(7)];
    api.list.mockResolvedValue(page(items, { page: 2, limit: 5, total: 7, totalPages: 2 }));
    const store = setupStore({ products: stateWith({ meta: { page: 2, limit: 5, total: 0, totalPages: 0 } }) });

    await store.dispatch(fetchProducts());

    const state = store.getState().products;
    expect(state.status).toBe('succeeded');
    expect(state.items).toEqual(items);
    expect(state.meta).toEqual({ page: 2, limit: 5, total: 7, totalPages: 2 });
  });

  it('sends the current page, size and filters to the API', async () => {
    api.list.mockResolvedValue(page([]));
    const store = setupStore({
      products: stateWith({
        meta: { page: 3, limit: 25, total: 0, totalPages: 0 },
        filters: { search: 'cafe', sortBy: 'price', order: 'asc' },
      }),
    });

    await store.dispatch(fetchProducts());

    expect(api.list).toHaveBeenCalledWith(
      { page: 3, limit: 25, search: 'cafe', sortBy: 'price', order: 'asc' },
      expect.any(AbortSignal),
    );
  });

  it('rejected: status "failed" with the friendly message', async () => {
    api.list.mockRejectedValue(appError(null, 'No pudimos conectar con el servidor.'));
    const store = setupStore();

    await store.dispatch(fetchProducts());

    expect(store.getState().products).toMatchObject({
      status: 'failed',
      error: 'No pudimos conectar con el servidor.',
    });
  });

  it('an aborted request (replaced by a newer one) is not shown as an error', async () => {
    api.list.mockImplementation(
      (_query, signal) =>
        new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const store = setupStore();

    const request = store.dispatch(fetchProducts());
    request.abort();
    await request;

    expect(store.getState().products.status).toBe('loading');
    expect(store.getState().products.error).toBeNull();
  });
});

describe('createProduct', () => {
  const body = { name: 'Fertilizante NPK', price: 145000, stock: 40, sku: 'FER-NPK-50' };

  it('sets saving while pending, then notifies and reloads the current page', async () => {
    let resolveCreate: (product: Product) => void = () => {};
    api.create.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    api.list.mockResolvedValue(page([makeProduct(1)]));
    const store = setupStore();

    const request = store.dispatch(createProduct(body));
    expect(store.getState().products.saving).toBe(true);

    resolveCreate(makeProduct(1));
    await request;

    const state = store.getState();
    expect(state.products.saving).toBe(false);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(state.products.items).toHaveLength(1);
    expect(state.ui.notifications.map((n) => n.message)).toContain('Producto creado');
  });

  it('rejected: clears saving and returns the AppError (e.g. duplicate SKU)', async () => {
    const duplicate: AppError = {
      status: 409,
      message: 'Ya existe un producto con ese SKU.',
      fieldErrors: { sku: 'Ya existe un producto con ese SKU.' },
      handled: false,
    };
    api.create.mockRejectedValue(duplicate);
    const store = setupStore();

    const action = await store.dispatch(createProduct(body));

    expect(createProduct.rejected.match(action)).toBe(true);
    expect(action.payload).toEqual(duplicate);
    expect(store.getState().products.saving).toBe(false);
    expect(api.list).not.toHaveBeenCalled();
  });
});

describe('updateProduct', () => {
  it('sends only the changes and notifies "Cambios guardados"', async () => {
    api.update.mockResolvedValue({ ...makeProduct(1), price: 30000 });
    api.list.mockResolvedValue(page([makeProduct(1)]));
    const store = setupStore();

    await store.dispatch(updateProduct({ id: 'abc', changes: { price: 30000 } }));

    expect(api.update).toHaveBeenCalledWith('abc', { price: 30000 });
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Cambios guardados');
  });

  it('on 404 reloads the list so the deleted product disappears', async () => {
    api.update.mockRejectedValue(appError(404, 'El producto ya no existe.'));
    api.list.mockResolvedValue(page([]));
    const store = setupStore();

    const action = await store.dispatch(updateProduct({ id: 'abc', changes: { stock: 1 } }));

    expect(updateProduct.rejected.match(action)).toBe(true);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.getState().products.saving).toBe(false);
  });
});

describe('deleteProduct', () => {
  it('deleting the last product of a page goes back to the previous page', async () => {
    api.remove.mockResolvedValue();
    api.list.mockResolvedValue(page([makeProduct(1)], { page: 1, limit: 5, total: 5, totalPages: 1 }));
    const store = setupStore({
      products: stateWith({ items: [makeProduct(6)], meta: { page: 2, limit: 5, total: 6, totalPages: 2 } }),
    });

    await store.dispatch(deleteProduct(makeProduct(6)._id));

    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 5 }), expect.any(AbortSignal));
    expect(store.getState().products.meta.page).toBe(1);
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Producto eliminado');
  });

  it('deleting one of several products stays on the same page', async () => {
    api.remove.mockResolvedValue();
    api.list.mockResolvedValue(page([makeProduct(6)], { page: 2, limit: 5, total: 6, totalPages: 2 }));
    const store = setupStore({
      products: stateWith({
        items: [makeProduct(6), makeProduct(7)],
        meta: { page: 2, limit: 5, total: 7, totalPages: 2 },
      }),
    });

    await store.dispatch(deleteProduct(makeProduct(7)._id));

    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal));
  });
});
