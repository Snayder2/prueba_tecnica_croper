import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { productsApi } from '../../../api/productsApi';
import { setupStore } from '../../../app/store';
import type { Product } from '../../../types/product';
import { initialProductsState } from '../sellerProductsSlice';
import { DiscountDialog } from './DiscountDialog';
import { StockAdjustDialog } from './StockAdjustDialog';

vi.mock('../../../api/productsApi', () => ({
  productsApi: { adjustStock: vi.fn(), setDiscount: vi.fn(), removeDiscount: vi.fn(), get: vi.fn(), list: vi.fn() },
}));
const api = vi.mocked(productsApi);

const product: Product = {
  _id: '6739f3b2c4e5b8a9d0f12346',
  name: 'Fertilizante NPK 15-15-15 50 kg',
  price: 145000,
  discountPercent: 0,
  finalPrice: 145000,
  stock: 40,
  sku: 'FER-NPK-50',
  isActive: true,
  images: [],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
};

function renderWithStore(ui: React.ReactElement) {
  const store = setupStore({ sellerProducts: { ...initialProductsState, items: [product] } });
  render(<Provider store={store}>{ui}</Provider>);
  return store;
}

describe('StockAdjustDialog', () => {
  it('shows the preview "Stock actual 40 → 45" for an increase of 5', async () => {
    renderWithStore(<StockAdjustDialog productId={product._id} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Cantidad/), '5');

    expect(screen.getByText(/Stock actual 40/)).toHaveTextContent('Stock actual 40 → 45');
  });

  it('does not send a decrease above the current stock', async () => {
    renderWithStore(<StockAdjustDialog productId={product._id} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Salida' }));
    await userEvent.type(screen.getByLabelText(/Cantidad/), '41');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('No hay suficiente stock para esa salida.')).toBeInTheDocument();
    expect(api.adjustStock).not.toHaveBeenCalled();
  });

  it('sends a valid decrease and closes', async () => {
    api.adjustStock.mockResolvedValue({ ...product, stock: 37 });
    const onClose = vi.fn();
    const store = renderWithStore(<StockAdjustDialog productId={product._id} onClose={onClose} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Salida' }));
    await userEvent.type(screen.getByLabelText(/Cantidad/), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.adjustStock).toHaveBeenCalledWith(product._id, { type: 'decrease', quantity: 3 });
    expect(store.getState().sellerProducts.items[0].stock).toBe(37);
  });
});

describe('DiscountDialog', () => {
  it('previews the final price live: 145.000 → 123.250 (-15 %)', async () => {
    renderWithStore(<DiscountDialog product={product} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Porcentaje de descuento/), '15');

    const preview = screen.getByText(/→/);
    expect(preview.textContent?.replace(/\s/g, ' ')).toMatch(/145\.000 → \$ 123\.250 \(-15 %\)/);
    expect(screen.queryByRole('button', { name: 'Quitar descuento' })).not.toBeInTheDocument();
  });

  it('offers "Quitar descuento" when the product already has one', () => {
    renderWithStore(
      <DiscountDialog product={{ ...product, discountPercent: 10, finalPrice: 130500 }} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Quitar descuento' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Porcentaje de descuento/)).toHaveValue(10);
  });

  it('rejects 0 and 91 without calling the API', async () => {
    renderWithStore(<DiscountDialog product={product} onClose={vi.fn()} />);
    const input = screen.getByLabelText(/Porcentaje de descuento/);

    await userEvent.type(input, '91');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ingresa un número entero entre 1 y 90.')).toBeInTheDocument();
    expect(api.setDiscount).not.toHaveBeenCalled();
  });
});
