import { Radio, RadioGroup } from '@headlessui/react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { FormField } from '../../../components/FormField';
import { FOCUS_RING, fieldAria, inputClassName } from '../../../components/styles';
import type { StockAdjustmentRequest } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { formatInteger } from '../../../utils/formatters';
import { showNotification } from '../../ui/uiSlice';
import { adjustStock } from '../sellerProductsSlice';
import { DialogShell } from './DialogShell';

const MAX_QUANTITY = 100_000;

interface StockFormValues {
  type: StockAdjustmentRequest['type'];
  quantity: string;
}

const TYPES: { value: StockAdjustmentRequest['type']; label: string }[] = [
  { value: 'increase', label: 'Entrada' },
  { value: 'decrease', label: 'Salida' },
];

interface StockAdjustDialogProps {
  /** Product being adjusted; read from the store so a refreshed stock shows up. */
  productId: string | null;
  onClose: () => void;
}

/**
 * "Ajustar stock" (spec 03 §13.4): Entrada / Salida, quantity and a preview
 * "Stock actual 40 → 45". A decrease above the current stock is not sent; if
 * the backend still answers 409, the error shows here and the stock refreshes.
 */
export function StockAdjustDialog({ productId, onClose }: StockAdjustDialogProps) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.sellerProducts.saving);
  const product = useAppSelector((state) =>
    state.sellerProducts.items.find((item) => item._id === productId),
  );
  const open = productId !== null && product !== undefined;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    trigger,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<StockFormValues>({ defaultValues: { type: 'increase', quantity: '' }, mode: 'onTouched' });

  useEffect(() => {
    if (productId) reset({ type: 'increase', quantity: '' });
  }, [productId, reset]);

  const [type, quantityText] = useWatch({ control, name: ['type', 'quantity'] });
  const quantity = Number(quantityText);
  const stock = product?.stock ?? 0;
  const validQuantity = Number.isInteger(quantity) && quantity >= 1;
  const next = type === 'increase' ? stock + quantity : stock - quantity;

  // A refreshed stock (after a 409) or a type change re-checks the quantity.
  useEffect(() => {
    if (isSubmitted) void trigger('quantity');
  }, [stock, type, isSubmitted, trigger]);

  const onSubmit = async (values: StockFormValues) => {
    if (!productId) return;
    try {
      await dispatch(
        adjustStock({ id: productId, body: { type: values.type, quantity: Number(values.quantity) } }),
      ).unwrap();
      onClose();
    } catch (error) {
      if (!isAppError(error)) {
        dispatch(showNotification({ type: 'error', message: MESSAGES.unexpected }));
      } else if (error.status === 409) {
        setError('quantity', { type: 'server', message: error.message });
      } else if (!error.handled) {
        dispatch(showNotification({ type: 'error', message: error.message }));
        if (error.status === 404) onClose();
      }
    }
  };

  return (
    <DialogShell open={open} title="Ajustar stock" onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-navy-400">{product?.name}</p>

          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onChange={field.onChange}
                aria-label="Tipo de movimiento"
                className="grid grid-cols-2 gap-1 rounded-lg bg-navy-50 p-1"
              >
                {TYPES.map((option) => (
                  <Radio
                    key={option.value}
                    value={option.value}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-navy-500 data-[checked]:bg-white data-[checked]:shadow-sm ${FOCUS_RING}`}
                  >
                    {option.label}
                  </Radio>
                ))}
              </RadioGroup>
            )}
          />

          <FormField id="stock-quantity" label="Cantidad" error={errors.quantity?.message} required>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY}
              step={1}
              className={inputClassName(Boolean(errors.quantity))}
              {...fieldAria('stock-quantity', errors.quantity?.message)}
              {...register('quantity', {
                validate: (value) => {
                  const amount = Number(value);
                  if (value.trim() === '') return 'Ingresa una cantidad.';
                  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_QUANTITY) {
                    return `Ingresa un número entero entre 1 y ${formatInteger(MAX_QUANTITY)}.`;
                  }
                  if (getValues('type') === 'decrease' && amount > stock) {
                    return MESSAGES.insufficientStock;
                  }
                  return true;
                },
              })}
            />
          </FormField>

          <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-500" aria-live="polite">
            Stock actual {formatInteger(stock)}
            {validQuantity && next >= 0 && (
              <>
                {' '}
                → <strong className="font-semibold">{formatInteger(next)}</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-navy-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
