import { lazy } from 'react';

// Loaded on demand: the login screen does not need the dialogs, tables or grids.
export const SellerProductsPage = lazy(() =>
  import('../features/seller/SellerProductsPage').then((module) => ({ default: module.SellerProductsPage })),
);
export const CatalogPage = lazy(() =>
  import('../features/catalog/CatalogPage').then((module) => ({ default: module.CatalogPage })),
);
export const ProductDetailPage = lazy(() =>
  import('../features/catalog/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })),
);
