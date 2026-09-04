import type { LoggerService } from '@nestjs/common';
import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Same logger shape as apps/api/src/logger.ts (kept inline per app: no
 * shared runtime package exists yet, and pulling server logging into
 * contracts would drag it into the web bundle). No HTTP middleware here —
 * the worker serves no HTTP; per-job structured fields (postId,
 * photoItemId, durationMs, …) attach at the consumer step
 * (PRD-Worker.md §4.3).
 */
export const rootLogger: PinoLogger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  transport:
    !isProd && !isTest
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});

export class PinoNestLogger implements LoggerService {
  constructor(private readonly context = 'Nest') {}

  log(message: unknown, context?: string): void {
    rootLogger.info({ context: context ?? this.context, message });
  }

  error(message: unknown, trace?: string, context?: string): void {
    rootLogger.error({ context: context ?? this.context, trace, message });
  }

  warn(message: unknown, context?: string): void {
    rootLogger.warn({ context: context ?? this.context, message });
  }

  debug(message: unknown, context?: string): void {
    rootLogger.debug({ context: context ?? this.context, message });
  }

  verbose(message: unknown, context?: string): void {
    rootLogger.trace({ context: context ?? this.context, message });
  }
}
