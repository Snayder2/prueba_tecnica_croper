import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '../../api/productsApi';
import { setupStore } from '../../app/store';
import type { AppError, PaginatedResponse } from '../../types/api';
import type { Product } from '../../types/product';
import { logout } from '../auth/authSlice';
import sellerProductsReducer, {
  createProduct,
  deleteProduct,
  fetchProducts,
  initialProductsState,
  setLimit,
  setPage,
  setSearch,
  setSort,
  updateProduct,
  adjustStock,
  setDiscount,
  removeDiscount,
  toggleActive,
  deleteImage,
  reorderImages,
  type ProductsState,
} from './sellerProductsSlice';

vi.mock('../../api/productsApi', () => ({
  productsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    adjustStock: vi.fn(),
    setDiscount: vi.fn(),
    removeDiscount: vi.fn(),
    deleteImage: vi.fn(),
    reorderImages: vi.fn(),
  },
}));

const api = vi.mocked(productsApi);

function makeProduct(n: number): Product {
  return {
    _id: `6739f3b2c4e5b8a9d0f1${String(n).padStart(4, '0')}`,
    name: `Producto ${n}`,
    price: n * 1000,
    discountPercent: 0,
    finalPrice: n * 1000,
    stock: n,
    sku: `PROD-${n}`,
    isActive: true,
    images: [],
    seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
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

describe('sellerProductsSlice reducers', () => {
  it('has the documented initial state', () => {
    expect(sellerProductsReducer(undefined, { type: '@@init' })).toEqual({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      filters: { search: '', sortBy: 'createdAt', order: 'desc' },
      status: 'idle',
      error: null,
      saving: false,
      togglingIds: [],
    });
  });

  it('setPage changes the page and never goes below 1', () => {
    expect(sellerProductsReducer(initialProductsState, setPage(3)).meta.page).toBe(3);
    expect(sellerProductsReducer(initialProductsState, setPage(0)).meta.page).toBe(1);
  });

  it('setLimit changes the page size and goes back to page 1', () => {
    const state = sellerProductsReducer(stateWith({ meta: { page: 4, limit: 10, total: 50, totalPages: 5 } }), setLimit(25));
    expect(state.meta).toMatchObject({ limit: 25, page: 1 });
  });

  it('setSearch trims the text and goes back to page 1', () => {
    const state = sellerProductsReducer(stateWith({ meta: { page: 3, limit: 10, total: 30, totalPages: 3 } }), setSearch('  cafe '));
    expect(state.filters.search).toBe('cafe');
    expect(state.meta.page).toBe(1);
  });

  it('setSearch with the same text keeps the current page', () => {
    const current = stateWith({
      filters: { search: 'cafe', sortBy: 'createdAt', order: 'desc' },
      meta: { page: 2, limit: 10, total: 30, totalPages: 3 },
    });
    expect(sellerProductsReducer(current, setSearch('cafe')).meta.page).toBe(2);
  });

  it('setSort sets field and order and goes back to page 1', () => {
    const state = sellerProductsReducer(
      stateWith({ meta: { page: 2, limit: 10, total: 30, totalPages: 3 } }),
      setSort({ sortBy: 'price', order: 'asc' }),
    );
    expect(state.filters).toMatchObject({ sortBy: 'price', order: 'asc' });
    expect(state.meta.page).toBe(1);
  });

  it('logout clears the products state', () => {
    const state = sellerProductsReducer(stateWith({ items: [makeProduct(1)], status: 'succeeded' }), logout());
    expect(state).toEqual(initialProductsState);
  });
});

describe('fetchProducts', () => {
  it('pending: status "loading" and clears the previous error', () => {
    const state = sellerProductsReducer(
      stateWith({ status: 'failed', error: 'antes' }),
      fetchProducts.pending('request-1'),
    );
    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
  });

  it('fulfilled: stores items and meta from the backend', async () => {
    const items = [makeProduct(6), makeProduct(7)];
    api.list.mockResolvedValue(page(items, { page: 2, limit: 5, total: 7, totalPages: 2 }));
    const store = setupStore({ sellerProducts: stateWith({ meta: { page: 2, limit: 5, total: 0, totalPages: 0 } }) });

    await store.dispatch(fetchProducts());

    const state = store.getState().sellerProducts;
    expect(state.status).toBe('succeeded');
    expect(state.items).toEqual(items);
    expect(state.meta).toEqual({ page: 2, limit: 5, total: 7, totalPages: 2 });
  });

  it('sends the current page, size and filters to the API', async () => {
    api.list.mockResolvedValue(page([]));
    const store = setupStore({
      sellerProducts: stateWith({
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

    expect(store.getState().sellerProducts).toMatchObject({
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

    expect(store.getState().sellerProducts.status).toBe('loading');
    expect(store.getState().sellerProducts.error).toBeNull();
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
    expect(store.getState().sellerProducts.saving).toBe(true);

    resolveCreate(makeProduct(1));
    await request;

    const state = store.getState();
    expect(state.sellerProducts.saving).toBe(false);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(state.sellerProducts.items).toHaveLength(1);
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
    expect(store.getState().sellerProducts.saving).toBe(false);
    expect(api.list).not.toHaveBeenCalled();
  });
});

describe('updateProduct', () => {
  it('sends only the changes, replaces the row and notifies "Cambios guardados"', async () => {
    const product = makeProduct(1);
    api.update.mockResolvedValue({ ...product, price: 30000, finalPrice: 30000 });
    const store = setupStore({ sellerProducts: stateWith({ items: [product, makeProduct(2)] }) });

    await store.dispatch(updateProduct({ id: product._id, changes: { price: 30000 } }));

    expect(api.update).toHaveBeenCalledWith(product._id, { price: 30000 });
    expect(api.list).not.toHaveBeenCalled();
    expect(store.getState().sellerProducts.items[0].price).toBe(30000);
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Cambios guardados');
  });

  it('on 404 reloads the list so the deleted product disappears', async () => {
    api.update.mockRejectedValue(appError(404, 'El producto ya no existe.'));
    api.list.mockResolvedValue(page([]));
    const store = setupStore();

    const action = await store.dispatch(updateProduct({ id: 'abc', changes: { name: 'Otro' } }));

    expect(updateProduct.rejected.match(action)).toBe(true);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.getState().sellerProducts.saving).toBe(false);
  });
});

describe('deleteProduct', () => {
  it('deleting the last product of a page goes back to the previous page', async () => {
    api.remove.mockResolvedValue();
    api.list.mockResolvedValue(page([makeProduct(1)], { page: 1, limit: 5, total: 5, totalPages: 1 }));
    const store = setupStore({
      sellerProducts: stateWith({ items: [makeProduct(6)], meta: { page: 2, limit: 5, total: 6, totalPages: 2 } }),
    });

    await store.dispatch(deleteProduct(makeProduct(6)._id));

    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 5 }), expect.any(AbortSignal));
    expect(store.getState().sellerProducts.meta.page).toBe(1);
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Producto eliminado');
  });

  it('deleting one of several products stays on the same page', async () => {
    api.remove.mockResolvedValue();
    api.list.mockResolvedValue(page([makeProduct(6)], { page: 2, limit: 5, total: 6, totalPages: 2 }));
    const store = setupStore({
      sellerProducts: stateWith({
        items: [makeProduct(6), makeProduct(7)],
        meta: { page: 2, limit: 5, total: 7, totalPages: 2 },
      }),
    });

    await store.dispatch(deleteProduct(makeProduct(7)._id));

    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal));
  });
});

describe('row actions (spec 03 §13.3): the response replaces the row without reloading', () => {
  const product = makeProduct(3);
  const other = makeProduct(4);
  const storeWithRows = () =>
    setupStore({ sellerProducts: stateWith({ items: [product, other], status: 'succeeded' }) });

  it('adjustStock replaces the product and notifies "Stock actualizado"', async () => {
    api.adjustStock.mockResolvedValue({ ...product, stock: 8 });
    const store = storeWithRows();

    const pending = store.dispatch(adjustStock({ id: product._id, body: { type: 'increase', quantity: 5 } }));
    expect(store.getState().sellerProducts.saving).toBe(true);
    await pending;

    expect(api.adjustStock).toHaveBeenCalledWith(product._id, { type: 'increase', quantity: 5 });
    expect(store.getState().sellerProducts.items).toEqual([{ ...product, stock: 8 }, other]);
    expect(store.getState().sellerProducts.saving).toBe(false);
    expect(api.list).not.toHaveBeenCalled();
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Stock actualizado');
  });

  it('adjustStock on 409 reads the product again so the real stock shows up', async () => {
    api.adjustStock.mockRejectedValue(appError(409, 'No hay suficiente stock para esa salida.'));
    api.get.mockResolvedValue({ ...product, stock: 1 });
    const store = storeWithRows();

    const action = await store.dispatch(adjustStock({ id: product._id, body: { type: 'decrease', quantity: 3 } }));

    expect(adjustStock.rejected.match(action)).toBe(true);
    expect(action.payload).toMatchObject({ status: 409, message: 'No hay suficiente stock para esa salida.' });
    expect(api.get).toHaveBeenCalledWith(product._id);
    expect(store.getState().sellerProducts.items[0].stock).toBe(1);
  });

  it('setDiscount and removeDiscount replace the row with the backend finalPrice', async () => {
    api.setDiscount.mockResolvedValue({ ...product, discountPercent: 15, finalPrice: 2550 });
    api.removeDiscount.mockResolvedValue(product);
    const store = storeWithRows();

    await store.dispatch(setDiscount({ id: product._id, percent: 15 }));
    expect(store.getState().sellerProducts.items[0]).toMatchObject({ discountPercent: 15, finalPrice: 2550 });

    await store.dispatch(removeDiscount(product._id));
    expect(store.getState().sellerProducts.items[0]).toMatchObject({ discountPercent: 0, finalPrice: 3000 });
    expect(api.list).not.toHaveBeenCalled();
  });

  it('toggleActive marks the product while saving and then replaces it', async () => {
    api.update.mockResolvedValue({ ...product, isActive: false });
    const store = storeWithRows();

    const pending = store.dispatch(toggleActive({ id: product._id, isActive: false }));
    expect(store.getState().sellerProducts.togglingIds).toEqual([product._id]);
    expect(store.getState().sellerProducts.saving).toBe(false);
    await pending;

    expect(api.update).toHaveBeenCalledWith(product._id, { isActive: false });
    expect(store.getState().sellerProducts.togglingIds).toEqual([]);
    expect(store.getState().sellerProducts.items[0].isActive).toBe(false);
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Producto oculto del catálogo');
  });

  it('a 404 reloads the list so the missing product disappears', async () => {
    api.setDiscount.mockRejectedValue(appError(404, 'El producto ya no existe.'));
    api.list.mockResolvedValue(page([other]));
    const store = storeWithRows();

    await store.dispatch(setDiscount({ id: product._id, percent: 10 }));

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.getState().sellerProducts.items).toEqual([other]);
  });
});

describe('image thunks (spec 03 §13.3)', () => {
  const imageA = {
    _id: '673a01c9c4e5b8a9d0f12401',
    url: 'http://localhost:3000/api/v1/products/p1/images/a',
    thumbUrl: 'http://localhost:3000/api/v1/products/p1/images/a/thumb',
    width: 1200,
    height: 1200,
  };
  const imageB = { ...imageA, _id: '673a01c9c4e5b8a9d0f12402' };
  const product = { ...makeProduct(5), images: [imageA, imageB] };
  const storeWithProduct = () =>
    setupStore({ sellerProducts: stateWith({ items: [product], status: 'succeeded' }) });

  it('reorderImages sends the new order and replaces the row', async () => {
    api.reorderImages.mockResolvedValue({ ...product, images: [imageB, imageA] });
    const store = storeWithProduct();

    await store.dispatch(reorderImages({ id: product._id, imageIds: [imageB._id, imageA._id] }));

    expect(api.reorderImages).toHaveBeenCalledWith(product._id, [imageB._id, imageA._id]);
    expect(store.getState().sellerProducts.items[0].images.map((image) => image._id)).toEqual([
      imageB._id,
      imageA._id,
    ]);
    expect(api.list).not.toHaveBeenCalled();
  });

  it('reorderImages on 400 (images changed meanwhile) reads the product again', async () => {
    api.reorderImages.mockRejectedValue(appError(400, 'Las imágenes cambiaron. Vuelve a intentarlo.'));
    api.get.mockResolvedValue({ ...product, images: [imageA] });
    const store = storeWithProduct();

    const action = await store.dispatch(reorderImages({ id: product._id, imageIds: [imageB._id, imageA._id] }));

    expect(reorderImages.rejected.match(action)).toBe(true);
    expect(store.getState().sellerProducts.items[0].images).toEqual([imageA]);
  });

  it('deleteImage replaces the row and notifies', async () => {
    api.deleteImage.mockResolvedValue({ ...product, images: [imageB] });
    const store = storeWithProduct();

    await store.dispatch(deleteImage({ id: product._id, imageId: imageA._id }));

    expect(api.deleteImage).toHaveBeenCalledWith(product._id, imageA._id);
    expect(store.getState().sellerProducts.items[0].images).toEqual([imageB]);
    expect(store.getState().ui.notifications.map((n) => n.message)).toContain('Imagen eliminada');
  });

  it('deleteImage on 404 "La imagen ya no existe." reads the product again', async () => {
    api.deleteImage.mockRejectedValue(appError(404, 'La imagen ya no existe.'));
    api.get.mockResolvedValue({ ...product, images: [imageB] });
    api.list.mockResolvedValue(page([{ ...product, images: [imageB] }]));
    const store = storeWithProduct();

    const action = await store.dispatch(deleteImage({ id: product._id, imageId: imageA._id }));

    expect(action.payload).toMatchObject({ status: 404, message: 'La imagen ya no existe.' });
    expect(api.get).toHaveBeenCalledWith(product._id);
    expect(store.getState().sellerProducts.items[0].images).toEqual([imageB]);
  });
});
