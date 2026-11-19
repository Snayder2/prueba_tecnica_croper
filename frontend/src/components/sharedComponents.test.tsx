import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProductActionsMenu } from '../features/seller/components/ProductActionsMenu';
import { StockBadge } from '../features/seller/components/StockBadge';
import type { Product } from '../types/product';
import { Pagination } from './Pagination';
import { PriceTag } from './PriceTag';

const product: Product = {
  _id: '6739f3b2c4e5b8a9d0f12346',
  name: 'Café de origen Huila 500 g',
  price: 32000,
  discountPercent: 10,
  finalPrice: 28800,
  stock: 4,
  sku: 'CAF-HUI-500',
  isActive: true,
  images: [],
  seller: { _id: '6739f2a1c4e5b8a9d0f12345', name: 'Ana Pérez' },
  createdAt: '2026-11-17T21:35:00.000Z',
  updatedAt: '2026-11-17T21:35:00.000Z',
};

describe('PriceTag', () => {
  it('shows the final price, the struck list price and the discount badge', () => {
    render(<PriceTag price={32000} finalPrice={28800} discountPercent={10} />);
    expect(screen.getByText(/28\.800/)).toBeInTheDocument();
    expect(screen.getByText(/32\.000/)).toHaveClass('line-through');
    expect(screen.getByText('-10%')).toBeInTheDocument();
  });

  it('without discount shows only the price', () => {
    render(<PriceTag price={32000} finalPrice={32000} discountPercent={0} />);
    expect(screen.getAllByText(/32\.000/)).toHaveLength(1);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});

describe('StockBadge', () => {
  it('flags "Agotado" at 0 and "Stock bajo" up to 5', () => {
    const { rerender, container } = render(<StockBadge stock={0} />);
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    rerender(<StockBadge stock={5} />);
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    rerender(<StockBadge stock={6} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Pagination', () => {
  const meta = { page: 5, limit: 12, total: 120, totalPages: 10 };

  it('shows the range and numbered pages with the current one marked', () => {
    render(
      <Pagination meta={meta} pageSizes={[12, 24, 48]} onPageChange={vi.fn()} onLimitChange={vi.fn()} label="Paginación" />,
    );
    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(nav).getByText('49–60')).toBeInTheDocument();
    const pages = within(nav)
      .getAllByRole('button', { name: /^Página \d+$/ })
      .map((button) => button.textContent);
    expect(pages).toEqual(['1', '4', '5', '6', '10']);
    expect(within(nav).getByRole('button', { name: 'Página 5' })).toHaveAttribute('aria-current', 'page');
  });

  it('changes page and page size', async () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();
    render(
      <Pagination meta={meta} pageSizes={[12, 24, 48]} onPageChange={onPageChange} onLimitChange={onLimitChange} label="Paginación" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Página 6' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await userEvent.selectOptions(screen.getByLabelText('Por página'), '48');
    expect(onPageChange.mock.calls).toEqual([[6], [6]]);
    expect(onLimitChange).toHaveBeenCalledWith(48);
  });
});

describe('ProductActionsMenu', () => {
  it('lists the actions of spec 03 §13.4 and reports the chosen one', async () => {
    const onAction = vi.fn();
    render(<ProductActionsMenu product={product} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: `Acciones de ${product.name}` }));
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Editar', 'Imágenes', 'Ajustar stock', 'Descuento', 'Eliminar']);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Ajustar stock' }));
    expect(onAction).toHaveBeenCalledWith('stock', product);
  });
});
