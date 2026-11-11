import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const port = Number(config.get<string>('POSTGRES_PORT') ?? 5432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('POSTGRES_PORT must be a valid TCP port');
    }

    const user = config.get<string>('POSTGRES_USER')?.trim();
    const password = config.get<string>('POSTGRES_PASSWORD');
    const database = config.get<string>('POSTGRES_DB')?.trim();
    if (!user || !password || !database) {
      throw new Error(
        'POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB are required',
      );
    }

    this.pool = new Pool({
      host: config.get<string>('POSTGRES_HOST') ?? '127.0.0.1',
      port,
      user,
      password,
      database,
      connectionTimeoutMillis: 3000,
    });
  }

  query<T extends QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, values);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
