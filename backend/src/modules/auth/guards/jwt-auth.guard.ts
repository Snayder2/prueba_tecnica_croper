import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid `Authorization: Bearer <token>`; otherwise 401 "Unauthorized". */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
