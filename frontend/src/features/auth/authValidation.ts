import type { RegisterOptions } from 'react-hook-form';

// Same rules as the backend (contract §4.2), so most errors are caught before sending.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const emailRules = {
  required: 'Ingresa tu correo.',
  pattern: { value: EMAIL_PATTERN, message: 'Ingresa un correo válido.' },
} satisfies RegisterOptions;

export const passwordRules = {
  required: 'Ingresa tu contraseña.',
  minLength: { value: 8, message: 'Debe tener al menos 8 caracteres.' },
  pattern: { value: PASSWORD_PATTERN, message: 'Debe contener al menos una letra y un número.' },
} satisfies RegisterOptions;

export const nameRules = {
  validate: (value: string) => {
    const length = value.trim().length;
    if (length === 0) return 'Ingresa tu nombre.';
    if (length < 2) return 'Debe tener al menos 2 caracteres.';
    if (length > 60) return 'Debe tener máximo 60 caracteres.';
    return true;
  },
} satisfies RegisterOptions;
