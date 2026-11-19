import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { selectHomePath, selectRole } from '../features/auth/authSlice';
import type { User, UserRole } from '../types/auth';
import { routes } from './routes';
import { setupStore } from './store';

vi.mock('../api/catalogApi', () => ({
  catalogApi: {
    list: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } }),
    categories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../api/productsApi', () => ({
  productsApi: { list: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }) },
}));

const userWith = (role: UserRole): User => ({
  _id: '6739f2a1c4e5b8a9d0f12345',
  email: 'ana@correo.com',
  name: 'Ana Pérez',
  role,
  createdAt: '2026-11-17T21:30:00.000Z',
  updatedAt: '2026-11-17T21:30:00.000Z',
});

function renderAt(path: string, role: UserRole | null) {
  const store = setupStore({
    auth: {
      token: role ? 'token' : null,
      user: role ? userWith(role) : null,
      status: role ? 'succeeded' : 'idle',
      error: null,
    },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { store, router };
}

describe('auth selectors', () => {
  it('give the role and the start screen of each role', () => {
    const seller = setupStore({ auth: { token: 't', user: userWith('seller'), status: 'succeeded', error: null } });
    const buyer = setupStore({ auth: { token: 't', user: userWith('buyer'), status: 'succeeded', error: null } });

    expect(selectRole(seller.getState())).toBe('seller');
    expect(selectHomePath(seller.getState())).toBe('/seller/products');
    expect(selectHomePath(buyer.getState())).toBe('/catalog');
    expect(selectHomePath(setupStore().getState())).toBe('/login');
  });
});

describe('routes by role (spec 03 §13.1)', () => {
  it('"/" sends a buyer to /catalog and a seller to /seller/products', async () => {
    const { router } = renderAt('/', 'buyer');
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalog');

    const seller = renderAt('/', 'seller');
    await vi.waitFor(() => expect(seller.router.state.location.pathname).toBe('/seller/products'));
  });

  it('a buyer who types /seller/products ends up in /catalog with a notice', async () => {
    const { router, store } = renderAt('/seller/products', 'buyer');

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalog');
    expect(store.getState().ui.notifications.map((n) => n.message)).toEqual([
      'No tienes acceso a esa sección.',
    ]);
  });

  it('a seller who types /catalog or a product detail ends up in /seller/products with a notice', async () => {
    for (const path of ['/catalog', '/catalog/6739f3b2c4e5b8a9d0f12346']) {
      const { router, store } = renderAt(path, 'seller');

      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/seller/products'));
      expect(store.getState().ui.notifications.map((n) => n.message)).toEqual([
        'No tienes acceso a esa sección.',
      ]);
      cleanup();
    }
  });

  it('the top bar shows "Catálogo" only to buyers and "Mis productos" only to sellers', async () => {
    renderAt('/catalog', 'buyer');
    expect(await screen.findByRole('link', { name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mis productos' })).not.toBeInTheDocument();
    cleanup();

    renderAt('/seller/products', 'seller');
    expect(await screen.findByRole('link', { name: 'Mis productos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Catálogo' })).not.toBeInTheDocument();
  });

  it('without a session a protected route goes to /login', async () => {
    const { router } = renderAt('/catalog', null);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
