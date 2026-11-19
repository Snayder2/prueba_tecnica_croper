import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types, UpdateWithAggregationPipeline } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface.js';
import { isDuplicateKeyError } from '../../common/utils/mongo-errors.util.js';
import { buildSearchRegex } from '../../common/utils/search-regex.util.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { SellerProductsQueryDto } from './dto/seller-products-query.dto.js';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  ProductView,
  ProductWithSeller,
  SellerSummary,
  toProductView,
  toProductViewWithSeller,
} from './product-view.js';
import { ImageProcessingService } from '../images/image-processing.service.js';
import { StorageService } from '../storage/storage.service.js';
import { calculateFinalPrice, finalPriceExpression } from './pricing.js';
import type { ProductImageRecord } from './schemas/product-image.schema.js';
import { MAX_PRODUCT_IMAGES, Product, ProductRecord } from './schemas/product.schema.js';

const REQUIRED_FIELDS = ['name', 'price', 'sku', 'isActive'] as const;

const SPANISH_COLLATOR = new Intl.Collator('es', { sensitivity: 'base' });

/** Only the seller's public name is read when populating (never the email). */
const SELLER_POPULATE = { path: 'sellerId', select: 'name' };

interface ListOptions {
  page: number;
  limit: number;
  sortBy: string;
  order: 'asc' | 'desc';
}

export const productNotFound = () => new NotFoundException('Product not found');
const imageNotFound = () => new NotFoundException('Image not found');
const imageLimitReached = () => new ConflictException('Image limit reached');
const imageIdsMismatch = () =>
  new BadRequestException(['imageIds must contain exactly the current image ids']);

/** `<uuid>.webp` → `<uuid>_thumb.webp`. Only the large image key is stored. */
export const thumbnailKey = (key: string) => key.replace(/\.webp$/, '_thumb.webp');

