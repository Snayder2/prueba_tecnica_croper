import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no ResizeObserver; Headless UI uses it to position anchored menus.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Vitest runs without globals, so Testing Library cannot unmount by itself.
afterEach(() => {
  cleanup();
});
