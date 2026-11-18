import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { fieldAria, inputClassName } from '../../../components/styles';
import { FormField } from '../../../components/FormField';
import { PriceInput } from '../../../components/PriceInput';
import type { Product } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { formatDate } from '../../../utils/formatters';
import { showNotification } from '../../ui/uiSlice';
import {
  productRules,
  toCreateRequest,
  toFormValues,
  toUpdateRequest,
  type ProductFormValues,
} from '../productForm';
import { createProduct, updateProduct } from '../productsSlice';
import { DialogShell } from './DialogShell';

const FORM_FIELDS = Object.keys(toFormValues(null)) as (keyof ProductFormValues)[];

interface ProductFormDialogProps {
  open: boolean;
  /** null = create, a product = edit (same component for both, spec §5.2). */
  product: Product | null;
  onClose: () => void;
}

export function ProductFormDialog({ open, product, onClose }: ProductFormDialogProps) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.products.saving);
  const isEdit = product !== null;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({ defaultValues: toFormValues(product), mode: 'onTouched' });

  // Every time the dialog opens, load the product being edited (or a blank form).
  useEffect(() => {
    if (open) reset(toFormValues(product));
  }, [open, product, reset]);

  const onSubmit = async (values: ProductFormValues) => {
    try {
      if (product) {
        const changes = toUpdateRequest(product, values);
        if (Object.keys(changes).length === 0) {
          dispatch(showNotification({ type: 'info', message: 'No hay cambios para guardar.' }));
          onClose();
          return;
        }
        await dispatch(updateProduct({ id: product._id, changes })).unwrap();
      } else {
        await dispatch(createProduct(toCreateRequest(values))).unwrap();
      }
      onClose();
    } catch (error) {
      if (!isAppError(error)) {
        dispatch(showNotification({ type: 'error', message: MESSAGES.unexpected }));
        return;
      }
      if (error.handled) return;

      // Backend errors next to their field when possible (400 validation, 409 SKU).
      const fieldEntries = Object.entries(error.fieldErrors).filter(([field]) =>
        FORM_FIELDS.includes(field as keyof ProductFormValues),
      );
      fieldEntries.forEach(([field, message], index) =>
        setError(field as keyof ProductFormValues, { type: 'server', message }, { shouldFocus: index === 0 }),
      );
      if (fieldEntries.length === 0) {
        dispatch(showNotification({ type: 'error', message: error.message }));
      }
      if (error.status === 404) onClose();
    }
  };

  const errorOf = (field: keyof ProductFormValues) => errors[field]?.message;

  return (
    <DialogShell
      open={open}
      title={isEdit ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      busy={saving}
      fullScreenOnMobile
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <FormField id="product-name" label="Nombre" required error={errorOf('name')}>
            <input
              type="text"
              className={inputClassName(Boolean(errorOf('name')))}
              {...fieldAria('product-name', errorOf('name'))}
              {...register('name', productRules.name)}
            />
          </FormField>

          <FormField
            id="product-sku"
            label="SKU"
            required
            error={errorOf('sku')}
            hint="Letras mayúsculas, números y guiones. Ej.: FER-NPK-50"
          >
            <input
              type="text"
              autoCapitalize="characters"
              className={inputClassName(Boolean(errorOf('sku')), 'font-mono uppercase')}
              {...fieldAria('product-sku', errorOf('sku'), 'hint')}
              {...register('sku', productRules.sku)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="product-price"
              label="Precio (COP)"
              required
              error={errorOf('price')}
              hint="Ej.: 1.000 = mil pesos"
            >
              <PriceInput
                hasError={Boolean(errorOf('price'))}
                {...fieldAria('product-price', errorOf('price'), 'hint')}
                {...register('price', productRules.price)}
              />
            </FormField>
            <FormField id="product-stock" label="Stock" required error={errorOf('stock')}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                className={inputClassName(Boolean(errorOf('stock')))}
                {...fieldAria('product-stock', errorOf('stock'))}
                {...register('stock', productRules.stock)}
              />
            </FormField>
          </div>

          <FormField id="product-category" label="Categoría" error={errorOf('category')}>
            <input
              type="text"
              className={inputClassName(Boolean(errorOf('category')))}
              {...fieldAria('product-category', errorOf('category'))}
              {...register('category', productRules.category)}
            />
          </FormField>

          <FormField id="product-description" label="Descripción" error={errorOf('description')}>
            <textarea
              rows={3}
              className={inputClassName(Boolean(errorOf('description')), 'resize-y')}
              {...fieldAria('product-description', errorOf('description'))}
              {...register('description', productRules.description)}
            />
          </FormField>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy-500">
            <input
              type="checkbox"
              className="size-5 rounded accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              {...register('isActive')}
            />
            Producto activo
          </label>

          {product && (
            <p className="text-xs text-navy-400">Última actualización: {formatDate(product.updatedAt)}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-navy-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
