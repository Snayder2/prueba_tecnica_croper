import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { FOCUS_RING, fieldAria, inputClassName } from '../../components/styles';
import { FormField } from '../../components/FormField';
import type { RegisterRequest, UserRole } from '../../types/auth';
import { isAppError, MESSAGES } from '../../utils/errorMessages';
import { showNotification } from '../ui/uiSlice';
import { AuthCard, FormAlert } from './AuthCard';
import { clearAuthError, HOME_PATHS, login, register as registerUser } from './authSlice';
import { emailRules, nameRules, passwordRules } from './authValidation';
import { RoleSelector } from './RoleSelector';

const FIELDS: (keyof RegisterRequest)[] = ['name', 'email', 'password', 'role'];

/** The role starts empty on purpose (spec 03 §13.2). */
type RegisterFormValues = Omit<RegisterRequest, 'role'> & { role: UserRole | '' };

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const submitting = useAppSelector((state) => state.auth.status === 'loading');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: { name: '', email: '', password: '', role: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    if (!values.role) return;
    const data: RegisterRequest = {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      role: values.role,
    };

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
      void navigate(HOME_PATHS[data.role], { replace: true });
    } catch {
      dispatch(showNotification({ type: 'success', message: 'Tu cuenta fue creada. Inicia sesión para continuar.' }));
      void navigate('/login', { replace: true });
    }
  };

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Regístrate para comprar o vender productos del agro."
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
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-navy-500">¿Cómo vas a usar la app?</legend>
          <Controller
            control={control}
            name="role"
            rules={{ required: 'Elige si quieres comprar o vender.' }}
            render={({ field }) => (
              <RoleSelector
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.role?.message}
              />
            )}
          />
        </fieldset>
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
