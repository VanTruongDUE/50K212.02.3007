import { ConfigService } from '@nestjs/config';
import { SmtpService } from './smtp.service';

describe('SmtpService', () => {
  it('stores a different ciphertext and recovers the SMTP secret', () => {
    const config = { get: () => 'ab'.repeat(32) } as ConfigService;
    const service = new SmtpService(config);
    const encrypted = service.encrypt('local-test-secret');
    expect(encrypted).not.toContain('local-test-secret');
    expect(
      service.credentials({
        email: 'sender@example.com',
        smtp_host: 'localhost',
        smtp_port: 465,
        smtp_user: 'sender@example.com',
        smtp_secret: encrypted,
      }),
    ).toEqual({ user: 'sender@example.com', pass: 'local-test-secret' });
  });
});
