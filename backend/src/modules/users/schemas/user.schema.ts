import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Only the bcrypt hash is stored, and it is excluded from queries by default.
  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 60 })
  name: string;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

export type UserRecord = User & { _id: Types.ObjectId };

export const UserSchema = SchemaFactory.createForClass(User);

// Safety net: the hash never leaves the database layer through JSON.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as { password?: string }).password;
    return ret;
  },
});
