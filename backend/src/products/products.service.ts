import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface.js';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.util.js';
import { buildSearchRegex } from '../common/utils/search-regex.util.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product, ProductRecord } from './schemas/product.schema.js';

const REQUIRED_FIELDS = ['name', 'price', 'stock', 'sku', 'isActive'] as const;

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<Product>) {}

  async create(dto: CreateProductDto): Promise<ProductRecord> {
    try {
      const created = await this.productModel.create(dto);
      return created.toObject();
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedResponse<ProductRecord>> {
    const { page, limit, search, sortBy, order } = query;
    const filter = search ? { name: buildSearchRegex(search) } : {};
    const direction = order === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        // _id as tie-breaker keeps pagination stable when sort values repeat.
        .sort({ [sortBy]: direction, _id: direction })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ProductRecord[]>()
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<ProductRecord> {
    const product = await this.productModel.findById(id).lean<ProductRecord>().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductRecord> {
    const update = this.buildUpdate(dto);
    try {
      const product = await this.productModel
        .findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true })
        .lean<ProductRecord>()
        .exec();
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      return product;
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.productModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Product not found');
    }
  }

  /**
   * Only the fields sent are updated. `null` clears an optional field
   * (description, category) and is rejected for required ones.
   */
  private buildUpdate(dto: UpdateProductDto): UpdateQuery<Product> {
    const nullRequired = REQUIRED_FIELDS.filter((field) => dto[field] === null);
    if (nullRequired.length > 0) {
      throw new BadRequestException(nullRequired.map((field) => `${field} should not be null`));
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ''> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (value === null) $unset[key] = '';
      else $set[key] = value;
    }

    const update: UpdateQuery<Product> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($unset).length > 0) update.$unset = $unset;
    return update;
  }

  private translateError(error: unknown): unknown {
    return isDuplicateKeyError(error) ? new ConflictException('SKU already exists') : error;
  }
}
