import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Button } from '../../../components/Button';
import { AlertIcon, TrashIcon } from '../../../components/icons';
import { buttonClassName } from '../../../components/styles';
import type { Product } from '../../../types/product';
import { isAppError, MESSAGES } from '../../../utils/errorMessages';
import { MAX_PRODUCT_IMAGES, validateImageFile } from '../../../utils/imageValidation';
import { showNotification } from '../../ui/uiSlice';
import { deleteImage, uploadImage } from '../sellerProductsSlice';
import { DialogShell } from './DialogShell';
import { ImageDropzone } from './ImageDropzone';

interface UploadItem {
  key: string;
  name: string;
  /** 0–100 */
  progress: number;
  status: 'waiting' | 'uploading' | 'error';
  error?: string;
}

interface ProductImagesDialogProps {
  product: Product | null;
  /** Message on top, e.g. right after creating the product. */
  intro?: string | null;
  onClose: () => void;
}

const errorMessage = (error: unknown) => (isAppError(error) ? error.message : MESSAGES.unexpected);

/**
 * "Imágenes" (spec 03 §13.4): current images with "3 de 4" and "Principal"
 * (the first one, in upload order), "Eliminar" (with confirmation) and a drop
 * zone. There is no "Hacer principal": the catalog cards rotate all the
 * images, so choosing a main one is not needed. Files
 * are validated before uploading and uploaded one by one with their own
 * progress bar.
 */
export function ProductImagesDialog({ product, intro, onClose }: ProductImagesDialogProps) {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState<Product | null>(product);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  // Uploads run one after another, even when more files are added meanwhile.
  const queue = useRef<Promise<void>>(Promise.resolve());

  // A new product opens a fresh dialog.
  if (product && product._id !== current?._id) {
    setCurrent(product);
    setUploads([]);
    setRejected([]);
    setConfirmDeleteId(null);
  }

  // The row of the table is the freshest copy (thunks replace or refresh it); a
  // product that is not on the current page (just created) uses the local copy.
  const storeItem = useAppSelector((state) =>
    state.sellerProducts.items.find((item) => item._id === current?._id),
  );
  const shown = storeItem ?? current;
  const images = shown?.images ?? [];
  const inProgress = uploads.filter((item) => item.status !== 'error').length;
  const slotsLeft = MAX_PRODUCT_IMAGES - images.length - inProgress;
  const uploading = inProgress > 0;

  const updateUpload = (key: string, changes: Partial<UploadItem>) =>
    setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const uploadOne = async (productId: string, key: string, file: File) => {
    updateUpload(key, { status: 'uploading' });
    try {
      const updated = await dispatch(
        uploadImage({ id: productId, file, onProgress: (progress) => updateUpload(key, { progress }) }),
      ).unwrap();
      setCurrent(updated);
      setUploads((items) => items.filter((item) => item.key !== key));
    } catch (error) {
      updateUpload(key, { status: 'error', error: errorMessage(error) });
    }
  };

  const onFiles = (files: File[]) => {
    if (!current) return;
    const messages: string[] = [];
    const accepted: UploadItem[] = [];
    let free = slotsLeft;

    files.forEach((file, index) => {
      const validation = validateImageFile(file);
      if (!validation.ok) {
        messages.push(validation.message);
      } else if (free <= 0) {
        messages.push(`${file.name}: ${MESSAGES.imageLimit}`);
      } else {
        free -= 1;
        const key = `${Date.now()}-${index}-${file.name}`;
        accepted.push({ key, name: file.name, progress: 0, status: 'waiting' });
        const productId = current._id;
        queue.current = queue.current.then(() => uploadOne(productId, key, file));
      }
    });

    setRejected(messages);
    setUploads((items) => [...items.filter((item) => item.status !== 'error'), ...accepted]);
  };

  const runImageAction = async (imageId: string, action: () => Promise<Product>) => {
    setBusyImageId(imageId);
    try {
      setCurrent(await action());
    } catch (error) {
      if (!isAppError(error) || !error.handled) {
        dispatch(showNotification({ type: 'error', message: errorMessage(error) }));
      }
    } finally {
      setBusyImageId(null);
      setConfirmDeleteId(null);
    }
  };

  const remove = (imageId: string) =>
    current &&
    runImageAction(imageId, () => dispatch(deleteImage({ id: current._id, imageId })).unwrap());

  const full = images.length >= MAX_PRODUCT_IMAGES;

  return (
    <DialogShell open={product !== null} title="Imágenes" onClose={onClose} busy={uploading} fullScreenOnMobile>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {intro && (
          <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm font-medium text-leaf-700" role="status">
            {intro}
          </p>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-navy-400">{shown?.name}</p>
          <p className="shrink-0 text-sm font-medium text-navy-500" aria-live="polite">
            {images.length} de {MAX_PRODUCT_IMAGES}
          </p>
        </div>

        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Imágenes del producto">
            {images.map((image, index) => (
              <li key={image._id} className="overflow-hidden rounded-xl border border-navy-100 bg-white">
                <div className="relative">
                  <img
                    src={image.thumbUrl}
                    alt={`Imagen ${index + 1} de ${shown?.name ?? 'el producto'}`}
                    width={400}
                    height={400}
                    className="aspect-square w-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute top-2 left-2 rounded-md bg-navy-500 px-2 text-xs font-semibold text-white">
                      Principal
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  {confirmDeleteId === image._id ? (
                    <div className="space-y-1" role="group" aria-label="Confirmar eliminación">
                      <p className="text-xs text-ink">¿Eliminar esta imagen?</p>
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          variant="danger"
                          onClick={() => void remove(image._id)}
                          loading={busyImageId === image._id}
                        >
                          Sí
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(image._id)}
                        disabled={busyImageId !== null}
                        aria-label={`Eliminar la imagen ${index + 1}`}
                        className={buttonClassName('dangerOutline', 'w-full')}
                      >
                        <TrashIcon className="size-4" />
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <ImageDropzone
          onFiles={onFiles}
          disabled={full || slotsLeft <= 0}
          hint={
            full
              ? MESSAGES.imageLimit
              : 'JPG, PNG o WebP, máximo 1 MB cada una. Se suben una por una.'
          }
        />

        {rejected.length > 0 && (
          <ul className="space-y-1" role="alert" aria-label="Archivos rechazados">
            {rejected.map((message) => (
              <li key={message} className="flex items-start gap-2 text-sm text-red-600">
                <AlertIcon className="mt-0.5 size-4 shrink-0" />
                {message}
              </li>
            ))}
          </ul>
        )}

        {uploads.length > 0 && (
          <ul className="space-y-2" aria-label="Subidas">
            {uploads.map((item) => (
              <li key={item.key} className="space-y-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{item.name}</span>
                  <span className={item.status === 'error' ? 'text-red-600' : 'text-navy-400'}>
                    {item.status === 'error'
                      ? item.error
                      : item.status === 'waiting'
                        ? 'En espera'
                        : `${item.progress} %`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Subida de ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="h-2 overflow-hidden rounded-full bg-navy-100"
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${item.status === 'error' ? 'bg-red-600' : 'bg-brand-500'}`}
                    style={{ width: `${item.status === 'error' ? 100 : item.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end border-t border-navy-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose} disabled={uploading}>
          {uploading ? 'Subiendo…' : 'Listo'}
        </Button>
      </div>
    </DialogShell>
  );
}
