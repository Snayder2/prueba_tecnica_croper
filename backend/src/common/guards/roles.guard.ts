import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../../modules/users/schemas/user.schema.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Allows the request only when request.user.role is one of the roles set with
 * @Roles(). Routes without @Roles() are not restricted by role.
 * A wrong role is a 403 "Forbidden" (contract §6.2); a missing user means
 * JwtAuthGuard did not run first, which is also rejected.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<Request & { user?: { role?: UserRole } }>();
    if (!user?.role || !roles.includes(user.role)) {
      // Thrown explicitly: returning false would produce "Forbidden resource".
      throw new ForbiddenException();
    }
    return true;
  }
}
