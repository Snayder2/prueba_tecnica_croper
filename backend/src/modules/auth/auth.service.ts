import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { durationToSeconds } from '../../common/utils/duration.util.js';
import { isDuplicateKeyError } from '../../common/utils/mongo-errors.util.js';
import { EnvironmentVariables } from '../../config/env.validation.js';
import { PublicUser, UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

export const BCRYPT_ROUNDS = 12;

// Compared against when the email does not exist, so both failure paths take
// about the same time and response timing does not reveal registered emails.
// It is the hash of a throwaway string, not a secret.
const DUMMY_HASH = '$2b$12$ascvQDHkfLq0jGehrEJkkeRckAhG.73r4vLhfpMXDlA.jTwK9lLEm';

@Injectable()
export class AuthService {
  private readonly expiresInSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.expiresInSeconds = durationToSeconds(config.get('JWT_EXPIRES_IN', { infer: true }));
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.usersService.create({ email: dto.email, name: dto.name, passwordHash });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordMatches = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);

    // Same generic message whether the email or the password was wrong.
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user._id.toString(), email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.expiresInSeconds,
    };
  }
}
