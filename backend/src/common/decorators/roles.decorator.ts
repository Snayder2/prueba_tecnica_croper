import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../modules/users/schemas/user.schema.js';

export const ROLES_KEY = 'roles';

/**
 * Restricts a controller or a route to the given roles. It is enforced by
 * RolesGuard, which must run after JwtAuthGuard (it reads request.user).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
