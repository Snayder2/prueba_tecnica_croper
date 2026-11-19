import { calculateFinalPrice, finalPriceExpression } from './pricing.js';

/**
 * Minimal evaluator for the operators used by finalPriceExpression, with the
 * same double arithmetic MongoDB uses. It lets the unit tests check that the
 * pipeline expression and the JS function are the same formula. The e2e suite
 * checks it again against a real MongoDB.
 */
function evaluate(expression: unknown, doc: Record<string, number>): number {
  if (typeof expression === 'number') return expression;
  if (typeof expression === 'string') return doc[expression.slice(1)];

  const [operator, raw] = Object.entries(expression as Record<string, unknown>)[0];
  const args = (Array.isArray(raw) ? raw : [raw]).map((arg) => evaluate(arg, doc));
  switch (operator) {
    case '$add':
      return args[0] + args[1];
    case '$subtract':
      return args[0] - args[1];
    case '$multiply':
      return args[0] * args[1];
    case '$divide':
      return args[0] / args[1];
    case '$floor':
      return Math.floor(args[0]);
    case '$round':
      // MongoDB rounds halves to even; inputs here never sit exactly on a half.
      return Math.round(args[0]);
    default:
      throw new Error(`Unsupported operator ${operator}`);
  }
}

describe('calculateFinalPrice', () => {
  it('applies 15 % to 145 000 → 123 250 (spec 03 §17)', () => {
    expect(calculateFinalPrice(145000, 15)).toBe(123250);
  });

  it('returns the price itself without discount', () => {
    expect(calculateFinalPrice(32000, 0)).toBe(32000);
    expect(calculateFinalPrice(19.99, 0)).toBe(19.99);
    expect(calculateFinalPrice(0, 50)).toBe(0);
  });

  it('matches the examples of the contract', () => {
    expect(calculateFinalPrice(32000, 10)).toBe(28800);
    expect(calculateFinalPrice(30000, 10)).toBe(27000);
  });

  it('rounds halves up in cents (where $round would round to even)', () => {
    expect(calculateFinalPrice(0.05, 30)).toBe(0.04); // 0.035
    expect(calculateFinalPrice(0.01, 50)).toBe(0.01); // 0.005
    expect(calculateFinalPrice(10.05, 50)).toBe(5.03); // 5.025
  });

  it('never has more than 2 decimals', () => {
    for (const [price, percent] of [
      [99999.99, 33],
      [1234.57, 17],
      [0.07, 90],
    ]) {
      const result = calculateFinalPrice(price, percent);
      expect(Math.round(result * 100) / 100).toBe(result);
    }
  });
});

describe('finalPriceExpression', () => {
  it('gives exactly the same result as calculateFinalPrice', () => {
    const prices = [0, 0.01, 0.05, 0.29, 1, 10.05, 19.99, 1234.57, 32000, 99999.99, 145000];
    for (const price of prices) {
      for (let percent = 0; percent <= 90; percent++) {
        const fromPipeline = evaluate(finalPriceExpression, { price, discountPercent: percent });
        expect(fromPipeline).toBe(calculateFinalPrice(price, percent));
      }
    }
  });
});
