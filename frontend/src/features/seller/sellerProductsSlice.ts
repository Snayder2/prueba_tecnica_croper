import {
  createSlice,
  isAnyOf,
  isFulfilled,
  isPending,
  isRejected,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { productsApi } from '../../api/productsApi';
import { createAppAsyncThunk } from '../../app/hooks';
import type { AppDispatch } from '../../app/store';
import type { AppError, PaginationMeta } from '../../types/api';
import type {
  CreateProductRequest,
  Product,
  SellerProductSortField,
  SortOrder,
  StockAdjustmentRequest,
  UpdateProductRequest,
} from '../../types/product';
import { MESSAGES, toAppError } from '../../utils/errorMessages';
import { logout, type RequestStatus } from '../auth/authSlice';
import { showNotification } from '../ui/uiSlice';

export const PAGE_SIZES = [5, 10, 25] as const;

export interface ProductFilters {
  search: string;
  sortBy: SellerProductSortField;
  order: SortOrder;
}

export interface ProductsState {
  items: Product[];
  meta: PaginationMeta;
  filters: ProductFilters;
  status: RequestStatus;
  error: string | null;
  /** True while a dialog action is in flight (disables its buttons). */
  saving: boolean;
  /** Products whose visibility switch is being saved. */
  togglingIds: string[];
}

export const initialProductsState: ProductsState = {
  items: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
  filters: { search: '', sortBy: 'createdAt', order: 'desc' },
  status: 'idle',
  error: null,
  saving: false,
  togglingIds: [],
};

/** Loads the current page with the current filters (both read from the store). */
export const fetchProducts = createAppAsyncThunk(
  'sellerProducts/fetchProducts',
  async (_: void, { getState, signal, rejectWithValue }) => {
    const { meta, filters } = getState().sellerProducts;
    try {
      return await productsApi.list({ page: meta.page, limit: meta.limit, ...filters }, signal);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const createProduct = createAppAsyncThunk(
  'sellerProducts/createProduct',
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

/**
 * Runs a request that returns the updated product and notifies the success.
 * The thunks below put the response in place of the row (no list reload,
 * spec 03 §13.3). On 404 the list is reloaded so the missing product disappears.
 * Throws the AppError so each thunk can reject with it.
 */
async function runRowAction(
  request: () => Promise<Product>,
  successMessage: string,
  dispatch: AppDispatch,
): Promise<Product> {
  try {
    const product = await request();
    dispatch(showNotification({ type: 'success', message: successMessage }));
    return product;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.status === 404) await dispatch(fetchProducts());
    throw appError;
  }
}

export const updateProduct = createAppAsyncThunk(
  'sellerProducts/updateProduct',
  async ({ id, changes }: { id: string; changes: UpdateProductRequest }, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(() => productsApi.update(id, changes), 'Cambios guardados', dispatch);
    } catch (error) {
      return rejectWithValue(error as AppError);
    }
  },
);

/** Visible / Oculto switch of the table (spec 03 §13.4). */
export const toggleActive = createAppAsyncThunk(
  'sellerProducts/toggleActive',
  async ({ id, isActive }: { id: string; isActive: boolean }, { dispatch, rejectWithValue }) => {
    const message = isActive ? 'Producto visible en el catálogo' : 'Producto oculto del catálogo';
    try {
      return await runRowAction(() => productsApi.update(id, { isActive }), message, dispatch);
    } catch (error) {
      return rejectWithValue(error as AppError);
    }
  },
);

export const setDiscount = createAppAsyncThunk(
  'sellerProducts/setDiscount',
  async ({ id, percent }: { id: string; percent: number }, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(() => productsApi.setDiscount(id, percent), 'Descuento aplicado', dispatch);
    } catch (error) {
      return rejectWithValue(error as AppError);
    }
  },
);

export const removeDiscount = createAppAsyncThunk(
  'sellerProducts/removeDiscount',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(() => productsApi.removeDiscount(id), 'Descuento quitado', dispatch);
    } catch (error) {
      return rejectWithValue(error as AppError);
    }
  },
);

/**
 * Stock in or out. A 409 means someone sold in between: the product is read
 * again so the row and the dialog show the real stock (spec 03 §13.4).
 */
export const adjustStock = createAppAsyncThunk(
  'sellerProducts/adjustStock',
  async ({ id, body }: { id: string; body: StockAdjustmentRequest }, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(() => productsApi.adjustStock(id, body), 'Stock actualizado', dispatch);
    } catch (error) {
      const appError = error as AppError;
      if (appError.status === 409) {
        try {
          dispatch(productRefreshed(await productsApi.get(id)));
        } catch {
          // The adjustment error is the one shown; the row keeps its last known stock.
        }
      }
      return rejectWithValue(appError);
    }
  },
);

