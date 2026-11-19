import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types, UpdateWithAggregationPipeline } from 'mongoose';
import { EnvironmentVariables } from '../../config/env.validation.js';
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
import {
  ImageProcessingService,
  PROCESSED_IMAGE_MIME,
} from '../images/image-processing.service.js';
import { ImageVariant, productImageUrls } from './image-urls.js';
import { calculateFinalPrice, finalPriceExpression } from './pricing.js';
import type { ProductImageRecord } from './schemas/product-image.schema.js';
import {
  MAX_PRODUCT_IMAGES,
  Product,
  ProductRecord,
  WITHOUT_IMAGE_DATA,
} from './schemas/product.schema.js';

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

/** Binary of one image version, as served by the public image endpoint. */
export interface ImageContent {
  mimeType: string;
  buffer: Buffer;
}

/**
 * Catalog reads see only active products of every seller. Seller operations
 * always filter by { _id, sellerId } in the same query, so another seller's
 * product simply does not exist for them (404, spec 03 §4).
 */
@Injectable()
export class ProductsService {
  private readonly publicBaseUrl: string;

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly imageProcessing: ImageProcessingService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.publicBaseUrl = config.get('PUBLIC_BASE_URL', { infer: true });
  }

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
      .select(WITHOUT_IMAGE_DATA)
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
      .select(WITHOUT_IMAGE_DATA)
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
      .select(WITHOUT_IMAGE_DATA)
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    // Nothing matched: either the product is not the seller's, or the stock was short.
    const exists = await this.productModel.exists(owned).exec();
    throw exists ? new ConflictException('Insufficient stock') : productNotFound();
  }

  /** Deletes the product; its images live inside the document and go with it. */
  async remove(id: string, seller: SellerSummary): Promise<void> {
    const { deletedCount } = await this.productModel
      .deleteOne({ _id: id, sellerId: seller._id })
      .exec();
    if (deletedCount === 0) {
      throw productNotFound();
    }
  }

  // ---------- Images ----------

  /**
   * Adds one image at the end of `images` (spec 03 §7.3). The product and the
   * image count are checked before the CPU-heavy processing; the conditional
   * $push is what really guarantees the limit when uploads arrive at once.
   * The processed WebP files are stored in base64 inside the product.
   */
  async addImage(
    id: string,
    seller: SellerSummary,
    file: Express.Multer.File,
  ): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel
      .findOne(owned)
      .select({ 'images._id': 1 })
      .lean<Pick<ProductRecord, 'images'>>()
      .exec();
    if (!current) {
      throw productNotFound();
    }
    if (current.images.length >= MAX_PRODUCT_IMAGES) {
      throw imageLimitReached();
    }

    const processed = await this.imageProcessing.process(file.buffer);
    const imageId = new Types.ObjectId();
    const image: ProductImageRecord = {
      _id: imageId,
      mimeType: PROCESSED_IMAGE_MIME,
      data: processed.large.toString('base64'),
      thumbData: processed.thumbnail.toString('base64'),
      ...productImageUrls(this.publicBaseUrl, id, imageId.toString()),
      width: processed.width,
      height: processed.height,
    };

    const product = await this.productModel
      .findOneAndUpdate(
        // No 4th image (index 3) yet → fewer than MAX_PRODUCT_IMAGES (4).
        { ...owned, 'images.3': { $exists: false } },
        { $push: { images: image } },
        { returnDocument: 'after' },
      )
      .select(WITHOUT_IMAGE_DATA)
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    // Another upload filled the last slot (or the product was deleted) meanwhile.
    const exists = await this.productModel.exists(owned).exec();
    throw exists ? imageLimitReached() : productNotFound();
  }

  /** Removes one image (and its data) from the product. */
  async deleteImage(id: string, seller: SellerSummary, imageId: string): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel
      .findOne(owned)
      .select({ 'images._id': 1 })
      .lean<Pick<ProductRecord, 'images'>>()
      .exec();
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
      .select(WITHOUT_IMAGE_DATA)
      .lean<ProductRecord>()
      .exec();
    if (!product) {
      // Deleted by a concurrent request between both queries.
      throw imageNotFound();
    }
    return toProductView(product, seller);
  }

  /**
   * Sets a new order for the current images; the first one becomes the main
   * image. `imageIds` must be exactly the current ids. The update only matches
   * if the images did not change since they were read. The array is rebuilt
   * inside MongoDB (update pipeline), so the base64 data never travels to Node.
   */
  async reorderImages(id: string, seller: SellerSummary, imageIds: string[]): Promise<ProductView> {
    const owned = { _id: id, sellerId: seller._id };
    const current = await this.productModel
      .findOne(owned)
      .select(WITHOUT_IMAGE_DATA)
      .lean<ProductRecord>()
      .exec();
    if (!current) {
      throw productNotFound();
    }

    const currentIds = new Set(current.images.map((image) => image._id.toString()));
    const sameSet =
      imageIds.length === current.images.length &&
      imageIds.every((imageId) => currentIds.has(imageId));
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
        [{ $set: { images: reorderedImagesExpression(imageIds) } }],
        { returnDocument: 'after', updatePipeline: true },
      )
      .select(WITHOUT_IMAGE_DATA)
      .lean<ProductRecord>()
      .exec();
    if (product) {
      return toProductView(product, seller);
    }

    const exists = await this.productModel.exists(owned).exec();
    throw exists ? imageIdsMismatch() : productNotFound();
  }

  // ---------- Public image endpoint ----------

  /**
   * Binary of one image of an active product (spec 03 §7.4). A hidden
   * product, an unknown product or an unknown image all answer 404. Only the
   * requested version is projected, never the whole document.
   */
  async findImageContent(id: string, imageId: string, variant: ImageVariant): Promise<ImageContent> {
    const [image] = await this.productModel
      .aggregate<{ mimeType: string; data: string }>([
        { $match: { _id: new Types.ObjectId(id), isActive: true } },
        { $unwind: '$images' },
        { $match: { 'images._id': new Types.ObjectId(imageId) } },
        {
          $project: {
            _id: 0,
            mimeType: '$images.mimeType',
            data: variant === 'thumb' ? '$images.thumbData' : '$images.data',
          },
        },
      ])
      .exec();
    if (!image) {
      throw imageNotFound();
    }
    return { mimeType: image.mimeType, buffer: Buffer.from(image.data, 'base64') };
  }

  // ---------- Helpers ----------

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
      .select(WITHOUT_IMAGE_DATA)
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
      .select(WITHOUT_IMAGE_DATA)
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

/**
 * `images` in the order of `imageIds`, built from the stored subdocuments
 * (data included) inside the update pipeline. The caller already checked that
 * the ids are exactly the current ones.
 */
function reorderedImagesExpression(imageIds: string[]) {
  return {
    $map: {
      input: { $literal: imageIds.map((imageId) => new Types.ObjectId(imageId)) },
      as: 'imageId',
      in: {
        $arrayElemAt: [
          { $filter: { input: '$images', cond: { $eq: ['$$this._id', '$$imageId'] } } },
          0,
        ],
      },
    },
  };
}
