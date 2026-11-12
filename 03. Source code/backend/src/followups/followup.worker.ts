import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { afterBusinessDays } from './business-days';

type Awaiting = QueryResultRow & {
  id: string;
  response_id: string;
  assignee_id: string;
  attempt: number;
  channel: string;
  goal: string;
  reminder_minutes: number;
  wait_days: number;
  max_attempts: number;
  interval_days: number;
  completed_at: Date;
  needs_next: boolean;
};

@Injectable()
export class FollowupWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(FollowupWorker.name);

  constructor(private readonly database: DatabaseService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.database.query<{ id: string } & QueryResultRow>(
        `SELECT f.id FROM followups f JOIN responses r ON r.id=f.response_id
         WHERE f.status='done' AND f.outcome='awaiting' AND f.completed_at IS NOT NULL
           AND (f.completed_at + f.wait_days * interval '1 day' <= now()
             OR EXISTS (SELECT 1 FROM responses incoming
               WHERE lower(incoming.email)=lower(r.email) AND incoming.id<>r.id
                 AND incoming.received_at>f.completed_at
                 AND incoming.received_at<=f.completed_at + f.wait_days * interval '1 day'
                 AND incoming.kind NOT IN ('spam','bounce','unsubscribe')))
         ORDER BY f.completed_at LIMIT 100`,
      );
      for (const row of due.rows) await this.resolve(row.id);
    } catch {
      this.logger.warn(
        'Chưa thể cập nhật kết quả Follow-up; sẽ thử lại ở lượt sau.',
      );
    } finally {
      this.running = false;
    }
  }

  private async resolve(id: string) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<Awaiting>(
        "SELECT * FROM followups WHERE id=$1 AND status='done' AND outcome='awaiting' FOR UPDATE",
        [id],
      );
      const item = result.rows[0];
      if (!item) {
        await client.query('COMMIT');
        return;
      }
      const response = await client.query<
        { email: string; kind: string; status: string } & QueryResultRow
      >('SELECT email,kind,status FROM responses WHERE id=$1 FOR UPDATE', [
        item.response_id,
      ]);
      const incoming = await client.query(
        `SELECT 1 FROM responses WHERE lower(email)=lower($1) AND id<>$2
         AND received_at>$3 AND received_at<=$3::timestamptz + $4 * interval '1 day'
         AND kind NOT IN ('spam','bounce','unsubscribe') LIMIT 1`,
        [
          response.rows[0].email,
          item.response_id,
          item.completed_at,
          item.wait_days,
        ],
      );
      if (
        !incoming.rowCount &&
        item.completed_at.getTime() + item.wait_days * 86_400_000 > Date.now()
      ) {
        await client.query('COMMIT');
        return;
      }
      await client.query('UPDATE followups SET outcome=$2 WHERE id=$1', [
        id,
        incoming.rowCount ? 'responded' : 'no_response',
      ]);
      if (
        !incoming.rowCount &&
        item.attempt < item.max_attempts &&
        item.needs_next &&
        response.rows[0].status !== 'closed' &&
        !['unsubscribe', 'spam', 'bounce'].includes(response.rows[0].kind)
      ) {
        await client.query(
          `INSERT INTO followups(response_id,assignee_id,due_at,attempt,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
          [
            item.response_id,
            item.assignee_id,
            afterBusinessDays(new Date(), item.interval_days),
            item.attempt + 1,
            item.channel,
            item.goal,
            item.reminder_minutes,
            item.wait_days,
            item.max_attempts,
            item.interval_days,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
