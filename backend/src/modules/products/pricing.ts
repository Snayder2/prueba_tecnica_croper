/**
 * Final price with discount (contract §4.4):
 *
 *   finalPrice = floor((round(price × 100) × (100 − discountPercent) + 50) / 100) / 100
 *
 * Rounded to 2 decimals with halves up, computed in integer cents so there are
 * no floating point surprises. The same formula exists twice and both do the
 * exact same operations in the same order, so they always agree:
 * - calculateFinalPrice: in JS (tests, seed data, previews).
 * - finalPriceExpression: as an aggregation expression for update pipelines,
 *   so MongoDB recalculates finalPrice in the same write that changes price or
 *   discountPercent. `$round` is not used for the final rounding because it
 *   rounds halves to even (0.05 with 30 % would give 0.03 instead of 0.04).
 */
export function calculateFinalPrice(price: number, discountPercent: number): number {
  const priceInCents = Math.round(price * 100);
  return Math.floor((priceInCents * (100 - discountPercent) + 50) / 100) / 100;
}

/** calculateFinalPrice(`$price`, `$discountPercent`) as an aggregation expression. */
export const finalPriceExpression = {
  $divide: [
    {
      $floor: {
        $divide: [
          {
            $add: [
              {
                $multiply: [
                  // price has at most 2 decimals, so price × 100 is never exactly at a half.
                  { $round: [{ $multiply: ['$price', 100] }, 0] },
                  { $subtract: [100, '$discountPercent'] },
                ],
              },
              50,
            ],
          },
          100,
        ],
      },
    },
    100,
  ],
} as const;
