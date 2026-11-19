import { useEffect, useState } from 'react';

/** Time each image stays on a catalog card before the next one (spec 03 §13.5). */
export const CARD_IMAGE_ROTATION_MS = 3000;

/** jsdom and old browsers have no matchMedia: in that case motion is allowed. */
const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Index of the image to show, advancing every `intervalMs` and starting over
 * after the last one. It stays at 0 with fewer than 2 images, while `paused`
 * (pointer or focus on the card) and when the user prefers reduced motion.
 */
export function useRotatingIndex(count: number, paused = false, intervalMs = CARD_IMAGE_ROTATION_MS) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), intervalMs);
    return () => window.clearInterval(timer);
  }, [count, paused, intervalMs]);

  // If the product loses images, never point past the last one.
  return count > 0 ? index % count : 0;
}
