import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from './database/database.service';
import { DeliveryWorker } from './campaigns/delivery.worker';
import { FollowupWorker } from './followups/followup.worker';
import { InboxService } from './inbox/inbox.service';
import { SearchService } from './search/search.service';

@Controller('api/internal/jobs')
export class RuntimeJobsController {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly delivery: DeliveryWorker,
    private readonly inbox: InboxService,
    private readonly followups: FollowupWorker,
    private readonly search: SearchService,
  ) {}

  @Post(':task')
  async run(
    @Param('task') task: string,
    @Headers('authorization') authorization?: string,
  ) {
    const secret = this.config.get<string>('JOBS_SECRET');
    const digest = (value: string) =>
      createHash('sha256').update(value).digest();
    if (
      !secret?.trim() ||
      !timingSafeEqual(digest(authorization ?? ''), digest(`Bearer ${secret}`))
    ) {
      throw new UnauthorizedException();
    }
    const tasks: Record<string, () => Promise<void>> = {
      delivery: () => this.delivery.tick(),
      inbox: () => this.inbox.syncAll(),
      followups: () => this.followups.tick(),
      search: () => this.search.tick(),
    };
    if (!Object.hasOwn(tasks, task))
      throw new BadRequestException('Unknown task.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired',
        // All tasks share a lock so a two-connection pool keeps one worker slot.
        [8152026, 0],
      );
      if (!result.rows[0].acquired) {
        await client.query('COMMIT');
        return { ok: true, skipped: true };
      }
      if (task === 'delivery') {
        // Commit recovery separately so the worker can observe pauses while this lock stays held.
        await this.database.query(
          `UPDATE campaigns SET status='paused',paused_at=now(),updated_at=now(),pause_reason=$1
           WHERE status IN ('scheduled','sending') AND id IN
             (SELECT campaign_id FROM email_deliveries
              WHERE state='sending' AND created_at < now()-interval '10 minutes')`,
          [
            'Lượt gửi quá 10 phút chưa xác định kết quả. Kiểm tra hộp thư đã gửi trước khi tiếp tục để tránh gửi trùng.',
          ],
        );
      }
      await tasks[task]();
      await client.query('COMMIT');
      return { ok: true, skipped: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
