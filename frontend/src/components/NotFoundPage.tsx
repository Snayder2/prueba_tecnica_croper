import { Link } from 'react-router';
import { buttonClassName } from './styles';
import { EmptyState } from './EmptyState';
import { BoxIcon } from './icons';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <EmptyState
        icon={<BoxIcon className="size-7" />}
        title="Página no encontrada"
        description="La dirección que buscas no existe o fue movida."
        action={
          <Link to="/products" className={buttonClassName('primary')}>
            Ir a productos
          </Link>
        }
      />
    </main>
  );
}
