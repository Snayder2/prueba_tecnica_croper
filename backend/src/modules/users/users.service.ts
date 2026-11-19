import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRecord, UserRole } from './schemas/user.schema.js';

export interface PublicUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

/** Whitelists the public fields, so `password` can never leak by accident. */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  /** Throws the raw MongoDB duplicate-key error if the email exists. */
  async create(input: CreateUserInput): Promise<PublicUser> {
    const user = await this.userModel.create({
      email: input.email,
      name: input.name,
      role: input.role,
      password: input.passwordHash,
    });
    return toPublicUser(user.toObject());
  }

  /** Includes the password hash; only for credential checks. */
  findByEmailWithPassword(email: string): Promise<UserRecord | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+password')
      .lean<UserRecord>()
      .exec();
  }

  async findById(id: string): Promise<PublicUser | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const user = await this.userModel.findById(id).lean<UserRecord>().exec();
    return user ? toPublicUser(user) : null;
  }
}
