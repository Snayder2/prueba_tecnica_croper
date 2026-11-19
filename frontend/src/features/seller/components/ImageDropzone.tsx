import { useId, useRef, useState, type DragEvent } from 'react';
import { UploadIcon } from '../../../components/icons';
import { buttonClassName } from '../../../components/styles';
import { IMAGE_ACCEPT } from '../../../utils/imageValidation';

interface ImageDropzoneProps {
  onFiles: (files: File[]) => void;
  /** Disabled when the product already has 4 images. */
  disabled?: boolean;
  /** Text under the zone (limits, or why it is disabled). */
  hint: string;
}

/**
 * Drag & drop zone plus an "Elegir archivos" button (spec 03 §13.4). Several
 * files can be chosen; validating and uploading them is up to the parent.
 */
export function ImageDropzone({ onFiles, disabled = false, hint }: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-disabled={disabled}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        disabled
          ? 'border-navy-100 bg-navy-50 opacity-70'
          : dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-navy-200'
      }`}
    >
      <UploadIcon className="size-8 text-navy-300" />
      <p className="text-sm text-navy-500">
        {disabled ? 'Ya no se pueden agregar más imágenes.' : 'Arrastra tus imágenes aquí o'}
      </p>
      <label htmlFor={inputId} className="sr-only">
        Elegir imágenes del producto
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so choosing the same file again fires onChange.
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={buttonClassName('secondary')}
      >
        Elegir archivos
      </button>
      <p className="text-xs text-navy-400">{hint}</p>
    </div>
  );
}
