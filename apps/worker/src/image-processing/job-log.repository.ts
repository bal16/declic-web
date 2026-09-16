import { createDb, jobLogs, type Db } from '@declic/db';
import { Injectable, Optional } from '@nestjs/common';

@Injectable()
export class JobLogsRepository {
  private readonly db: Db;

  constructor(@Optional() db?: Db) {
    this.db = db ?? createDb();
  }

  async logAttempt(params: {
    jobId: string;
    postId: string;
    photoItemId: string;
    attempt: number;
    maxAttempts: number;
    status: 'running' | 'completed' | 'failed_retryable' | 'failed_terminal';
    errorName?: string;
    errorMessage?: string;
    errorStack?: string;
    durationMs?: number;
  }): Promise<void> {
    await this.db.insert(jobLogs).values({
      ...params,
      errorStack: params.errorStack?.slice(0, 2000),
    });
  }
}
