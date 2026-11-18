import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupApiClient } from '../api/client';
import authReducer, { logout, TOKEN_STORAGE_KEY } from '../features/auth/authSlice';
import productsReducer from '../features/products/productsSlice';
import uiReducer, { showNotification } from '../features/ui/uiSlice';
import { MESSAGES } from '../utils/errorMessages';

const rootReducer = combineReducers({
  auth: authReducer,
  products: productsReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates a store; tests use it with their own preloaded state. */
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
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
