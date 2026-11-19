import { createSlice } from '@reduxjs/toolkit';
import { catalogApi } from '../../api/catalogApi';
import { createAppAsyncThunk } from '../../app/hooks';
import type { PaginationMeta } from '../../types/api';
import type { CatalogQuery, Product } from '../../types/product';
import { CATALOG_DEFAULTS } from '../../utils/catalogQuery';
import { MESSAGES, toAppError } from '../../utils/errorMessages';
import { logout, type RequestStatus } from '../auth/authSlice';

export interface CatalogState {
  items: Product[];
  meta: PaginationMeta;
  categories: string[];
  /** Product of the detail page (/catalog/:id). */
  selected: Product | null;
  /** Status of the grid. */
  status: RequestStatus;
  error: string | null;
  /** Status and HTTP code of the detail, so a 404 shows its own screen. */
  selectedStatus: RequestStatus;
  selectedError: { status: number | null; message: string } | null;
}

export const initialCatalogState: CatalogState = {
  items: [],
  meta: { page: CATALOG_DEFAULTS.page, limit: CATALOG_DEFAULTS.limit, total: 0, totalPages: 0 },
  categories: [],
  selected: null,
  status: 'idle',
  error: null,
  selectedStatus: 'idle',
  selectedError: null,
};

/**
 * Loads a page of the catalog. The query comes from the URL (spec 03 §13.3);
 * the page aborts the previous request when the URL changes.
 */
export const fetchCatalog = createAppAsyncThunk(
  'catalog/fetchCatalog',
  async (query: CatalogQuery, { signal, rejectWithValue }) => {
    try {
      return await catalogApi.list(query, signal);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const fetchCategories = createAppAsyncThunk(
  'catalog/fetchCategories',
  async (_: void, { rejectWithValue }) => {
    try {
      return await catalogApi.categories();
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const fetchCatalogProduct = createAppAsyncThunk(
  'catalog/fetchCatalogProduct',
  async (id: string, { signal, rejectWithValue }) => {
    try {
      return await catalogApi.get(id, signal);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: initialCatalogState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalog.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCatalog.fulfilled, (state, action) => {
        state.items = action.payload.data;
        state.meta = action.payload.meta;
        state.status = 'succeeded';
      })
      .addCase(fetchCatalog.rejected, (state, action) => {
        // A newer request (filters changed) replaced this one: not an error.
        if (action.meta.aborted) return;
        state.status = 'failed';
        state.error = action.payload?.message ?? MESSAGES.unexpected;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchCatalogProduct.pending, (state, action) => {
        state.selectedStatus = 'loading';
        state.selectedError = null;
        // Never show another product while the new one loads.
        if (state.selected?._id !== action.meta.arg) state.selected = null;
      })
      .addCase(fetchCatalogProduct.fulfilled, (state, action) => {
        state.selected = action.payload;
        state.selectedStatus = 'succeeded';
      })
      .addCase(fetchCatalogProduct.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.selectedStatus = 'failed';
        state.selectedError = {
          status: action.payload?.status ?? null,
          message: action.payload?.message ?? MESSAGES.unexpected,
        };
      })
      .addCase(logout, () => initialCatalogState);
  },
});

export default catalogSlice.reducer;