/**
 * Catalog reads see only active products of every seller. Seller operations
 * always filter by { _id, sellerId } in the same query, so another seller's
 * product simply does not exist for them (404, spec 03 §4).
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly storage: StorageService,
    private readonly imageProcessing: ImageProcessingService,
  ) {}

  // ---------- Catalog ----------

  async findCatalog(query: CatalogQueryDto): Promise<PaginatedResponse<ProductView>> {
    const filter = this.buildCatalogFilter(query);
    const { items, meta } = await this.paginate<ProductWithSeller>(filter, query, true);
    return { data: items.map(toProductViewWithSeller), meta };
  }

  /** Distinct categories of active products, sorted in Spanish (case and accents ignored). */
  async findCategories(): Promise<string[]> {
    const categories: unknown[] = await this.productModel
      .distinct('category', { isActive: true, category: { $nin: [null, ''] } })
      .exec();
    return categories
      .filter((category): category is string => typeof category === 'string')
      .sort(SPANISH_COLLATOR.compare);
  }

  async findCatalogProduct(id: string): Promise<ProductView> {
    const product = await this.productModel
      .findOne({ _id: id, isActive: true })
      .populate(SELLER_POPULATE)
      .lean<ProductWithSeller>()
      .exec();
    if (!product) {
      throw productNotFound();
    }
    return toProductViewWithSeller(product);
  }

  // ---------- Seller (only their own products) ----------

  async findSellerProducts(
    seller: SellerSummary,
    query: SellerProductsQueryDto,
  ): Promise<PaginatedResponse<ProductView>> {
    const filter: QueryFilter<Product> = { sellerId: seller._id };
    if (query.search) {
      filter.name = buildSearchRegex(query.search);
    }

    const { items, meta } = await this.paginate<ProductRecord>(filter, query, false);
    return { data: items.map((product) => toProductView(product, seller)), meta };
  }

  async findSellerProduct(id: string, seller: SellerSummary): Promise<ProductView> {
    const product = await this.productModel
      .findOne({ _id: id, sellerId: seller._id })
      .lean<ProductRecord>()
      .exec();
    if (!product) {
      throw productNotFound();
    }
    return toProductView(product, seller);
  }

  /** New products start without discount, so finalPrice equals price. */
  async create(dto: CreateProductDto, seller: SellerSummary): Promise<ProductView> {
    try {
      const created = await this.productModel.create({
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        category: dto.category,
        sku: dto.sku,
        isActive: dto.isActive,
        sellerId: seller._id,
        discountPercent: 0,
        finalPrice: calculateFinalPrice(dto.price, 0),
      });
      return toProductView(created.toObject<ProductRecord>(), seller);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /** finalPrice is recalculated in the same write, so it can never get out of sync with price. */
  async update(id: string, seller: SellerSummary, dto: UpdateProductDto): Promise<ProductView> {
    const pipeline = this.buildUpdatePipeline(dto);
    try {
      return await this.updateWithPipeline(id, seller, pipeline);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /** Sets the discount and recalculates finalPrice in the same operation (spec 03 §9). */
  setDiscount(id: string, seller: SellerSummary, percent: number): Promise<ProductView> {
    return this.updateWithPipeline(id, seller, [
      { $set: { discountPercent: percent } },
      { $set: { finalPrice: finalPriceExpression } },
    ]);
  }

  /** Back to discountPercent 0 and finalPrice = price. Idempotent. */
  removeDiscount(id: string, seller: SellerSummary): Promise<ProductView> {
    return this.setDiscount(id, seller, 0);
  }

  /**
   * Atomic stock movement (spec 03 §8). A decrease only matches when there is
   * enough stock, so concurrent decreases can never leave it negative.
   */
  async adjustStock(
    id: string,
    seller: SellerSummary,
    { type, quantity }: StockAdjustmentDto,
  ): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const filter = type === 'decrease' ? { ...owned, stock: { $gte: quantity } } : owned;
    const delta = type === 'decrease' ? -quantity : quantity;

    const product = await this.productModel
      .findOneAndUpdate(filter, { $inc: { stock: delta } }, { returnDocument: 'after' })
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    // Nothing matched: either the product is not the seller's, or the stock was short.
    const exists = await this.productModel.exists(owned).exec();
    throw exists ? new ConflictException('Insufficient stock') : productNotFound();
  }

  /** Deletes the product and then its image files (spec 03 §7.5). */
  async remove(id: string, seller: SellerSummary): Promise<void> {
    const deleted = await this.productModel
      .findOneAndDelete({ _id: id, sellerId: seller._id })
      .lean<ProductRecord>()
      .exec();
    if (!deleted) {
      throw productNotFound();
    }
    await this.deleteImageFiles(deleted.images);
  }

  // ---------- Images ----------

  /**
   * Adds one image at the end of `images` (spec 03 §7.3). The product and the
   * image count are checked before the CPU-heavy processing; the conditional
   * $push is what really guarantees the limit when uploads arrive at once.
   */
  async addImage(
    id: string,
    seller: SellerSummary,
    file: Express.Multer.File,
  ): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel.findOne(owned).select('images').lean<ProductRecord>().exec();
    if (!current) {
      throw productNotFound();
    }
    if (current.images.length >= MAX_PRODUCT_IMAGES) {
      throw imageLimitReached();
    }

    const processed = await this.imageProcessing.process(file.buffer);
    const key = `${randomUUID()}.webp`;
    const image: ProductImageRecord = {
      _id: new Types.ObjectId(),
      key,
      url: this.storage.getPublicUrl(key),
      thumbUrl: this.storage.getPublicUrl(thumbnailKey(key)),
      width: processed.width,
      height: processed.height,
    };
    await this.storage.save(key, processed.large);
    try {
      await this.storage.save(thumbnailKey(key), processed.thumbnail);
    } catch (error) {
      await this.deleteImageFiles([image]);
      throw error;
    }

    const product = await this.productModel
      .findOneAndUpdate(
        // No 5th image (index 4) yet → fewer than MAX_PRODUCT_IMAGES (5).
        { ...owned, 'images.4': { $exists: false } },
        { $push: { images: image } },
        { returnDocument: 'after' },
      )
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    // Another upload filled the last slot (or the product was deleted) meanwhile.
    await this.deleteImageFiles([image]);
    const exists = await this.productModel.exists(owned).exec();
    throw exists ? imageLimitReached() : productNotFound();
  }

  /** Removes one image from the product, then its files. */
  async deleteImage(id: string, seller: SellerSummary, imageId: string): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel.findOne(owned).select('images').lean<ProductRecord>().exec();
    if (!current) {
      throw productNotFound();
    }
    const image = current.images.find((item) => item._id.toString() === imageId);
    if (!image) {
      throw imageNotFound();
    }

    const product = await this.productModel
      .findOneAndUpdate(
        { ...owned, 'images._id': image._id },
        { $pull: { images: { _id: image._id } } },
        { returnDocument: 'after' },
      )
      .lean<ProductRecord>()
      .exec();
    if (!product) {
      // Deleted by a concurrent request between both queries.
      throw imageNotFound();
    }
    await this.deleteImageFiles([image]);
    return toProductView(product, seller);
  }

  /**
   * Sets a new order for the current images; the first one becomes the main
   * image. `imageIds` must be exactly the current ids. The update only matches
   * if the images did not change since they were read.
   */
  async reorderImages(id: string, seller: SellerSummary, imageIds: string[]): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel.findOne(owned).lean<ProductRecord>().exec();
    if (!current) {
      throw productNotFound();
    }

    const byId = new Map(current.images.map((image) => [image._id.toString(), image]));
    const sameSet =
      imageIds.length === current.images.length && imageIds.every((imageId) => byId.has(imageId));
    if (!sameSet) {
      throw imageIdsMismatch();
    }
    if (imageIds.length === 0) {
      return toProductView(current, seller);
    }

    const product = await this.productModel
      .findOneAndUpdate(
        {
          ...owned,
          images: { $size: imageIds.length },
          'images._id': { $all: current.images.map((image) => image._id) },
        },
        { $set: { images: imageIds.map((imageId) => byId.get(imageId)) } },
        { returnDocument: 'after' },
      )
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    const exists = await this.productModel.exists(owned).exec();
    throw exists ? imageIdsMismatch() : productNotFound();
  }

  // ---------- Helpers ----------

  /**
   * The database is updated first and the files are removed afterwards. A file
   * that cannot be removed is only logged: an orphan file is better than a
   * product pointing to a missing image (spec 03 §7.5).
   */
  private async deleteImageFiles(images: Pick<ProductImageRecord, 'key'>[]): Promise<void> {
    const keys = images.flatMap((image) => [image.key, thumbnailKey(image.key)]);
    const results = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(`Could not delete image file ${keys[index]}: ${String(result.reason)}`);
      }
    });
  }

  /** Catalog filters (contract §4.6). Prices apply to finalPrice. */
  private buildCatalogFilter(query: CatalogQueryDto): QueryFilter<Product> {
    const filter: QueryFilter<Product> = { isActive: true };
    if (query.search) {
      filter.name = buildSearchRegex(query.search);
    }
    if (query.category !== undefined) {
      filter.category = query.category;
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.finalPrice = {
        ...(query.minPrice !== undefined && { $gte: query.minPrice }),
        ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
      };
    }
    if (query.onSale) {
      filter.discountPercent = { $gt: 0 };
    }
    if (query.inStock) {
      filter.stock = { $gt: 0 };
    }
    return filter;
  }

  private async paginate<T>(
    filter: QueryFilter<Product>,
    { page, limit, sortBy, order }: ListOptions,
    populateSeller: boolean,
  ): Promise<{ items: T[]; meta: PaginatedResponse<T>['meta'] }> {
    const direction = order === 'asc' ? 1 : -1;
    const query = this.productModel
      .find(filter)
      // _id as tie-breaker keeps pagination stable when sort values repeat.
      .sort({ [sortBy]: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit);
    if (populateSeller) {
      query.populate(SELLER_POPULATE);
    }

    const [items, total] = await Promise.all([
      query.lean<T[]>().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Runs an update pipeline on one of the seller's products. A fresh array must
   * be passed each time: Mongoose appends the updatedAt stage to it.
   */
  private async updateWithPipeline(
    id: string,
    seller: SellerSummary,
    pipeline: UpdateWithAggregationPipeline,
  ): Promise<ProductView> {
    const product = await this.productModel
      .findOneAndUpdate({ _id: id, sellerId: seller._id }, pipeline, {
        returnDocument: 'after',
        updatePipeline: true,
      })
      .lean<ProductRecord>()
      .exec();
    if (!product) {
      throw productNotFound();
    }
    return toProductView(product, seller);
  }

  /**
   * PATCH as an update pipeline: only the fields sent are set, `null` clears an
   * optional field (description, category) and is rejected for required ones,
   * and the last stage recalculates finalPrice from the resulting price.
   * Values are wrapped in $literal: inside a pipeline a string such as "$price"
   * would otherwise be read as a field path.
   */
  private buildUpdatePipeline(dto: UpdateProductDto): UpdateWithAggregationPipeline {
    const nullRequired = REQUIRED_FIELDS.filter((field) => dto[field] === null);
    if (nullRequired.length > 0) {
      throw new BadRequestException(nullRequired.map((field) => `${field} should not be null`));
    }

    const set: Record<string, unknown> = {};
    const unset: string[] = [];
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (value === null) unset.push(key);
      else set[key] = { $literal: value };
    }

    const pipeline: UpdateWithAggregationPipeline = [];
    if (Object.keys(set).length > 0) pipeline.push({ $set: set });
    if (unset.length > 0) pipeline.push({ $unset: unset });
    pipeline.push({ $set: { finalPrice: finalPriceExpression } });
    return pipeline;
  }

  private translateError(error: unknown): unknown {
    return isDuplicateKeyError(error) ? new ConflictException('SKU already exists') : error;
  }
}
