import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto.js';

/** Same conversion the global ValidationPipe does (transform: true, no implicit conversion). */
function parse(query: Record<string, string>) {
  const dto = plainToInstance(CatalogQueryDto, query);
  const messages = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).flatMap(
    (error) => Object.values(error.constraints ?? {}),
  );
  return { dto, messages };
}

describe('CatalogQueryDto', () => {
  it('applies the defaults of contract §4.6', () => {
    const { dto, messages } = parse({});
    expect(messages).toEqual([]);
    expect(dto).toMatchObject({
      page: 1,
      limit: 12,
      onSale: false,
      inStock: false,
      sortBy: 'createdAt',
      order: 'desc',
    });
  });

  it('reads "false" as false (implicit conversion would read it as true)', () => {
    const { dto, messages } = parse({ onSale: 'false', inStock: 'false' });
    expect(messages).toEqual([]);
    expect(dto.onSale).toBe(false);
    expect(dto.inStock).toBe(false);
  });

  it('reads "true" as true and any other value as false', () => {
    expect(parse({ onSale: 'true', inStock: 'true' }).dto).toMatchObject({ onSale: true, inStock: true });
    expect(parse({ onSale: 'yes', inStock: '1' }).dto).toMatchObject({ onSale: false, inStock: false });
  });

  it('converts prices to numbers and rejects minPrice > maxPrice', () => {
    const ok = parse({ minPrice: '1000', maxPrice: '40000' });
    expect(ok.messages).toEqual([]);
    expect(ok.dto).toMatchObject({ minPrice: 1000, maxPrice: 40000 });

    expect(parse({ minPrice: '50000', maxPrice: '40000' }).messages).toEqual([
      'minPrice must not be greater than maxPrice',
    ]);
    expect(parse({ minPrice: '40000', maxPrice: '40000' }).messages).toEqual([]);
  });

  it('rejects negative prices, limit above 48 and a category longer than 50', () => {
    const { messages } = parse({ minPrice: '-1', limit: '49', category: 'x'.repeat(51) });
    expect(messages).toEqual(
      expect.arrayContaining([
        'minPrice must not be less than 0',
        'limit must not be greater than 48',
        'category must be shorter than or equal to 50 characters',
      ]),
    );
  });
});
