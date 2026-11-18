import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
import { CloseIcon } from '../../../components/icons';

interface DialogShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** While true, Escape/backdrop/X do not close the dialog. */
  busy?: boolean;
  /** Full screen on mobile (forms) or a centered card everywhere (confirmations). */
  fullScreenOnMobile?: boolean;
  children: ReactNode;
}

/** Accessible dialog (focus trap, Escape, aria) from Headless UI, styled with the theme. */
export function DialogShell({
  open,
  title,
  onClose,
  busy = false,
  fullScreenOnMobile = false,
  children,
}: DialogShellProps) {
  const close = () => {
    if (!busy) onClose();
  };

  const panelLayout = fullScreenOnMobile
    ? 'h-full w-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl'
    : 'w-full max-w-md rounded-xl';

  return (
    <Dialog open={open} onClose={close} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-navy-900/50 transition-opacity duration-150 data-closed:opacity-0"
      />
      <div
        className={`fixed inset-0 flex items-center justify-center ${fullScreenOnMobile ? 'md:p-4' : 'p-4'}`}
      >
        <DialogPanel
          transition
          className={`flex flex-col overflow-hidden bg-white shadow-xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 ${panelLayout}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
            <DialogTitle className="text-lg font-semibold text-navy-500">{title}</DialogTitle>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Cerrar"
              className="inline-flex size-11 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
            >
              <CloseIcon />
            </button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
