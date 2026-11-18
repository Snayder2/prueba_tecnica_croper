import { ApiProperty } from '@nestjs/swagger';

/** Public user data. `password` is never part of a response. */
export class UserResponseDto {
  @ApiProperty({ description: 'ObjectId del usuario', example: '6739f2a1c4e5b8a9d0f12345' })
  _id: string;

  @ApiProperty({ example: 'ana@correo.com' })
  email: string;

  @ApiProperty({ example: 'Ana Pérez' })
  name: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:30:00.000Z' })
  updatedAt: string;
}
