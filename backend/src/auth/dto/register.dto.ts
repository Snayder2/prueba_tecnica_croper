import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ description: 'Email (se guarda en minúsculas)', example: 'ana@correo.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mínimo 8 caracteres, con al menos una letra y un número',
    format: 'password',
    minLength: 8,
    pattern: PASSWORD_PATTERN.source,
    example: 'Clave1234',
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, { message: 'password must contain at least one letter and one number' })
  password: string;

  @ApiProperty({ description: 'Nombre del usuario', minLength: 2, maxLength: 60, example: 'Ana Pérez' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  name: string;
}
