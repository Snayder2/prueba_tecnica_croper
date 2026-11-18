import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { FOCUS_RING, fieldAria, inputClassName } from '../../components/styles';
import { FormField } from '../../components/FormField';
import type { RegisterRequest } from '../../types/auth';
import { isAppError, MESSAGES } from '../../utils/errorMessages';
import { showNotification } from '../ui/uiSlice';
import { AuthCard, FormAlert } from './AuthCard';
import { clearAuthError, login, register as registerUser } from './authSlice';
import { emailRules, nameRules, passwordRules } from './authValidation';

const FIELDS: (keyof RegisterRequest)[] = ['name', 'email', 'password'];

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const submitting = useAppSelector((state) => state.auth.status === 'loading');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterRequest>({
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (values: RegisterRequest) => {
    setFormError(null);
    const data = { name: values.name.trim(), email: values.email.trim(), password: values.password };

    try {
      await dispatch(registerUser(data)).unwrap();
    } catch (error) {
      if (!isAppError(error)) return setFormError(MESSAGES.unexpected);
      const fields = Object.entries(error.fieldErrors).filter(([field]) =>
        FIELDS.includes(field as keyof RegisterRequest),
      );
      fields.forEach(([field, message]) =>
        setError(field as keyof RegisterRequest, { type: 'server', message }),
      );
      if (fields.length === 0) setFormError(error.message);
      return;
    }

    // Account created: start the session right away (spec §5.1).
    try {
      await dispatch(login({ email: data.email, password: data.password })).unwrap();
      dispatch(showNotification({ type: 'success', message: `¡Bienvenido, ${data.name}! Tu cuenta fue creada.` }));
      void navigate('/products', { replace: true });
    } catch {
      dispatch(showNotification({ type: 'success', message: 'Tu cuenta fue creada. Inicia sesión para continuar.' }));
      void navigate('/login', { replace: true });
    }
  };

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Regístrate para empezar a gestionar productos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={`rounded font-medium text-brand-700 hover:underline ${FOCUS_RING}`}>
            Inicia sesión
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormAlert message={formError} />
        <FormField id="name" label="Nombre" error={errors.name?.message}>
          <input
            type="text"
            autoComplete="name"
            className={inputClassName(Boolean(errors.name))}
            {...fieldAria('name', errors.name?.message)}
            {...register('name', nameRules)}
          />
        </FormField>
        <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            className={inputClassName(Boolean(errors.email))}
            {...fieldAria('email', errors.email?.message)}
            {...register('email', emailRules)}
          />
        </FormField>
        <FormField
          id="password"
          label="Contraseña"
          error={errors.password?.message}
          hint="Mínimo 8 caracteres, con al menos una letra y un número."
        >
          <input
            type="password"
            autoComplete="new-password"
            className={inputClassName(Boolean(errors.password))}
            {...fieldAria('password', errors.password?.message, 'Mínimo 8 caracteres')}
            {...register('password', passwordRules)}
          />
        </FormField>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthCard>
  );
}
