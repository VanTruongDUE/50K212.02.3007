import { Controller, Get, Header, Param, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('api/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly database: DatabaseService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async confirmation(@Param('token') token: string) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return '<p>Liên kết không hợp lệ.</p>';
    const found = await this.database.query(
      'SELECT 1 FROM contacts WHERE unsubscribe_token=$1',
      [token],
    );
    if (!found.rowCount) return '<p>Liên kết không hợp lệ.</p>';
    return `<main style="font:16px Arial;max-width:32rem;margin:4rem auto"><h1>Ngừng nhận email</h1><p>Bạn có muốn ngừng nhận email từ V5 Marketing?</p><form method="post" action="/api/unsubscribe/${token}"><button type="submit">Xác nhận ngừng nhận</button></form></main>`;
  }

  @Post(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Param('token') token: string) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return '<p>Liên kết không hợp lệ.</p>';
    const result = await this.database.query<
      { email: string } & import('pg').QueryResultRow
    >(
      'UPDATE contacts SET unsubscribed_at=coalesce(unsubscribed_at,now()) WHERE unsubscribe_token=$1 RETURNING email',
      [token],
    );
    if (result.rows[0])
      await this.database.query(
        "INSERT INTO email_suppressions(email,reason) VALUES(lower($1),'unsubscribe') ON CONFLICT(email) DO NOTHING",
        [result.rows[0].email],
      );
    return result.rowCount
      ? '<p>Đã ngừng nhận email. Cảm ơn bạn.</p>'
      : '<p>Liên kết không hợp lệ.</p>';
  }
}
