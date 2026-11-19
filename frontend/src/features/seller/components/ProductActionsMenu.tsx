import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import type { ComponentType, SVGProps } from 'react';
import {
  ImageIcon,
  MoreIcon,
  PencilIcon,
  StockIcon,
  TagIcon,
  TrashIcon,
} from '../../../components/icons';
import { FOCUS_RING } from '../../../components/styles';
import type { Product } from '../../../types/product';

export type ProductAction = 'edit' | 'images' | 'stock' | 'discount' | 'delete';

const ACTIONS: {
  action: ProductAction;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  danger?: boolean;
}[] = [
  { action: 'edit', label: 'Editar', Icon: PencilIcon },
  { action: 'images', label: 'Imágenes', Icon: ImageIcon },
  { action: 'stock', label: 'Ajustar stock', Icon: StockIcon },
  { action: 'discount', label: 'Descuento', Icon: TagIcon },
  { action: 'delete', label: 'Eliminar', Icon: TrashIcon, danger: true },
];

interface ProductActionsMenuProps {
  product: Product;
  onAction: (action: ProductAction, product: Product) => void;
  /** Actions shown; the rest are hidden. */
  available?: readonly ProductAction[];
}

/** "⋯" menu of a product row or card (spec 03 §13.4). Keyboard accessible (Headless UI). */
export function ProductActionsMenu({ product, onAction, available }: ProductActionsMenuProps) {
  const actions = available ? ACTIONS.filter((item) => available.includes(item.action)) : ACTIONS;

  return (
    <Menu>
      <MenuButton
        aria-label={`Acciones de ${product.name}`}
        className={`inline-flex size-11 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-50 data-[open]:bg-navy-50 ${FOCUS_RING}`}
      >
        <MoreIcon className="size-5" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-40 min-w-48 rounded-xl border border-navy-100 bg-white p-1 shadow-lg [--anchor-gap:4px] focus:outline-none"
      >
        {actions.map(({ action, label, Icon, danger }) => (
          <MenuItem key={action}>
            <button
              type="button"
              onClick={() => onAction(action, product)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm data-[focus]:bg-navy-50 ${
                danger ? 'text-red-600' : 'text-ink'
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
