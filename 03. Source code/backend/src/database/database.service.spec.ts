import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Pool } from 'pg';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('DatabaseService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the Neon URL with certificate verification and a small Vercel pool', () => {
    const values: Record<string, string> = {
      DATABASE_URL:
        'postgresql://user:password@ep-example.neon.tech/app?sslmode=require&channel_binding=require',
      VERCEL: '1',
      POSTGRES_PORT: 'invalid',
    };
    new DatabaseService({ get: (key: string) => values[key] } as ConfigService);
    expect(Pool).toHaveBeenCalledWith({
      connectionString:
        'postgresql://user:password@ep-example.neon.tech/app?sslmode=verify-full&channel_binding=require',
      connectionTimeoutMillis: 10000,
      max: 2,
    });
  });

  it('keeps the existing local PostgreSQL connection options', () => {
    const values: Record<string, string> = {
      POSTGRES_USER: 'local-user',
      POSTGRES_PASSWORD: 'local-password',
      POSTGRES_DB: 'local-db',
    };
    new DatabaseService({ get: (key: string) => values[key] } as ConfigService);
    expect(Pool).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 5432,
      user: 'local-user',
      password: 'local-password',
      database: 'local-db',
      connectionTimeoutMillis: 3000,
    });
  });
  it('rejects an invalid database port', () => {
    const config = {
      get: (key: string) => (key === 'POSTGRES_PORT' ? 'invalid' : undefined),
    } as ConfigService;

    expect(() => new DatabaseService(config)).toThrow(
      'POSTGRES_PORT must be a valid TCP port',
    );
  });

  it('rejects missing database credentials', () => {
    const config = { get: () => undefined } as unknown as ConfigService;

    expect(() => new DatabaseService(config)).toThrow(
      'POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB are required',
    );
  });
});
