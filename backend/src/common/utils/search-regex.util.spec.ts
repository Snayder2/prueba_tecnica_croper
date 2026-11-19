import { escapeRegExp } from './escape-regexp.js';
import { buildSearchRegex } from './search-regex.util.js';

describe('escapeRegExp', () => {
  it('escapes every regex metacharacter', () => {
    const special = '.*+?^${}()|[]\\/-';
    const regex = new RegExp(`^${escapeRegExp(special)}$`);
    expect(regex.test(special)).toBe(true);
  });

  it('leaves plain text untouched', () => {
    expect(escapeRegExp('Café 500 g')).toBe('Café 500 g');
  });
});

describe('buildSearchRegex', () => {
  it('ignores case and accents', () => {
    const regex = buildSearchRegex('cafe');
    expect(regex.test('Café de origen')).toBe(true);
    expect(regex.test('CAFETERA')).toBe(true);
    expect(regex.test('Té verde')).toBe(false);
  });

  it('matches regex characters literally (".*" does not match everything)', () => {
    const regex = buildSearchRegex('.*');
    expect(regex.test('Cualquier producto')).toBe(false);
    expect(regex.test('Producto .* raro')).toBe(true);
  });

  it('keeps an expensive pattern harmless', () => {
    const regex = buildSearchRegex('(a+)+$');
    const start = performance.now();
    expect(regex.test('a'.repeat(50_000) + '!')).toBe(false);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
