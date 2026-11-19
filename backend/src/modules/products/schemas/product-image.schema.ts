import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Product image subdocument (spec 03 §5.2). The processed WebP files live
 * here in base64 (`data`, `thumbData`); they are never exposed in the API and
 * every product query excludes them (see WITHOUT_IMAGE_DATA). They are only
 * read by the public image endpoint.
 */
@Schema({ _id: true, versionKey: false })
export class ProductImage {
  /** MIME type of `data` and `thumbData` (always image/webp: the server re-encodes). */
  @Prop({ type: String, required: true })
  mimeType: string;

  /** Large image (max. 1200 px), base64. */
  @Prop({ type: String, required: true, select: false })
  data: string;

  /** Thumbnail (400 × 400 px), base64. */
  @Prop({ type: String, required: true, select: false })
  thumbData: string;

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

/** Image as read by the product queries: without the base64 data. */
export type ProductImageMeta = Omit<ProductImageRecord, 'data' | 'thumbData'>;

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);
