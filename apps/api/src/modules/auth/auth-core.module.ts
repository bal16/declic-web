import { Module } from '@nestjs/common';

import { AUTH } from '@/common/auth';

import { createAuth } from './auth';

@Module({
  providers: [{ provide: AUTH, useFactory: () => createAuth() }],
  exports: [AUTH],
})
export class AuthCoreModule {}
