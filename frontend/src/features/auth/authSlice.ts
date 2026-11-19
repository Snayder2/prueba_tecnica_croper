import { createSlice, isPending, isRejected } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import { createAppAsyncThunk } from '../../app/hooks';
import type { RootState } from '../../app/store';
import type { LoginRequest, RegisterRequest, User, UserRole } from '../../types/auth';
import { MESSAGES, toAppError } from '../../utils/errorMessages';

export const TOKEN_STORAGE_KEY = 'productos.token';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface AuthState {
  token: string | null;
  user: User | null;
  status: RequestStatus;
  error: string | null;
}

/** localStorage can throw (private mode, blocked storage): never crash on it. */
export function loadStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: loadStoredToken(),
  user: null,
  status: 'idle',
  error: null,
};

/** Logs in and loads the user in one step, so the session starts complete. */
export const login = createAppAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const { accessToken } = await authApi.login(credentials);
      const user = await authApi.me(accessToken);
      return { token: accessToken, user };
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

export const register = createAppAsyncThunk(
  'auth/register',
  async (data: RegisterRequest, { rejectWithValue }) => {
    try {
      return await authApi.register(data);
    } catch (error) {
      return rejectWithValue(toAppError(error));
    }
  },
);

/** Restores the user after a page reload, using the stored token. */
export const fetchMe = createAppAsyncThunk('auth/fetchMe', async (_: void, { rejectWithValue }) => {
  try {
    return await authApi.me();
  } catch (error) {
    return rejectWithValue(toAppError(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: () => ({ token: null, user: null, status: 'idle' as const, error: null }),
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.status = 'succeeded';
      })
      .addCase(register.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchMe.rejected, (state, action) => {
        // An expired token was already handled by the HTTP client (logout + notice).
        if (action.payload?.handled) {
          state.status = 'idle';
          return;
        }
        state.status = 'failed';
        state.error = action.payload?.message ?? MESSAGES.unexpected;
      })
      .addMatcher(isPending(login, register, fetchMe), (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addMatcher(isRejected(login, register), (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message ?? MESSAGES.unexpected;
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;

/** Start screen of each role (contract §7.3). */
export const HOME_PATHS: Record<UserRole, string> = {
  seller: '/seller/products',
  buyer: '/catalog',
};

/** Role of the logged-in user, from GET /auth/me (the token is never decoded). */
export const selectRole = (state: RootState): UserRole | null => state.auth.user?.role ?? null;

/** Where the user lands after login, on "/" and after a forbidden route. */
export const selectHomePath = (state: RootState): string => {
  const role = selectRole(state);
  return role ? HOME_PATHS[role] : '/login';
};
export default authSlice.reducer;
