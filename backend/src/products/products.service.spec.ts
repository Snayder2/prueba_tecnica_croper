import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { ProductsService } from './products.service.js';
import { Product } from './schemas/product.schema.js';

/** Chainable stand-in for a Mongoose query that resolves to `result` on exec(). */
function queryMock<T>(result: T) {
  const query = {
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(result),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

const sampleProduct = {
  _id: new Types.ObjectId(),
  name: 'Café de origen Huila 500 g',
  price: 32000,
  stock: 120,
  sku: 'CAF-HUI-500',
  isActive: true,
};

function buildQuery(overrides: Partial<QueryProductsDto> = {}): QueryProductsDto {
  return Object.assign(new QueryProductsDto(), overrides);
}

describe('ProductsService', () => {
  let service: ProductsService;
  const model = {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: getModelToken(Product.name), useValue: model }],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  describe('create', () => {
    it('returns the created product as a plain object', async () => {
      model.create.mockResolvedValue({ toObject: () => sampleProduct });
      const dto = { name: sampleProduct.name, price: 32000, stock: 120, sku: 'CAF-HUI-500' };

      await expect(service.create(dto)).resolves.toEqual(sampleProduct);
      expect(model.create).toHaveBeenCalledWith(dto);
    });

    it('throws 409 "SKU already exists" on a duplicate sku', async () => {
      model.create.mockRejectedValue(duplicateKeyError);

      const promise = service.create({ name: 'Otro', price: 1, stock: 1, sku: 'CAF-HUI-500' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('SKU already exists');
    });

    it('rethrows unexpected errors unchanged', async () => {
      const failure = new Error('connection lost');
      model.create.mockRejectedValue(failure);

      await expect(service.create({ name: 'Otro', price: 1, stock: 1, sku: 'X-1' })).rejects.toBe(
        failure,
      );
    });
  });

  describe('findAll', () => {
    it('applies defaults (page 1, limit 10, createdAt desc) and builds meta', async () => {
      const query = queryMock([sampleProduct]);
      model.find.mockReturnValue(query);
      model.countDocuments.mockReturnValue(queryMock(42));

      const result = await service.findAll(buildQuery());

      expect(model.find).toHaveBeenCalledWith({});
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [sampleProduct],
        meta: { page: 1, limit: 10, total: 42, totalPages: 5 },
      });
    });

    it('skips the previous pages and sorts by the requested field', async () => {
      const query = queryMock([]);
      model.find.mockReturnValue(query);
      model.countDocuments.mockReturnValue(queryMock(12));

      const result = await service.findAll(
        buildQuery({ page: 2, limit: 5, sortBy: 'price', order: 'asc' }),
      );

      expect(query.skip).toHaveBeenCalledWith(5);
      expect(query.limit).toHaveBeenCalledWith(5);
      expect(query.sort).toHaveBeenCalledWith({ price: 1, _id: 1 });
      expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    });

    it('filters by name with a case- and accent-insensitive regex', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      await service.findAll(buildQuery({ search: 'cafe' }));

      const filter = model.find.mock.calls[0][0] as { name: RegExp };
      expect(filter.name).toBeInstanceOf(RegExp);
      expect(filter.name.test('Café de origen')).toBe(true);
      expect(filter.name.test('CAFETERA italiana')).toBe(true);
      expect(filter.name.test('Té verde')).toBe(false);
      expect(model.countDocuments).toHaveBeenCalledWith(filter);
    });

    it('treats regex characters in the search as plain text', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      await service.findAll(buildQuery({ search: '.*' }));

      const filter = model.find.mock.calls[0][0] as { name: RegExp };
      expect(filter.name.test('Cualquier producto')).toBe(false);
      expect(filter.name.test('Producto .* raro')).toBe(true);
    });

    it('returns totalPages 0 when there are no products', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      const result = await service.findAll(buildQuery());
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns the product', async () => {
      model.findById.mockReturnValue(queryMock(sampleProduct));
      await expect(service.findOne(sampleProduct._id.toString())).resolves.toEqual(sampleProduct);
    });

    it('throws 404 "Product not found" when it does not exist', async () => {
      model.findById.mockReturnValue(queryMock(null));
      await expect(service.findOne(new Types.ObjectId().toString())).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('update', () => {
    const id = sampleProduct._id.toString();

    it('sets only the fields sent and returns the updated product', async () => {
      const updated = { ...sampleProduct, price: 30000, stock: 95 };
      model.findByIdAndUpdate.mockReturnValue(queryMock(updated));

      await expect(service.update(id, { price: 30000, stock: 95 })).resolves.toEqual(updated);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { $set: { price: 30000, stock: 95 } },
        { returnDocument: 'after', runValidators: true },
      );
    });

    it('ignores undefined fields and unsets optional fields sent as null', async () => {
      model.findByIdAndUpdate.mockReturnValue(queryMock(sampleProduct));

      await service.update(id, {
        name: undefined,
        category: null as unknown as string,
        stock: 3,
      });

      expect(model.findByIdAndUpdate.mock.calls[0][1]).toEqual({
        $set: { stock: 3 },
        $unset: { category: '' },
      });
    });

    it('rejects null on required fields with 400', async () => {
      await expect(service.update(id, { price: null as unknown as number })).rejects.toThrow(
        BadRequestException,
      );
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws 404 when the product does not exist', async () => {
      model.findByIdAndUpdate.mockReturnValue(queryMock(null));
      await expect(service.update(id, { stock: 1 })).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });

    it('throws 409 when the new sku already exists', async () => {
      const query = queryMock(null);
      query.exec.mockRejectedValue(duplicateKeyError);
      model.findByIdAndUpdate.mockReturnValue(query);

      await expect(service.update(id, { sku: 'TAKEN-1' })).rejects.toThrow(
        new ConflictException('SKU already exists'),
      );
    });
  });

  describe('remove', () => {
    it('deletes the product', async () => {
      model.findByIdAndDelete.mockReturnValue(queryMock(sampleProduct));
      await expect(service.remove(sampleProduct._id.toString())).resolves.toBeUndefined();
    });

    it('throws 404 when the product does not exist', async () => {
      model.findByIdAndDelete.mockReturnValue(queryMock(null));
      await expect(service.remove(sampleProduct._id.toString())).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });
});
