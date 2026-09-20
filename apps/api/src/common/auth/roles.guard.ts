import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_ROLE_KEY } from './require-role.decorator';
import { ROLE_MATRIX, type PermissionKey } from './role-matrix';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionKey>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }
    const session = context.switchToHttp().getRequest().session;
    const userRole = session?.user?.role;
    const allowedRoles = ROLE_MATRIX[requiredPermission];
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource.',
      });
    }
    return true;
  }
}
