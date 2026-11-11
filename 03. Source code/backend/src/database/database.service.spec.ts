import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
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
