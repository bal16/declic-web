import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Base module: global config only. The image-processing consumer
// (@Processor('image-processing')) and BullModule wiring land here next
// (PRD-Worker.md §3.1: @nestjs/bullmq, concurrency 2).
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class WorkerModule {}
