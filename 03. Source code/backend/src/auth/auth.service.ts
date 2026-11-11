import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { verifyPassword } from './password';

export type Account = {
  id: string;
  email: string;
  role: 'employee' | 'manager';
};
type AccountRow = QueryResultRow & Account & { password_hash: string };

const sessionDurationHours = 8;
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; account: Account }> {
    const result = await this.database.query<AccountRow>(
      `SELECT e.id, e.email, a.role, a.password_hash
       FROM employees e JOIN login_accounts a ON a.employee_id = e.id
       WHERE lower(e.email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    if (!(await verifyPassword(password, row?.password_hash)) || !row) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    if (row.role !== 'employee' && row.role !== 'manager') {
      throw new ForbiddenException(
        'Không thể xác định quyền truy cập của tài khoản.',
      );
    }

    const token = randomBytes(32).toString('hex');
    await this.database.query(
      `INSERT INTO auth_sessions (token_hash, employee_id, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 hour'))`,
      [tokenHash(token), row.id, sessionDurationHours],
    );
    return { token, account: { id: row.id, email: row.email, role: row.role } };
  }

  async current(token: string | undefined): Promise<Account | null> {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const result = await this.database.query<QueryResultRow & Account>(
      `SELECT e.id, e.email, a.role
       FROM auth_sessions s
       JOIN employees e ON e.id = s.employee_id
       JOIN login_accounts a ON a.employee_id = e.id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)],
    );
    return result.rows[0] ?? null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      await this.database.query(
        'DELETE FROM auth_sessions WHERE token_hash = $1',
        [tokenHash(token)],
      );
    }
  }
}
