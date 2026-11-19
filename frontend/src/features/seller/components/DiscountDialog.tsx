import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { FormField } from '../../../components/FormField';
import { fieldAria, inputClassName } from '../../../components/styles';
import type { Product } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { calculateFinalPrice } from '../../../utils/pricing';
import { showNotification } from '../../ui/uiSlice';
import { removeDiscount, setDiscount } from '../sellerProductsSlice';
import { DialogShell } from './DialogShell';

interface DiscountFormValues {
  percent: string;
}

const MIN_PERCENT = 1;
const MAX_PERCENT = 90;

function parsePercent(value: string): number | null {
  const percent = Number(value);
  return value.trim() !== '' && Number.isInteger(percent) && percent >= MIN_PERCENT && percent <= MAX_PERCENT
    ? percent
    : null;
}

interface DiscountDialogProps {
  product: Product | null;
  onClose: () => void;
}

/**
 * "Descuento" (spec 03 §13.4): percentage 1–90 with a live preview
 * "$145.000 → $123.250 (-15 %)". The preview is orientative; the official value
 * is the finalPrice returned by the backend.
 */
export function DiscountDialog({ product, onClose }: DiscountDialogProps) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.sellerProducts.saving);
  // Keeps the content while the dialog animates out after `product` becomes null.
  const [shown, setShown] = useState(product);
  if (product && product !== shown) setShown(product);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<DiscountFormValues>({ defaultValues: { percent: '' }, mode: 'onTouched' });

  useEffect(() => {
    if (product) reset({ percent: product.discountPercent > 0 ? String(product.discountPercent) : '' });
  }, [product, reset]);

  const percent = parsePercent(useWatch({ control, name: 'percent' }));

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onClose();
    } catch (error) {
      if (!isAppError(error)) {
        dispatch(showNotification({ type: 'error', message: MESSAGES.unexpected }));
      } else if (!error.handled) {
        dispatch(showNotification({ type: 'error', message: error.message }));
        if (error.status === 404) onClose();
      }
    }
  };

  const onSubmit = (values: DiscountFormValues) =>
    product &&
    run(() => dispatch(setDiscount({ id: product._id, percent: Number(values.percent) })).unwrap());

  const onRemove = () => product && run(() => dispatch(removeDiscount(product._id)).unwrap());

  return (
    <DialogShell open={product !== null} title="Descuento" onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-navy-400">{shown?.name}</p>
          <FormField
            id="discount-percent"
            label="Porcentaje de descuento"
            error={errors.percent?.message}
            hint="Entre 1 y 90 %."
            required
          >
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                step={1}
                className={inputClassName(Boolean(errors.percent), 'pr-10')}
                {...fieldAria('discount-percent', errors.percent?.message, 'Entre 1 y 90 %.')}
                {...register('percent', {
                  validate: (value) =>
                    parsePercent(value) !== null ||
                    `Ingresa un número entero entre ${MIN_PERCENT} y ${MAX_PERCENT}.`,
                })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-navy-400">
                %
              </span>
            </div>
          </FormField>

          {shown && (
            <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-500" aria-live="polite">
              {percent === null ? (
                <>Precio actual {formatCurrency(shown.finalPrice)}</>
              ) : (
                <>
                  {formatCurrency(shown.price)} →{' '}
                  <strong className="font-semibold">
                    {formatCurrency(calculateFinalPrice(shown.price, percent))}
                  </strong>{' '}
                  (-{formatPercent(percent)})
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-navy-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {shown && shown.discountPercent > 0 && (
            <Button variant="dangerOutline" onClick={() => void onRemove()} disabled={saving}>
              Quitar descuento
            </Button>
          )}
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
