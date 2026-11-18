import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import type { Product } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { showNotification } from '../../ui/uiSlice';
import { deleteProduct } from '../productsSlice';
import { DialogShell } from './DialogShell';

interface DeleteProductDialogProps {
  product: Product | null;
  onClose: () => void;
}

/** Confirmation before deleting, naming the product (spec §5.2). */
export function DeleteProductDialog({ product, onClose }: DeleteProductDialogProps) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.products.saving);
  // Keeps the name visible while the dialog animates out after `product` becomes null.
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);

  const onConfirm = async () => {
    if (!product) return;
    try {
      await dispatch(deleteProduct(product._id)).unwrap();
    } catch (error) {
      if (!isAppError(error)) {
        dispatch(showNotification({ type: 'error', message: MESSAGES.unexpected }));
      } else if (!error.handled) {
        dispatch(showNotification({ type: 'error', message: error.message }));
      }
    }
    onClose();
  };

  return (
    <DialogShell open={product !== null} title="Eliminar producto" onClose={onClose} busy={saving}>
      <div className="space-y-2 px-5 py-4 text-sm text-ink">
        <p>
          ¿Seguro que quieres eliminar <strong className="font-semibold">«{shown?.name}»</strong>?
        </p>
        <p className="text-navy-400">Esta acción no se puede deshacer.</p>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-navy-100 px-5 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={() => void onConfirm()} loading={saving}>
          Eliminar
        </Button>
      </div>
    </DialogShell>
  );
}
