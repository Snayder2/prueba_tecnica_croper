import { Description, Label, Radio, RadioGroup } from '@headlessui/react';
import { FOCUS_RING } from '../../components/styles';
import type { UserRole } from '../../types/auth';

const OPTIONS: { value: UserRole; title: string; description: string }[] = [
  {
    value: 'buyer',
    title: 'Quiero comprar',
    description: 'Explora el catálogo de todos los vendedores.',
  },
  {
    value: 'seller',
    title: 'Quiero vender',
    description: 'Publica y administra tus productos.',
  },
];

interface RoleSelectorProps {
  value: UserRole | '';
  onChange: (role: UserRole) => void;
  onBlur?: () => void;
  error?: string;
}

/**
 * Two selectable cards (spec 03 §13.2). Required and with no option selected by
 * default, so the choice is a conscious one.
 */
export function RoleSelector({ value, onChange, onBlur, error }: RoleSelectorProps) {
  return (
    <div className="space-y-1">
      <RadioGroup
        value={value || undefined}
        onChange={onChange}
        onBlur={onBlur}
        aria-label="Cómo vas a usar la app"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'role-error' : undefined}
        className="grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            className={`group cursor-pointer rounded-xl border-2 bg-white p-4 transition-colors data-[checked]:border-brand-500 data-[checked]:bg-brand-50 ${
              error ? 'border-red-300' : 'border-navy-100 hover:border-navy-200'
            } ${FOCUS_RING}`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-navy-200 group-data-[checked]:border-brand-600"
              >
                <span className="size-2.5 rounded-full bg-brand-600 opacity-0 group-data-[checked]:opacity-100" />
              </span>
              <div>
                <Label className="block font-semibold text-navy-500">{option.title}</Label>
                <Description className="text-sm text-navy-400">{option.description}</Description>
              </div>
            </div>
          </Radio>
        ))}
      </RadioGroup>
      {error && (
        <p id="role-error" className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
