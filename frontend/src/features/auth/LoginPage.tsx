import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { FOCUS_RING, fieldAria, inputClassName } from '../../components/styles';
import { FormField } from '../../components/FormField';
import type { LoginRequest } from '../../types/auth';
import { isAppError, MESSAGES } from '../../utils/errorMessages';
import { AuthCard, FormAlert } from './AuthCard';
import { clearAuthError, login } from './authSlice';
import { emailRules, passwordRules } from './authValidation';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const submitting = useAppSelector((state) => state.auth.status === 'loading');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginRequest>({ defaultValues: { email: '', password: '' }, mode: 'onTouched' });

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (values: LoginRequest) => {
    setFormError(null);
    try {
      await dispatch(login({ email: values.email.trim(), password: values.password })).unwrap();
      const from = (location.state as { from?: string } | null)?.from ?? '/products';
      void navigate(from, { replace: true });
    } catch (error) {
      if (!isAppError(error)) return setFormError(MESSAGES.unexpected);
      const fields = Object.entries(error.fieldErrors).filter(([field]) => field === 'email' || field === 'password');
      fields.forEach(([field, message]) => setError(field as keyof LoginRequest, { type: 'server', message }));
      if (fields.length === 0) setFormError(error.message);
    }
  };

  return (
    <AuthCard
      title="Inicia sesión"
      subtitle="Ingresa con tu correo para gestionar los productos."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className={`rounded font-medium text-brand-700 hover:underline ${FOCUS_RING}`}>
            Regístrate
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormAlert message={formError} />
        <FormField id="email" label="Correo electrónico" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            className={inputClassName(Boolean(errors.email))}
            {...fieldAria('email', errors.email?.message)}
            {...register('email', emailRules)}
          />
        </FormField>
        <FormField id="password" label="Contraseña" error={errors.password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            className={inputClassName(Boolean(errors.password))}
            {...fieldAria('password', errors.password?.message)}
            {...register('password', passwordRules)}
          />
        </FormField>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthCard>
  );
}
