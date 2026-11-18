import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buttonClassName } from './styles';
import { AlertIcon } from './icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Root fallback for render errors: a friendly screen instead of a blank page (spec §6.4). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div
          role="alert"
          className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-navy-100 bg-white p-8 text-center shadow-sm"
        >
          <div className="rounded-full bg-red-50 p-3 text-red-600">
            <AlertIcon className="size-7" />
          </div>
          <h1 className="text-xl font-semibold text-navy-500">Algo salió mal</h1>
          <p className="text-sm text-navy-400">
            Ocurrió un error inesperado al mostrar la página. Recarga para intentarlo de nuevo.
          </p>
          <button type="button" className={buttonClassName('primary')} onClick={() => window.location.reload()}>
            Recargar la página
          </button>
        </div>
      </main>
    );
  }
}
