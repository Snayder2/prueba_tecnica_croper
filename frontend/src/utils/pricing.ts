/**
 * Same formula as the backend (contract §4.4): 2 decimals with halves up,
 * computed in whole cents. Only used for the live preview of the discount
 * dialog; the official value is the finalPrice returned by the backend.
 */
export function calculateFinalPrice(price: number, discountPercent: number): number {
  const priceInCents = Math.round(price * 100);
  return Math.floor((priceInCents * (100 - discountPercent) + 50) / 100) / 100;
}
