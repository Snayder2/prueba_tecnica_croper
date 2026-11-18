import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT para el header Authorization',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'Vigencia del token en segundos', example: 3600 })
  expiresIn: number;
}
