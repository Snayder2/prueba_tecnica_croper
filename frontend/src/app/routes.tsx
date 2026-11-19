import { Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '../components/AppLayout';
import { NotFoundPage } from '../components/NotFoundPage';
import { HomeRedirect, ProtectedRoute, PublicOnlyRoute } from '../components/ProtectedRoute';
import { FullScreenLoader } from '../components/Spinner';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CatalogPage, ProductDetailPage, SellerProductsPage } from './lazyPages';

const page = (element: ReactNode, label: string) => (
  <Suspense fallback={<FullScreenLoader label={label} />}>{element}</Suspense>
);

// Routes from spec 03 §13.1.
export const routes: RouteObject[] = [
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
      { path: '/', element: <HomeRedirect /> },
      // Address of version 1.0: each role now has its own start screen.
      { path: '/products', element: <Navigate to="/" replace /> },
      {
        element: <AppLayout />,
        children: [
          {
            // The catalog is for buyers; a seller only manages their own products.
            element: <ProtectedRoute roles={['buyer']} />,
            children: [
              { path: '/catalog', element: page(<CatalogPage />, 'Cargando el catálogo…') },
              { path: '/catalog/:id', element: page(<ProductDetailPage />, 'Cargando el producto…') },
            ],
          },
          {
            element: <ProtectedRoute roles={['seller']} />,
            children: [
              { path: '/seller/products', element: page(<SellerProductsPage />, 'Cargando productos…') },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

