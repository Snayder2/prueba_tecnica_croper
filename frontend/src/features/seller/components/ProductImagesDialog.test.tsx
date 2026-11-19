import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '../../../api/productsApi';
import { setupStore } from '../../../app/store';
import type { Product, ProductImage } from '../../../types/product';
import { initialProductsState, uploadImage } from '../sellerProductsSlice';
import { ProductImagesDialog } from './ProductImagesDialog';

vi.mock('../../../api/productsApi', () => ({
  productsApi: { uploadImage: vi.fn(), deleteImage: vi.fn(), reorderImages: vi.fn(), get: vi.fn(), list: vi.fn() },
}));
const api = vi.mocked(productsApi);

const image = (n: number): ProductImage => ({
  _id: `673a01c9c4e5b8a9d0f1240${n}`,
  url: `http://localhost:3000/uploads/products/${n}.webp`,
  thumbUrl: `http://localhost:3000/uploads/products/${n}_thumb.webp`,
  width: 1200,
  height: 1200,
});

const product: Product = {
  _id: '6739f3b2c4e5b8a9d0f12346',
  name: 'Café de origen Huila 500 g',
  price: 32000,
  discountPercent: 0,
  finalPrice: 32000,
  stock: 120,
  sku: 'CAF-HUI-500',
  isActive: true,
  images: [image(1), image(2), image(3)],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
};

const fileOf = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

function renderDialog(current: Product = product) {
  const store = setupStore({ sellerProducts: { ...initialProductsState, items: [current] } });
  render(
    <Provider store={store}>
      <ProductImagesDialog product={current} intro="Producto creado. Ahora agrega sus imágenes." onClose={vi.fn()} />
    </Provider>,
  );
  return store;
}

const fileInput = () => screen.getByLabelText('Elegir imágenes del producto');

// A dropped file (or "All files" in the picker) skips the accept attribute.
const user = () => userEvent.setup({ applyAccept: false });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProductImagesDialog (spec 03 §13.4)', () => {
  it('shows the counter, the main image label and the intro message', () => {
    renderDialog();
    expect(screen.getByText('3 de 5')).toBeInTheDocument();
    const [first] = within(screen.getByRole('list', { name: 'Imágenes del producto' })).getAllByRole('listitem');
    expect(within(first).getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Producto creado. Ahora agrega sus imágenes.')).toBeInTheDocument();
  });

  it('an image of 2 MB shows the error without making any request', async () => {
    renderDialog();
    await user().upload(fileInput(), fileOf('foto.png', 'image/png', 2 * 1024 * 1024));

    expect(screen.getByRole('alert')).toHaveTextContent('foto.png pesa 2 MB. El máximo es 1 MB.');
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads valid files one by one with a progress bar each; rejected ones are not sent', async () => {
    let finishFirst: (value: Product) => void = () => {};
    api.uploadImage
      .mockImplementationOnce((_id, _file, onProgress) => {
        onProgress?.(40);
        return new Promise<Product>((resolve) => {
          finishFirst = resolve;
        });
      })
      .mockResolvedValueOnce({ ...product, images: [...product.images, image(4), image(5)] });
    renderDialog();

    await user().upload(fileInput(), [
      fileOf('a.jpg', 'image/jpeg', 1000),
      fileOf('documento.pdf', 'application/pdf', 1000),
      fileOf('b.png', 'image/png', 1000),
    ]);

    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('En espera')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('documento.pdf no es una imagen válida. Usa JPG, PNG o WebP.');
    expect(api.uploadImage).toHaveBeenCalledTimes(1);

    finishFirst({ ...product, images: [...product.images, image(4)] });
    await vi.waitFor(() => expect(screen.getByText('5 de 5')).toBeInTheDocument());
    expect(api.uploadImage).toHaveBeenCalledTimes(2);
    expect(api.uploadImage.mock.calls.map(([, file]) => file.name)).toEqual(['a.jpg', 'b.png']);
    expect(fileInput()).toBeDisabled();
  });

  it('"Hacer principal" moves the image to the start with the order endpoint', async () => {
    api.reorderImages.mockResolvedValue({ ...product, images: [image(3), image(1), image(2)] });
    renderDialog();

    const third = within(screen.getByRole('list', { name: 'Imágenes del producto' })).getAllByRole('listitem')[2];
    await userEvent.click(within(third).getByRole('button', { name: 'Hacer principal' }));

    expect(api.reorderImages).toHaveBeenCalledWith(product._id, [image(3)._id, image(1)._id, image(2)._id]);
  });

  it('deleting asks for confirmation first', async () => {
    api.deleteImage.mockResolvedValue({ ...product, images: [image(2), image(3)] });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar la imagen 1' }));
    expect(api.deleteImage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sí' }));

    expect(api.deleteImage).toHaveBeenCalledWith(product._id, image(1)._id);
    await vi.waitFor(() => expect(screen.getByText('2 de 5')).toBeInTheDocument());
  });
});

describe('uploadImage thunk', () => {
  it('passes onProgress to the API, replaces the row and does not trip the serializable check', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.uploadImage.mockResolvedValue({ ...product, images: [...product.images, image(4)] });
    const store = setupStore({ sellerProducts: { ...initialProductsState, items: [product] } });
    const onProgress = vi.fn();
    const file = fileOf('a.jpg', 'image/jpeg', 10);

    await store.dispatch(uploadImage({ id: product._id, file, onProgress }));

    expect(api.uploadImage).toHaveBeenCalledWith(product._id, file, onProgress);
    expect(store.getState().sellerProducts.items[0].images).toHaveLength(4);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
