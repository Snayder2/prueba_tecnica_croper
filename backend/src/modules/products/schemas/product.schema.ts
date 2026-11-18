import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'products', timestamps: true, versionKey: false })
export class Product {
  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 100 })
  name: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: Number, required: true, min: 0 })
  stock: number;

  @Prop({ type: String, trim: true, maxlength: 50 })
  category?: string;

  @Prop({ type: String, required: true, unique: true, trim: true })
  sku: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<Product>;

/** Plain product object as returned by the API. */
export type ProductRecord = Product & { _id: Types.ObjectId };

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ name: 1 });
