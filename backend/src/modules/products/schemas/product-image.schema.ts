import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Product image subdocument (spec 03 §5.2). `key` is internal and never exposed. */
@Schema({ _id: true, versionKey: false })
export class ProductImage {
  /** Storage key of the large image (`<uuid>.webp`); the thumbnail is `<uuid>_thumb.webp`. */
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  url: string;

  @Prop({ type: String, required: true })
  thumbUrl: string;

  @Prop({ type: Number, required: true, min: 1 })
  width: number;

  @Prop({ type: Number, required: true, min: 1 })
  height: number;
}

export type ProductImageRecord = ProductImage & { _id: Types.ObjectId };

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);
