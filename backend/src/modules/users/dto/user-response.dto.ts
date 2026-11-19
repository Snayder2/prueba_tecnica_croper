import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES, type UserRole } from '../schemas/user.schema.js';

/** Public user data. `password` is never part of a response. */
export class UserResponseDto {
  @ApiProperty({ description: 'ObjectId del usuario', example: '6739f2a1c4e5b8a9d0f12345' })
  _id: string;

  @ApiProperty({ example: 'ana@correo.com' })
  email: string;

  @ApiProperty({ example: 'Ana Pérez' })
  name: string;

  @ApiProperty({ enum: USER_ROLES, description: 'Rol elegido al registrarse', example: 'seller' })
  role: UserRole;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:30:00.000Z' })
  updatedAt: string;
}
