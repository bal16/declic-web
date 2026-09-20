import { Controller, Get, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

import { Public, RequireRole, RolesGuard, SessionGuard } from '@/common/auth';

import type { Auth } from './auth';

@UseGuards(SessionGuard, RolesGuard)
@Controller('auth-probe')
export class AuthController {
  @Get('ping')
  @Public()
  ping() {
    return 'pong';
  }

  @Get('me')
  async getMe(@Session() session: UserSession<Auth>) {
    return { user: session.user };
  }

  @Get('admin')
  @RequireRole('users:read')
  admin() {
    return 'admin';
  }
}
