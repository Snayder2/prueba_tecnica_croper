import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPriceInput, parsePriceInput, priceToInput } from './formatters';

describe('formatPriceInput', () => {
  it('groups thousands with dots while typing', () => {
    expect(formatPriceInput('1000')).toBe('1.000');
    expect(formatPriceInput('1450000')).toBe('1.450.000');
    expect(formatPriceInput('1.0000')).toBe('10.000');
  });

  it('keeps a decimal comma with at most 2 decimals', () => {
    expect(formatPriceInput('1500,')).toBe('1.500,');
    expect(formatPriceInput('1500,567')).toBe('1.500,56');
    expect(formatPriceInput(',5')).toBe('0,5');
  });

  it('drops letters and leading zeros', () => {
    expect(formatPriceInput('$ 12a3')).toBe('123');
    expect(formatPriceInput('00450')).toBe('450');
    expect(formatPriceInput('')).toBe('');
  });
});

describe('parsePriceInput', () => {
  it('reads the Colombian format', () => {
    expect(parsePriceInput('1.000')).toBe(1000);
    expect(parsePriceInput('1.500,50')).toBe(1500.5);
    expect(parsePriceInput('0')).toBe(0);
  });

  it('rejects invalid amounts', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('1.00')).toBeNull();
    expect(parsePriceInput('1,234')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
  });
});

describe('priceToInput', () => {
  it('turns a stored price into form text', () => {
    expect(priceToInput(145000)).toBe('145.000');
    expect(priceToInput(1500.5)).toBe('1.500,5');
  });
});

describe('formatCurrency', () => {
  it('shows pesos with thousands separators', () => {
    expect(formatCurrency(1000)).toBe('$ 1.000');
  });
});
