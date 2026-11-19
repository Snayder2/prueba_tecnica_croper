import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseCatalogQuery, toSearchParams } from './catalogQuery';

const parse = (search: string) => parseCatalogQuery(new URLSearchParams(search));

describe('parseCatalogQuery (spec 03 §13.8)', () => {
  it('applies the defaults of contract §4.6 to an empty URL', () => {
    expect(parse('')).toEqual({
      page: 1,
      limit: 12,
      search: undefined,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      onSale: false,
      inStock: false,
      sortBy: 'createdAt',
      order: 'desc',
    });
  });

  it('reads every filter', () => {
    expect(
      parse('category=Caf%C3%A9&onSale=true&inStock=true&minPrice=1000&maxPrice=40000&sortBy=finalPrice&order=asc&page=2&limit=24&search=%20cafe%20'),
    ).toEqual({
      page: 2,
      limit: 24,
      search: 'cafe',
      category: 'Café',
      minPrice: 1000,
      maxPrice: 40000,
      onSale: true,
      inStock: true,
      sortBy: 'finalPrice',
      order: 'asc',
    });
  });

  it('ignores invalid values instead of breaking (?page=abc → page 1)', () => {
    expect(parse('page=abc&limit=500&sortBy=sku&order=up&minPrice=-5&maxPrice=caro')).toMatchObject({
      page: 1,
      limit: 12,
      sortBy: 'createdAt',
      order: 'desc',
      minPrice: undefined,
      maxPrice: undefined,
    });
    expect(parse('page=0&limit=1.5').page).toBe(1);
  });

  it('only "true" turns a boolean on', () => {
    expect(parse('onSale=false&inStock=1')).toMatchObject({ onSale: false, inStock: false });
  });

  it('drops a minimum price above the maximum', () => {
    expect(parse('minPrice=50000&maxPrice=40000')).toMatchObject({ minPrice: undefined, maxPrice: 40000 });
  });
});

describe('toSearchParams', () => {
  it('leaves out defaults and empty values', () => {
    const params = toSearchParams({ page: 1, limit: 12, onSale: false, sortBy: 'createdAt', order: 'desc', search: '' });
    expect(params.toString()).toBe('');
  });

  it('round-trips a query through the URL', () => {
    const query = parse('category=Caf%C3%A9&onSale=true&maxPrice=40000&sortBy=finalPrice&order=asc&page=2');
    expect(parseCatalogQuery(toSearchParams(query))).toEqual(query);
    expect(toSearchParams(query).get('category')).toBe('Café');
  });
});

describe('activeFilterCount', () => {
  it('counts category, price range, on sale and in stock', () => {
    expect(activeFilterCount(parse(''))).toBe(0);
    expect(activeFilterCount(parse('category=Caf%C3%A9&minPrice=1&maxPrice=9&onSale=true&search=x'))).toBe(3);
  });
});
