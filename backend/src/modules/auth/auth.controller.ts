import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import type { PublicUser } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const TOO_MANY = { summary: 'Demasiadas peticiones', message: 'Too many requests' };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar un usuario',
    description: 'Registro abierto. La respuesta nunca incluye la contraseña.',
  })
  @ApiCreatedResponse({ description: 'Usuario creado', type: UserResponseDto })
  @ApiErrorResponse(400, 'Datos inválidos', '/api/v1/auth/register', {
    summary: 'Datos inválidos',
    message: [
      'email must be an email',
      'password must contain at least one letter and one number',
      'role must be one of the following values: seller, buyer',
    ],
  })
  @ApiErrorResponse(409, 'El email ya está registrado', '/api/v1/auth/register', {
    summary: 'Email duplicado',
    message: 'Email already registered',
  })
  @ApiErrorResponse(429, 'Límite global de peticiones superado', '/api/v1/auth/register', TOO_MANY)
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Stricter than the global limit: 5 attempts per minute per IP (brute force).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Devuelve el JWT. Cópialo en **Authorize** para probar los endpoints protegidos. ' +
      'Límite: 5 intentos por minuto por IP.',
  })
  @ApiOkResponse({ description: 'Credenciales válidas', type: LoginResponseDto })
  @ApiErrorResponse(400, 'Datos inválidos', '/api/v1/auth/login', {
    summary: 'Datos inválidos',
    message: ['email must be an email'],
  })
  @ApiErrorResponse(401, 'Email o contraseña incorrectos (mensaje genérico)', '/api/v1/auth/login', {
    summary: 'Credenciales incorrectas',
    message: 'Invalid credentials',
  })
  @ApiErrorResponse(429, 'Más de 5 intentos por minuto', '/api/v1/auth/login', TOO_MANY)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado' })
  @ApiOkResponse({ description: 'Usuario del token', type: UserResponseDto })
  @ApiErrorResponse(401, 'Sin token, token inválido o expirado', '/api/v1/auth/me', {
    summary: 'No autenticado',
    message: 'Unauthorized',
  })
  @ApiErrorResponse(429, 'Límite global de peticiones superado', '/api/v1/auth/me', TOO_MANY)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
