import type { ChangeEvent, ComponentProps } from 'react';
import { formatPriceInput } from '../utils/formatters';
import { inputClassName } from './styles';

interface PriceInputProps extends Omit<ComponentProps<'input'>, 'type' | 'className'> {
  hasError?: boolean;
}

/** Characters the user actually typed (the dots are inserted by the formatter). */
const countSignificant = (text: string) => text.replace(/[^\d,]/g, '').length;

/**
 * Peso amount input: "$" prefix and thousands grouped while typing (1.000 = mil pesos).
 * Works with React Hook Form's `register`: it rewrites the value before calling `onChange`.
 */
export function PriceInput({ hasError = false, onChange, ...props }: PriceInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const caret = input.selectionStart ?? input.value.length;
    const typedBeforeCaret = countSignificant(input.value.slice(0, caret));
    const formatted = formatPriceInput(input.value);

    if (formatted !== input.value) {
      input.value = formatted;
      // Keep the caret after the same digit it was after, despite the added/removed dots.
      let position = 0;
      let seen = 0;
      while (position < formatted.length && seen < typedBeforeCaret) {
        if (/[\d,]/.test(formatted[position])) seen += 1;
        position += 1;
      }
      input.setSelectionRange(position, position);
    }
    onChange?.(event);
  };

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-navy-400"
        aria-hidden="true"
      >
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className={inputClassName(hasError, 'pl-7 tabular-nums')}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}
