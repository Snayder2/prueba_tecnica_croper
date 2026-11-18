import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service.js';
import { AuthService, BCRYPT_ROUNDS } from './auth.service.js';

const JWT_SECRET = 'unit-test-secret';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  const usersService = {
    create: vi.fn(),
    findByEmailWithPassword: vi.fn(),
  };

  const userId = new Types.ObjectId();
  const publicUser = {
    _id: userId,
    email: 'ana@correo.com',
    name: 'Ana Pérez',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const config = { get: vi.fn((key: string) => ({ JWT_EXPIRES_IN: '1h' })[key]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: new JwtService({ secret: JWT_SECRET }) },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('register', () => {
    const dto = { email: 'ana@correo.com', password: 'Clave1234', name: 'Ana Pérez' };

    it('stores a bcrypt hash (never the plain password) and returns the public user', async () => {
      usersService.create.mockResolvedValue(publicUser);

      const result = await service.register(dto);

      const { passwordHash } = usersService.create.mock.calls[0][0] as { passwordHash: string };
      expect(passwordHash).not.toBe(dto.password);
      expect(bcrypt.getRounds(passwordHash)).toBe(BCRYPT_ROUNDS);
      expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
      await expect(bcrypt.compare(dto.password, passwordHash)).resolves.toBe(true);
      expect(result).toEqual(publicUser);
      expect(result).not.toHaveProperty('password');
    });

    it('throws 409 "Email already registered" on a duplicate email', async () => {
      usersService.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('Email already registered'),
      );
    });
  });

  describe('login', () => {
    let storedHash: string;

    beforeAll(async () => {
      // Low cost factor only to keep the test fast; compare works for any cost.
      storedHash = await bcrypt.hash('Clave1234', 4);
    });

    it('returns a signed Bearer token with expiresIn in seconds', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({ ...publicUser, password: storedHash });

      const result = await service.login({ email: 'ana@correo.com', password: 'Clave1234' });

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      const payload = await jwtService.verifyAsync<{ sub: string; email: string }>(
        result.accessToken,
      );
      expect(payload).toMatchObject({ sub: userId.toString(), email: 'ana@correo.com' });
    });

    it('throws a generic 401 when the password is wrong', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({ ...publicUser, password: storedHash });

      await expect(
        service.login({ email: 'ana@correo.com', password: 'Incorrecta1' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('throws the same generic 401 when the email does not exist', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nadie@correo.com', password: 'Clave1234' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });
  });
});