/**
 * Uploads one image (spec 03 §13.3). `onProgress` (0–100) goes to axios'
 * onUploadProgress; it and the File are not serializable, so the store ignores
 * meta.arg.onProgress and meta.arg.file in its serializable check.
 */
export const uploadImage = createAppAsyncThunk(
  'sellerProducts/uploadImage',
  async (
    { id, file, onProgress }: { id: string; file: File; onProgress?: (percent: number) => void },
    { dispatch, rejectWithValue },
  ) => {
    try {
      return await productsApi.uploadImage(id, file, onProgress);
    } catch (error) {
      const appError = toAppError(error);
      if (appError.status === 404) await dispatch(fetchProducts());
      return rejectWithValue(appError);
    }
  },
);

/** Reads the product again after an image error, so the dialog shows the real images. */
async function refreshAfterImageError(id: string, appError: AppError, dispatch: AppDispatch) {
  if (appError.status !== 400 && appError.status !== 404) return;
  try {
    dispatch(productRefreshed(await productsApi.get(id)));
  } catch {
    // The product itself is gone: the list reload removes it.
    await dispatch(fetchProducts());
  }
}

export const deleteImage = createAppAsyncThunk(
  'sellerProducts/deleteImage',
  async ({ id, imageId }: { id: string; imageId: string }, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(() => productsApi.deleteImage(id, imageId), 'Imagen eliminada', dispatch);
    } catch (error) {
      await refreshAfterImageError(id, error as AppError, dispatch);
      return rejectWithValue(error as AppError);
    }
  },
);

/** New order of the images; the first one becomes the main image. */
export const reorderImages = createAppAsyncThunk(
  'sellerProducts/reorderImages',
  async ({ id, imageIds }: { id: string; imageIds: string[] }, { dispatch, rejectWithValue }) => {
    try {
      return await runRowAction(
        () => productsApi.reorderImages(id, imageIds),
        'Imagen principal actualizada',
        dispatch,
      );
    } catch (error) {
      await refreshAfterImageError(id, error as AppError, dispatch);
      return rejectWithValue(error as AppError);
    }
  },
);

export const deleteProduct = createAppAsyncThunk(
  'sellerProducts/deleteProduct',
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
    const { items, meta } = getState().sellerProducts;
    if (items.length === 1 && meta.page > 1) {
      dispatch(setPage(meta.page - 1));
    }
    await dispatch(fetchProducts());
    return id;
  },
);

function replaceItem(state: ProductsState, product: Product) {
  const index = state.items.findIndex((item) => item._id === product._id);
  if (index !== -1) state.items[index] = product;
}

/** Thunks started from a dialog: while one runs, its buttons are disabled. */
const DIALOG_THUNKS = [
  createProduct,
  updateProduct,
  deleteProduct,
  setDiscount,
  removeDiscount,
  adjustStock,
] as const;

const sellerProductsSlice = createSlice({
  name: 'sellerProducts',
  initialState: initialProductsState,
  reducers: {
    /** Puts a fresh copy of a product in its row (if it is on the current page). */
    productRefreshed(state, action: PayloadAction<Product>) {
      replaceItem(state, action.payload);
    },
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
    setSort(state, action: PayloadAction<{ sortBy: SellerProductSortField; order: SortOrder }>) {
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
      .addCase(toggleActive.pending, (state, action) => {
        state.togglingIds.push(action.meta.arg.id);
      })
      .addMatcher(isAnyOf(toggleActive.fulfilled, toggleActive.rejected), (state, action) => {
        state.togglingIds = state.togglingIds.filter((id) => id !== action.meta.arg.id);
      })
      // Row actions: the response replaces the product, without reloading the list.
      .addMatcher(
        isFulfilled(
          updateProduct,
          toggleActive,
          setDiscount,
          removeDiscount,
          adjustStock,
          uploadImage,
          deleteImage,
          reorderImages,
        ),
        (state, action) => {
          replaceItem(state, action.payload);
        },
      )
      .addMatcher(isPending(...DIALOG_THUNKS), (state) => {
        state.saving = true;
      })
      .addMatcher(isFulfilled(...DIALOG_THUNKS), (state) => {
        state.saving = false;
      })
      .addMatcher(isRejected(...DIALOG_THUNKS), (state) => {
        state.saving = false;
      });
  },
});

export const { productRefreshed, setPage, setLimit, setSearch, setSort } = sellerProductsSlice.actions;
export default sellerProductsSlice.reducer;
