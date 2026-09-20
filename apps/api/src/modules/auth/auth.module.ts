import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

import { AUTH, SessionGuard, RolesGuard } from '@/common/auth';

import { type Auth } from './auth';
import { AuthCoreModule } from './auth-core.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    AuthCoreModule,
    BetterAuthModule.forRootAsync({
      imports: [AuthCoreModule],
      useFactory: (auth: Auth) => ({ auth }),
      inject: [AUTH],
      disableGlobalAuthGuard: true,
    }),
  ],
  controllers: [AuthController],
  providers: [SessionGuard, RolesGuard],
})
export class AuthModule {}
