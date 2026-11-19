import { Field, Label, Switch } from '@headlessui/react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { FOCUS_RING } from '../../../components/styles';
import type { Product } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { showNotification } from '../../ui/uiSlice';
import { toggleActive } from '../sellerProductsSlice';

/** "Visible / Oculto" switch: changes isActive right away (spec 03 §13.4). */
export function VisibilitySwitch({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  const pending = useAppSelector((state) => state.sellerProducts.togglingIds.includes(product._id));

  const onChange = async (isActive: boolean) => {
    try {
      await dispatch(toggleActive({ id: product._id, isActive })).unwrap();
    } catch (error) {
      if (!isAppError(error)) {
        dispatch(showNotification({ type: 'error', message: MESSAGES.unexpected }));
      } else if (!error.handled) {
        dispatch(showNotification({ type: 'error', message: error.message }));
      }
    }
  };

  return (
    <Field className="flex items-center gap-2" disabled={pending}>
      <Switch
        checked={product.isActive}
        onChange={(checked) => void onChange(checked)}
        aria-label={`Visible en el catálogo: ${product.name}`}
        className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-navy-200 transition-colors data-[checked]:bg-leaf-600 data-[disabled]:cursor-wait data-[disabled]:opacity-60 ${FOCUS_RING}`}
      >
        <span className="size-4 translate-x-1 rounded-full bg-white shadow transition-transform group-data-[checked]:translate-x-6" />
      </Switch>
      <Label className="text-xs font-medium text-navy-500">{product.isActive ? 'Visible' : 'Oculto'}</Label>
    </Field>
  );
}
