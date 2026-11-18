import { createSlice, isFulfilled, isPending, isRejected, type PayloadAction } from '@reduxjs/toolkit';
import { productsApi } from '../../api/productsApi';
import { createAppAsyncThunk } from '../../app/hooks';
import type { PaginationMeta } from '../../types/api';
import type {
  CreateProductRequest,
  Product,
  ProductSortField,
  SortOrder,
  UpdateProductRequest,
} from '../../types/product';
import { MESSAGES, toAppError } from '../../utils/errorMessages';
import { logout, type RequestStatus } from '../auth/authSlice';
import { showNotification } from '../ui/uiSlice';

export const PAGE_SIZES = [5, 10, 25] as const;

export interface ProductFilters {
  search: string;
  sortBy: ProductSortField;
  order: SortOrder;
}

export interface ProductsState {
  items: Product[];
  meta: PaginationMeta;
  filters: ProductFilters;
  status: RequestStatus;
  error: string | null;
  /** True while a create/update/delete is in flight (disables buttons). */
  saving: boolean;
}

export const initialProductsState: ProductsState = {
  items: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
  filters: { search: '', sortBy: 'createdAt', order: 'desc' },
  status: 'idle',
  error: null,
  saving: false,
};

/** Loads the current page with the current filters (both read from the store). */
export const fetchProducts = createAppAsyncThunk(
  'products/fetchProducts',
  async (_: void, { getState, signal, rejectWithValue }) => {
    const { meta, filters } = getState().products;
    try {
      return await productsApi.list({ page: meta.page, limit: meta.limit, ...filters }, signal);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const createProduct = createAppAsyncThunk(
  'products/createProduct',
  async (body: CreateProductRequest, { dispatch, rejectWithValue }) => {
    try {
      const product = await productsApi.create(body);
      dispatch(showNotification({ type: 'success', message: 'Producto creado' }));
      await dispatch(fetchProducts());
      return product;
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const updateProduct = createAppAsyncThunk(
  'products/updateProduct',
  async (
    { id, changes }: { id: string; changes: UpdateProductRequest },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const product = await productsApi.update(id, changes);
      dispatch(showNotification({ type: 'success', message: 'Cambios guardados' }));
      await dispatch(fetchProducts());
      return product;
    } catch (error) {
      const appError = toAppError(error);
      // The product was deleted elsewhere: refresh so it disappears from the list.
      if (appError.status === 404) await dispatch(fetchProducts());
      return rejectWithValue(appError);
    }
  },
);

export const deleteProduct = createAppAsyncThunk(
  'products/deleteProduct',
  async (id: string, { dispatch, getState, rejectWithValue }) => {
    try {
      await productsApi.remove(id);
      dispatch(showNotification({ type: 'success', message: 'Producto eliminado' }));
    } catch (error) {
      const appError = toAppError(error);
      if (appError.status === 404) await dispatch(fetchProducts());
      return rejectWithValue(appError);
    }

    // Deleting the last item of a page goes back to the previous page.
    const { items, meta } = getState().products;
    if (items.length === 1 && meta.page > 1) {
      dispatch(setPage(meta.page - 1));
    }
    await dispatch(fetchProducts());
    return id;
  },
);

const productsSlice = createSlice({
  name: 'products',
  initialState: initialProductsState,
  reducers: {
    setPage(state, action: PayloadAction<number>) {
      state.meta.page = Math.max(1, action.payload);
    },
    setLimit(state, action: PayloadAction<number>) {
      state.meta.limit = action.payload;
      state.meta.page = 1;
    },
    setSearch(state, action: PayloadAction<string>) {
      const search = action.payload.trim();
      if (search === state.filters.search) return;
      state.filters.search = search;
      state.meta.page = 1;
    },
    setSort(state, action: PayloadAction<{ sortBy: ProductSortField; order: SortOrder }>) {
      state.filters.sortBy = action.payload.sortBy;
      state.filters.order = action.payload.order;
      state.meta.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.items = action.payload.data;
        state.meta = action.payload.meta;
        state.status = 'succeeded';
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        // A newer request replaced this one (page/search changed): not an error.
        if (action.meta.aborted) return;
        state.status = 'failed';
        state.error = action.payload?.message ?? MESSAGES.unexpected;
      })
      .addCase(logout, () => initialProductsState)
      .addMatcher(isPending(createProduct, updateProduct, deleteProduct), (state) => {
        state.saving = true;
      })
      .addMatcher(
        isFulfilled(createProduct, updateProduct, deleteProduct),
        (state) => {
          state.saving = false;
        },
      )
      .addMatcher(isRejected(createProduct, updateProduct, deleteProduct), (state) => {
        state.saving = false;
      });
  },
});

export const { setPage, setLimit, setSearch, setSort } = productsSlice.actions;
export default productsSlice.reducer;
