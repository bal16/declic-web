import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExamplesModule } from './modules/examples/examples.module';

// Base module: global config + health only.
// Feature modules land here next (PRD-API.md §1.1):
// auth, users, exhibitions, posts/photo-items, curation, moderation,
// engagement, storage, queue, feature-flags, site-settings, audit.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ExamplesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
