import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema.js';
import { ProductImage, ProductImageRecord, ProductImageSchema } from './product-image.schema.js';

export const MAX_PRODUCT_IMAGES = 5;
export const MAX_DISCOUNT_PERCENT = 90;

@Schema({ collection: 'products', timestamps: true, versionKey: false })
export class Product {
  /** Owner. Always taken from the token, never from the body (spec 03 §11). */
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  sellerId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 100 })
  name: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  /** 0 = no discount. Changed only through the discount endpoints. */
  @Prop({ type: Number, required: true, min: 0, max: MAX_DISCOUNT_PERCENT, default: 0 })
  discountPercent: number;

  /** Stored so the catalog can filter and sort by it; always computed by the backend. */
  @Prop({ type: Number, required: true, min: 0 })
  finalPrice: number;

  /** Set on create; afterwards it only changes through stock adjustments. */
  @Prop({ type: Number, required: true, min: 0 })
  stock: number;

  @Prop({ type: String, trim: true, maxlength: 50 })
  category?: string;

  /** Unique per seller (compound index below), not globally. */
  @Prop({ type: String, required: true, trim: true })
  sku: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  /** images[0] is the main image. */
  @Prop({
    type: [ProductImageSchema],
    default: [],
    validate: {
      validator: (images: unknown[]) => images.length <= MAX_PRODUCT_IMAGES,
      message: `images must contain at most ${MAX_PRODUCT_IMAGES} elements`,
    },
  })
  images: ProductImage[];

  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<Product>;

/** Plain product object as stored in MongoDB. */
export type ProductRecord = Omit<Product, 'images'> & {
  _id: Types.ObjectId;
  images: ProductImageRecord[];
};

export const ProductSchema = SchemaFactory.createForClass(Product);

// Seller table and SKU uniqueness per seller (two sellers may share a SKU).
ProductSchema.index({ sellerId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ sellerId: 1, createdAt: -1 });
// Catalog: only active products, sorted by date or final price.
ProductSchema.index({ isActive: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, finalPrice: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 1 });
