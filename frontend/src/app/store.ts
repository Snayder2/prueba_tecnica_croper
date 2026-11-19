import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupApiClient } from '../api/client';
import authReducer, { logout, TOKEN_STORAGE_KEY } from '../features/auth/authSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import sellerProductsReducer from '../features/seller/sellerProductsSlice';
import uiReducer, { showNotification } from '../features/ui/uiSlice';
import { MESSAGES } from '../utils/errorMessages';

const rootReducer = combineReducers({
  auth: authReducer,
  sellerProducts: sellerProductsReducer,
  catalog: catalogReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates a store; tests use it with their own preloaded state. */
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // uploadImage receives a progress callback and the File to upload; neither is
          // serializable and neither is stored in the state (spec 03 §13.3).
          ignoredActionPaths: ['meta.arg.onProgress', 'meta.arg.file'],
        },
      }),
  });
}

export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];

export const store = setupStore();

// The HTTP client reads the token from the store and reports expired sessions.
setupApiClient({
  getToken: () => store.getState().auth.token,
  onSessionExpired: () => {
    store.dispatch(logout());
    store.dispatch(showNotification({ type: 'info', message: MESSAGES.sessionExpired }));
  },
});

// Keeps the token in localStorage so the session survives a page reload.
let persistedToken = store.getState().auth.token;
store.subscribe(() => {
  const { token } = store.getState().auth;
  if (token === persistedToken) return;
  persistedToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable: the session simply won't survive a reload.
  }
});
