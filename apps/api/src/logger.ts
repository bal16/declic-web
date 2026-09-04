import { randomUUID } from 'node:crypto';

import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Structured logging on plain pino (no nestjs-pino: its CJS dist
 * require()s the ESM-only @nestjs/common@12, which Bun refuses).
 * JSON in production, pretty single-line in development, plain JSON
 * (no worker-thread pretty transport) under tests. HTTP request lines
 * (method/url/status/latency) plus per-request id via middleware below —
 * no custom framework magic. Metrics/OTel stay out (PRD-Worker §4.3).
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

const REQUEST_ID_HEADER = 'x-request-id';

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers[REQUEST_ID_HEADER];
  const requestId =
    (Array.isArray(header) ? header[0] : header) ?? randomUUID();
  const start = Date.now();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.on('finish', () => {
    rootLogger.info(
      {
        req: { id: requestId, method: req.method, url: req.url },
        res: { statusCode: res.statusCode },
        responseTime: Date.now() - start,
      },
      'request completed',
    );
  });
  next();
}
