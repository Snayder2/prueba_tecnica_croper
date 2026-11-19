import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { SellerProductsQueryDto } from './dto/seller-products-query.dto.js';
import { ImageProcessingService } from '../images/image-processing.service.js';
import { finalPriceExpression } from './pricing.js';
import { ProductsService } from './products.service.js';
import { Product, WITHOUT_IMAGE_DATA } from './schemas/product.schema.js';

/** Chainable stand-in for a Mongoose query that resolves to `result` on exec(). */
function queryMock<T>(result: T) {
  const query = {
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(),
    populate: vi.fn(),
    select: vi.fn(),
    exec: vi.fn().mockResolvedValue(result),
  };
  for (const method of ['sort', 'skip', 'limit', 'lean', 'populate', 'select'] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}

const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

const seller = { _id: new Types.ObjectId(), name: 'Ana Pérez', email: 'ana@correo.com' };
const storedId = new Types.ObjectId();
const imageId = new Types.ObjectId();
const imageUrl = `http://localhost:3000/api/v1/products/${storedId.toString()}/images/${imageId.toString()}`;
/** As every product query returns it: without the base64 (WITHOUT_IMAGE_DATA). */
const image = {
  _id: imageId,
  mimeType: 'image/webp',
  url: imageUrl,
  thumbUrl: `${imageUrl}/thumb`,
  width: 1200,
  height: 900,
};
const stored = {
  _id: storedId,
  sellerId: seller._id,
  name: 'Café de origen Huila 500 g',
  price: 32000,
  discountPercent: 0,
  finalPrice: 32000,
  stock: 120,
  sku: 'CAF-HUI-500',
  isActive: true,
  images: [image],
  createdAt: new Date(),
  updatedAt: new Date(),
};
const expectedView = {
  _id: stored._id,
  name: stored.name,
  price: 32000,
  discountPercent: 0,
  finalPrice: 32000,
  stock: 120,
  sku: 'CAF-HUI-500',
  isActive: true,
  images: [
    { _id: image._id, url: image.url, thumbUrl: image.thumbUrl, width: 1200, height: 900 },
  ],
  seller: { _id: seller._id, name: 'Ana Pérez' },
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
};

const catalogQuery = (overrides: Partial<CatalogQueryDto> = {}) =>
  Object.assign(new CatalogQueryDto(), overrides);
const sellerQuery = (overrides: Partial<SellerProductsQueryDto> = {}) =>
  Object.assign(new SellerProductsQueryDto(), overrides);

describe('ProductsService', () => {
  let service: ProductsService;
  const model = {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    distinct: vi.fn(),
    exists: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    aggregate: vi.fn(),
  };

  const imageProcessing = { process: vi.fn() };
  const config = { get: (key: string) => ({ PUBLIC_BASE_URL: 'http://cdn.test/' })[key] };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: model },
        { provide: ImageProcessingService, useValue: imageProcessing },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  describe('findCatalog', () => {
    it('lists only active products with defaults (page 1, limit 12, createdAt desc)', async () => {
      const query = queryMock([{ ...stored, sellerId: { _id: seller._id, name: seller.name } }]);
      model.find.mockReturnValue(query);
      model.countDocuments.mockReturnValue(queryMock(30));

      const result = await service.findCatalog(catalogQuery());

      expect(model.find).toHaveBeenCalledWith({ isActive: true });
      expect(query.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
      expect(query.populate).toHaveBeenCalledWith({ path: 'sellerId', select: 'name' });
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(12);
      expect(result).toEqual({
        data: [expectedView],
        meta: { page: 1, limit: 12, total: 30, totalPages: 3 },
      });
    });

    it('never exposes the seller email, sellerId or the image data and MIME type', async () => {
      model.find.mockReturnValue(
        queryMock([{ ...stored, sellerId: { _id: seller._id, name: seller.name } }]),
      );
      model.countDocuments.mockReturnValue(queryMock(1));

      const [product] = (await service.findCatalog(catalogQuery())).data;

      expect(product).not.toHaveProperty('sellerId');
      expect(product.seller).not.toHaveProperty('email');
      expect(Object.keys(product.images[0]).sort()).toEqual([
        '_id',
        'height',
        'thumbUrl',
        'url',
        'width',
      ]);
    });

    it('applies category, price range on finalPrice, onSale and inStock', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      await service.findCatalog(
        catalogQuery({ category: 'Café', minPrice: 1000, maxPrice: 40000, onSale: true, inStock: true }),
      );

      expect(model.find).toHaveBeenCalledWith({
        isActive: true,
        category: 'Café',
        finalPrice: { $gte: 1000, $lte: 40000 },
        discountPercent: { $gt: 0 },
        stock: { $gt: 0 },
      });
    });

    it('does not filter when onSale and inStock are false', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      await service.findCatalog(catalogQuery({ onSale: false, inStock: false, maxPrice: 500 }));

      expect(model.find).toHaveBeenCalledWith({ isActive: true, finalPrice: { $lte: 500 } });
    });

    it('filters by name with a case- and accent-insensitive literal regex', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      await service.findCatalog(catalogQuery({ search: 'cafe' }));

      const filter = model.find.mock.calls[0][0] as { isActive: boolean; name: RegExp };
      expect(filter.isActive).toBe(true);
      expect(filter.name.test('Café de origen')).toBe(true);
      expect(filter.name.test('CAFETERA italiana')).toBe(true);
      expect(filter.name.test('Té verde')).toBe(false);
      expect(model.countDocuments).toHaveBeenCalledWith(filter);
    });
  });

  describe('findCategories', () => {
    it('returns the categories of active products sorted in Spanish', async () => {
      const distinct = { exec: vi.fn().mockResolvedValue(['Semillas', 'café', 'Abonos', 'Árboles']) };
      model.distinct.mockReturnValue(distinct);

      await expect(service.findCategories()).resolves.toEqual(['Abonos', 'Árboles', 'café', 'Semillas']);
      expect(model.distinct).toHaveBeenCalledWith('category', {
        isActive: true,
        category: { $nin: [null, ''] },
      });
    });
  });

  describe('findCatalogProduct', () => {
    it('returns an active product with its seller, without the image data', async () => {
      const query = queryMock({ ...stored, sellerId: { _id: seller._id, name: seller.name } });
      model.findOne.mockReturnValue(query);

      await expect(service.findCatalogProduct(stored._id.toString())).resolves.toEqual(expectedView);
      expect(model.findOne).toHaveBeenCalledWith({ _id: stored._id.toString(), isActive: true });
      expect(query.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
    });

    it('throws 404 "Product not found" when it does not exist or is hidden', async () => {
      model.findOne.mockReturnValue(queryMock(null));
      await expect(service.findCatalogProduct(stored._id.toString())).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('findSellerProducts', () => {
    it("lists only the seller's products, hidden included, sorted as requested", async () => {
      const query = queryMock([stored]);
      model.find.mockReturnValue(query);
      model.countDocuments.mockReturnValue(queryMock(12));

      const result = await service.findSellerProducts(
        seller,
        sellerQuery({ page: 2, limit: 5, sortBy: 'finalPrice', order: 'asc' }),
      );

      expect(model.find).toHaveBeenCalledWith({ sellerId: seller._id });
      expect(query.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
      expect(query.populate).not.toHaveBeenCalled();
      expect(query.sort).toHaveBeenCalledWith({ finalPrice: 1, _id: 1 });
      expect(query.skip).toHaveBeenCalledWith(5);
      expect(result).toEqual({
        data: [expectedView],
        meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
      });
    });

    it('returns totalPages 0 when the seller has no products', async () => {
      model.find.mockReturnValue(queryMock([]));
      model.countDocuments.mockReturnValue(queryMock(0));

      const result = await service.findSellerProducts(seller, sellerQuery());
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });
  });

  describe('findSellerProduct', () => {
    it('filters by _id and sellerId in the same query', async () => {
      const query = queryMock(stored);
      model.findOne.mockReturnValue(query);

      await expect(service.findSellerProduct(stored._id.toString(), seller)).resolves.toEqual(
        expectedView,
      );
      expect(model.findOne).toHaveBeenCalledWith({ _id: stored._id.toString(), sellerId: seller._id });
      expect(query.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
    });

    it("answers 404 for another seller's product", async () => {
      model.findOne.mockReturnValue(queryMock(null));
      await expect(service.findSellerProduct(stored._id.toString(), seller)).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('create', () => {
    const dto = { name: stored.name, price: 32000, stock: 120, sku: 'CAF-HUI-500' };

    it('assigns the seller from the token and starts without discount', async () => {
      model.create.mockResolvedValue({ toObject: () => stored });

      await expect(service.create(dto, seller)).resolves.toEqual(expectedView);
      expect(model.create).toHaveBeenCalledWith({
        ...dto,
        sellerId: seller._id,
        discountPercent: 0,
        finalPrice: 32000,
      });
    });

    it('throws 409 "SKU already exists" on a duplicate sku of the same seller', async () => {
      model.create.mockRejectedValue(duplicateKeyError);

      const promise = service.create(dto, seller);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('SKU already exists');
    });

    it('rethrows unexpected errors unchanged', async () => {
      const failure = new Error('connection lost');
      model.create.mockRejectedValue(failure);

      await expect(service.create(dto, seller)).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    const id = stored._id.toString();

    it('updates only the fields sent and recalculates finalPrice in the same pipeline', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(stored));

      await expect(service.update(id, seller, { price: 30000 })).resolves.toEqual(expectedView);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, sellerId: seller._id },
        [
          { $set: { price: { $literal: 30000 } } },
          { $set: { finalPrice: finalPriceExpression } },
        ],
        { returnDocument: 'after', updatePipeline: true },
      );
    });

    it('wraps values in $literal so text like "$price" is never read as a field path', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(stored));

      await service.update(id, seller, { name: '$price' });

      expect(model.findOneAndUpdate.mock.calls[0][1][0]).toEqual({
        $set: { name: { $literal: '$price' } },
      });
    });

    it('ignores undefined fields and unsets optional fields sent as null', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(stored));

      await service.update(id, seller, {
        name: undefined,
        category: null as unknown as string,
        isActive: false,
      });

      expect(model.findOneAndUpdate.mock.calls[0][1]).toEqual([
        { $set: { isActive: { $literal: false } } },
        { $unset: ['category'] },
        { $set: { finalPrice: finalPriceExpression } },
      ]);
    });

    it('rejects null on required fields with 400', async () => {
      await expect(
        service.update(id, seller, { price: null as unknown as number }),
      ).rejects.toThrow(BadRequestException);
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("throws 404 when the product does not exist or is another seller's", async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      await expect(service.update(id, seller, { name: 'Otro' })).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });

    it('throws 409 when the new sku already exists for this seller', async () => {
      const query = queryMock(null);
      query.exec.mockRejectedValue(duplicateKeyError);
      model.findOneAndUpdate.mockReturnValue(query);

      await expect(service.update(id, seller, { sku: 'TAKEN-1' })).rejects.toThrow(
        new ConflictException('SKU already exists'),
      );
    });
  });

  describe('setDiscount / removeDiscount', () => {
    const id = stored._id.toString();

    it('sets the discount and recalculates finalPrice in the same pipeline', async () => {
      const query = queryMock({ ...stored, price: 145000, discountPercent: 15, finalPrice: 123250 });
      model.findOneAndUpdate.mockReturnValue(query);

      const result = await service.setDiscount(id, seller, 15);

      expect(result).toMatchObject({ discountPercent: 15, finalPrice: 123250 });
      expect(query.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, sellerId: seller._id },
        [{ $set: { discountPercent: 15 } }, { $set: { finalPrice: finalPriceExpression } }],
        { returnDocument: 'after', updatePipeline: true },
      );
    });

    it('removeDiscount sets 0 the same way', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(stored));

      await service.removeDiscount(id, seller);

      expect(model.findOneAndUpdate.mock.calls[0][1]).toEqual([
        { $set: { discountPercent: 0 } },
        { $set: { finalPrice: finalPriceExpression } },
      ]);
    });

    it("throws 404 when the product does not exist or is another seller's", async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      await expect(service.setDiscount(id, seller, 10)).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('addImage', () => {
    const id = stored._id.toString();
    const file = { buffer: Buffer.from('jpeg') } as Express.Multer.File;
    const processed = {
      large: Buffer.from('L'),
      thumbnail: Buffer.from('T'),
      width: 1200,
      height: 800,
    };

    it('processes, stores both versions in base64 and pushes only if there are fewer than 4 images', async () => {
      const current = queryMock({ images: [] });
      model.findOne.mockReturnValue(current);
      imageProcessing.process.mockResolvedValue(processed);
      const pushed = queryMock(null);
      model.findOneAndUpdate.mockImplementation((_filter, update: { $push: { images: object } }) => {
        pushed.exec.mockResolvedValue({ ...stored, images: [update.$push.images] });
        return pushed;
      });

      const result = await service.addImage(id, seller, file);

      expect(imageProcessing.process).toHaveBeenCalledWith(file.buffer);
      expect(current.select).toHaveBeenCalledWith({ 'images._id': 1 });
      const [filter, update, options] = model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ _id: id, sellerId: seller._id, 'images.3': { $exists: false } });
      const newImage = update.$push.images;
      const base = `http://cdn.test/api/v1/products/${id}/images/${newImage._id.toString()}`;
      expect(newImage).toEqual({
        _id: expect.any(Types.ObjectId),
        mimeType: 'image/webp',
        data: processed.large.toString('base64'),
        thumbData: processed.thumbnail.toString('base64'),
        url: base,
        thumbUrl: `${base}/thumb`,
        width: 1200,
        height: 800,
      });
      expect(options).toEqual({ returnDocument: 'after' });
      expect(pushed.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
      expect(result.images[0]).toEqual({
        _id: newImage._id,
        url: base,
        thumbUrl: `${base}/thumb`,
        width: 1200,
        height: 800,
      });
    });

    it('answers 404 before processing when the product is not the seller’s', async () => {
      model.findOne.mockReturnValue(queryMock(null));

      await expect(service.addImage(id, seller, file)).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
      expect(imageProcessing.process).not.toHaveBeenCalled();
    });

    it('answers 409 before processing when there are already 4 images', async () => {
      model.findOne.mockReturnValue(queryMock({ images: Array(4).fill(image) }));

      await expect(service.addImage(id, seller, file)).rejects.toThrow(
        new ConflictException('Image limit reached'),
      );
      expect(imageProcessing.process).not.toHaveBeenCalled();
    });

    it('answers 409 when a concurrent upload took the last slot', async () => {
      model.findOne.mockReturnValue(queryMock({ images: Array(3).fill(image) }));
      imageProcessing.process.mockResolvedValue(processed);
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      model.exists.mockReturnValue(queryMock({ _id: stored._id }));

      await expect(service.addImage(id, seller, file)).rejects.toThrow(
        new ConflictException('Image limit reached'),
      );
    });

    it('answers 404 when the product was deleted during the processing', async () => {
      model.findOne.mockReturnValue(queryMock({ images: [] }));
      imageProcessing.process.mockResolvedValue(processed);
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      model.exists.mockReturnValue(queryMock(null));

      await expect(service.addImage(id, seller, file)).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('deleteImage', () => {
    const id = stored._id.toString();

    it('pulls the image (and its data) filtering by _id, sellerId and image id', async () => {
      model.findOne.mockReturnValue(queryMock({ images: [{ _id: image._id }] }));
      const pulled = queryMock({ ...stored, images: [] });
      model.findOneAndUpdate.mockReturnValue(pulled);

      const result = await service.deleteImage(id, seller, image._id.toString());

      expect(result.images).toEqual([]);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, sellerId: seller._id, 'images._id': image._id },
        { $pull: { images: { _id: image._id } } },
        { returnDocument: 'after' },
      );
      expect(pulled.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
    });

    it('answers 404 "Image not found" for an unknown image', async () => {
      model.findOne.mockReturnValue(queryMock(stored));

      await expect(
        service.deleteImage(id, seller, new Types.ObjectId().toString()),
      ).rejects.toThrow(new NotFoundException('Image not found'));
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('answers 404 "Product not found" for another seller’s product', async () => {
      model.findOne.mockReturnValue(queryMock(null));
      await expect(service.deleteImage(id, seller, image._id.toString())).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('reorderImages', () => {
    const id = stored._id.toString();
    const second = { ...image, _id: new Types.ObjectId() };
    const withTwo = { ...stored, images: [image, second] };

    it('saves the new order inside MongoDB, only if the images did not change meanwhile', async () => {
      const current = queryMock(withTwo);
      model.findOne.mockReturnValue(current);
      const reordered = queryMock({ ...stored, images: [second, image] });
      model.findOneAndUpdate.mockReturnValue(reordered);

      const result = await service.reorderImages(id, seller, [
        second._id.toString(),
        image._id.toString(),
      ]);

      expect(result.images.map((item) => item._id)).toEqual([second._id, image._id]);
      expect(current.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
      // The stored subdocuments (with their data) are rebuilt by an update
      // pipeline, so the base64 never travels to Node.
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: id,
          sellerId: seller._id,
          images: { $size: 2 },
          'images._id': { $all: [image._id, second._id] },
        },
        [
          {
            $set: {
              images: {
                $map: {
                  input: { $literal: [second._id, image._id] },
                  as: 'imageId',
                  in: {
                    $arrayElemAt: [
                      { $filter: { input: '$images', cond: { $eq: ['$$this._id', '$$imageId'] } } },
                      0,
                    ],
                  },
                },
              },
            },
          },
        ],
        { returnDocument: 'after', updatePipeline: true },
      );
      expect(reordered.select).toHaveBeenCalledWith(WITHOUT_IMAGE_DATA);
    });

    it.each([
      ['a missing id', () => [image._id.toString()]],
      ['an unknown id', () => [image._id.toString(), new Types.ObjectId().toString()]],
      ['an empty list', () => []],
    ])('rejects %s with 400', async (_case, ids) => {
      model.findOne.mockReturnValue(queryMock(withTwo));

      await expect(service.reorderImages(id, seller, ids())).rejects.toThrow(BadRequestException);
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('accepts an empty list when the product has no images, without writing', async () => {
      model.findOne.mockReturnValue(queryMock({ ...stored, images: [] }));

      await expect(service.reorderImages(id, seller, [])).resolves.toMatchObject({ images: [] });
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('answers 400 when the images changed between the read and the write', async () => {
      model.findOne.mockReturnValue(queryMock(withTwo));
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      model.exists.mockReturnValue(queryMock({ _id: stored._id }));

      await expect(
        service.reorderImages(id, seller, [second._id.toString(), image._id.toString()]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adjustStock', () => {
    const id = stored._id.toString();

    it('decreases only when there is enough stock, in a single atomic update', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock({ ...stored, stock: 117 }));

      const result = await service.adjustStock(id, seller, { type: 'decrease', quantity: 3 });

      expect(result.stock).toBe(117);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, sellerId: seller._id, stock: { $gte: 3 } },
        { $inc: { stock: -3 } },
        { returnDocument: 'after' },
      );
    });

    it('increases filtering only by _id and sellerId', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock({ ...stored, stock: 125 }));

      await service.adjustStock(id, seller, { type: 'increase', quantity: 5 });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, sellerId: seller._id },
        { $inc: { stock: 5 } },
        { returnDocument: 'after' },
      );
    });

    it('throws 409 "Insufficient stock" when the product exists but the stock is short', async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      model.exists.mockReturnValue(queryMock({ _id: stored._id }));

      await expect(
        service.adjustStock(id, seller, { type: 'decrease', quantity: 500 }),
      ).rejects.toThrow(new ConflictException('Insufficient stock'));
      expect(model.exists).toHaveBeenCalledWith({ _id: id, sellerId: seller._id });
    });

    it("throws 404 when the product does not exist or is another seller's", async () => {
      model.findOneAndUpdate.mockReturnValue(queryMock(null));
      model.exists.mockReturnValue(queryMock(null));

      await expect(
        service.adjustStock(id, seller, { type: 'increase', quantity: 1 }),
      ).rejects.toThrow(new NotFoundException('Product not found'));
    });
  });

  describe('remove', () => {
    it('deletes filtering by _id and sellerId (the images go with the document)', async () => {
      model.deleteOne.mockReturnValue(queryMock({ deletedCount: 1 }));

      await expect(service.remove(stored._id.toString(), seller)).resolves.toBeUndefined();
      expect(model.deleteOne).toHaveBeenCalledWith({
        _id: stored._id.toString(),
        sellerId: seller._id,
      });
    });

    it("throws 404 when the product does not exist or is another seller's", async () => {
      model.deleteOne.mockReturnValue(queryMock({ deletedCount: 0 }));
      await expect(service.remove(stored._id.toString(), seller)).rejects.toThrow(
        new NotFoundException('Product not found'),
      );
    });
  });

  describe('findImageContent', () => {
    const id = stored._id.toString();
    const webp = Buffer.from('RIFF....WEBP');

    it.each([
      ['large', '$images.data'],
      ['thumb', '$images.thumbData'],
    ] as const)('reads only the %s version of an image of an active product', async (variant, field) => {
      model.aggregate.mockReturnValue(
        queryMock([{ mimeType: 'image/webp', data: webp.toString('base64') }]),
      );

      const result = await service.findImageContent(id, image._id.toString(), variant);

      expect(result).toEqual({ mimeType: 'image/webp', buffer: webp });
      expect(model.aggregate).toHaveBeenCalledWith([
        { $match: { _id: stored._id, isActive: true } },
        { $unwind: '$images' },
        { $match: { 'images._id': image._id } },
        { $project: { _id: 0, mimeType: '$images.mimeType', data: field } },
      ]);
    });

    it('answers 404 "Image not found" for a hidden or unknown product, or an unknown image', async () => {
      model.aggregate.mockReturnValue(queryMock([]));

      await expect(service.findImageContent(id, image._id.toString(), 'large')).rejects.toThrow(
        new NotFoundException('Image not found'),
      );
    });
  });
});
