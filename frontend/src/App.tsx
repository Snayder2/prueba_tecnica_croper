import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { NotFoundPage } from './components/NotFoundPage';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { FullScreenLoader } from './components/Spinner';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';

// Loaded on demand: the login screen does not need the products code (dialogs, tables).
const ProductsPage = lazy(() =>
  import('./features/products/ProductsPage').then((module) => ({ default: module.ProductsPage })),
);

// Routes from spec §5.
const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/products" replace /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/products',
            element: (
              <Suspense fallback={<FullScreenLoader label="Cargando productos…" />}>
                <ProductsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
