import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

@Roles('seller')
class SellerOnlyController {
  list() {}

  @Roles('seller', 'buyer')
  shared() {}
}

class OpenController {
  list() {}
}

function contextFor(
  controller: new () => object,
  handler: string,
  user?: { role?: string },
): ExecutionContext {
  const prototype = controller.prototype as Record<string, () => void>;
  return {
    getClass: () => controller,
    getHandler: () => prototype[handler],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows a user whose role is listed on the controller', () => {
    expect(guard.canActivate(contextFor(SellerOnlyController, 'list', { role: 'seller' }))).toBe(true);
  });

  it('rejects another role with 403 "Forbidden"', () => {
    const run = () => guard.canActivate(contextFor(SellerOnlyController, 'list', { role: 'buyer' }));

    expect(run).toThrow(ForbiddenException);
    try {
      run();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        statusCode: 403,
        message: 'Forbidden',
      });
    }
  });

  it('lets a route-level @Roles override the controller one', () => {
    expect(guard.canActivate(contextFor(SellerOnlyController, 'shared', { role: 'buyer' }))).toBe(true);
  });

  it('rejects a request without an authenticated user', () => {
    expect(() => guard.canActivate(contextFor(SellerOnlyController, 'list'))).toThrow(
      ForbiddenException,
    );
  });

  it('does not restrict routes without @Roles', () => {
    expect(guard.canActivate(contextFor(OpenController, 'list', { role: 'buyer' }))).toBe(true);
    expect(guard.canActivate(contextFor(OpenController, 'list'))).toBe(true);
  });
});
