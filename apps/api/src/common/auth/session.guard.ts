import {
  Inject,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';

import type { Auth } from '@/modules/auth/auth';

import { AUTH } from './auth.token';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }
    request.session = session;
    return true;
  }
}
