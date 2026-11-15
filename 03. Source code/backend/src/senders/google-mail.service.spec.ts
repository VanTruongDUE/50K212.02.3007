import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../database/database.service';
import { GoogleMailService } from './google-mail.service';
import { encryptMailSecret, decryptMailSecret } from './mail-secret';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
  CodeChallengeMethod: { S256: 'S256' },
}));

describe('Google mail OAuth', () => {
  const settings: Record<string, string> = {
    GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REDIRECT_URI:
      'http://127.0.0.1:5173/api/sender-accounts/google/callback',
    FRONTEND_BASE_URL: 'http://127.0.0.1:5173',
    SMTP_ENCRYPTION_KEY: 'ab'.repeat(32),
  };
  const config = { get: (key: string) => settings[key] } as ConfigService;
  let query: jest.Mock<Promise<unknown>, [string, unknown[]?]>;
  let service: GoogleMailService;
  let client: {
    generateCodeVerifierAsync: jest.Mock;
    generateAuthUrl: jest.Mock;
    getToken: jest.Mock;
    verifyIdToken: jest.Mock;
    setCredentials: jest.Mock;
    getAccessToken: jest.Mock;
    credentials: { expiry_date: number };
  };
  beforeEach(() => {
    query = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValue({ rows: [], rowCount: 0 });
    service = new GoogleMailService(
      { query } as unknown as DatabaseService,
      config,
    );
    client = {
      generateCodeVerifierAsync: jest.fn().mockResolvedValue({
        codeVerifier: 'pkce-verifier',
        codeChallenge: 'pkce-challenge',
      }),
      generateAuthUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth'),
      getToken: jest.fn().mockResolvedValue({
        tokens: {
          id_token: 'id-token',
          refresh_token: 'refresh-token',
          scope: 'openid email https://mail.google.com/',
        },
      }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'sender@gmail.com',
          email_verified: true,
        }),
      }),
      setCredentials: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token' }),
      credentials: { expiry_date: Date.now() + 3600000 },
    };
    jest
      .mocked(OAuth2Client)
      .mockImplementation(() => client as unknown as OAuth2Client);
  });
  function pending() {
    query.mockResolvedValueOnce({
      rows: [
        {
          sender_id: '164',
          email: 'sender@gmail.com',
          revision: 2,
          verifier_secret: encryptMailSecret(config, 'pkce-verifier'),
        },
      ],
    });
  }
  it('uses PKCE, hashes state/session and encrypts the verifier', async () => {
    query.mockResolvedValueOnce({
      rows: [{ email: 'sender@gmail.com', google_revision: 2 }],
    });
    await service.start(164, 'session-token');
    const params = query.mock.calls[2][1] as unknown[];
    expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(params[1]).not.toBe('session-token');
    expect(decryptMailSecret(config, params[5] as string)).toBe(
      'pkce-verifier',
    );
    expect(client.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        code_challenge_method: 'S256',
        access_type: 'offline',
        login_hint: 'sender@gmail.com',
      }),
    );
  });
  it('rejects expired, replayed or wrong-session state before exchanging tokens', async () => {
    await expect(
      service.complete('a'.repeat(64), 'code', false, 'other-session'),
    ).rejects.toThrow();
    expect(query.mock.calls[0][0]).toContain(
      'session_hash=$2 AND expires_at>now()',
    );
    expect(client.getToken).not.toHaveBeenCalled();
  });
  it('consumes cancellation without changing existing credentials', async () => {
    pending();
    expect(await service.complete('a'.repeat(64), '', true, 'session')).toEqual(
      { id: '164', result: 'cancelled' },
    );
    expect(client.getToken).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('verifies identity and stores only encrypted refresh tokens', async () => {
    pending();
    query.mockResolvedValueOnce({ rowCount: 1 });
    expect(
      await service.complete('a'.repeat(64), 'code', false, 'session'),
    ).toEqual({ id: '164', result: 'connected' });
    expect(client.getToken).toHaveBeenCalledWith({
      code: 'code',
      codeVerifier: 'pkce-verifier',
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: 'client-id',
    });
    const params = query.mock.calls[1][1] as unknown[];
    expect(params[2]).not.toContain('refresh-token');
    expect(decryptMailSecret(config, params[2] as string)).toBe(
      'refresh-token',
    );
    expect(query.mock.calls[1][0]).toContain('google_revision=$4');
  });
  it('rejects the wrong Google account', async () => {
    pending();
    client.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'other@gmail.com', email_verified: true }),
    });
    expect(
      (await service.complete('a'.repeat(64), 'code', false, 'session')).result,
    ).toBe('wrong_account');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects insufficient mail scope', async () => {
    pending();
    client.getToken.mockResolvedValueOnce({
      tokens: {
        id_token: 'id-token',
        refresh_token: 'refresh-token',
        scope: 'openid email',
      },
    });
    expect(
      (await service.complete('a'.repeat(64), 'code', false, 'session')).result,
    ).toBe('missing_permission');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('does not reconnect after a concurrent disconnect or email edit', async () => {
    pending();
    query.mockResolvedValueOnce({ rowCount: 0 });
    expect(
      (await service.complete('a'.repeat(64), 'code', false, 'session')).result,
    ).toBe('account_changed');
  });
  it('shares a refresh across SMTP and IMAP and caches the token', async () => {
    const account = {
      email: 'sender@gmail.com',
      google_status: 'connected',
      google_refresh_secret: encryptMailSecret(config, 'refresh'),
    };
    expect(
      await Promise.all([
        service.accessToken(account),
        service.accessToken(account),
      ]),
    ).toEqual(['access-token', 'access-token']);
    expect(await service.accessToken(account)).toBe('access-token');
    expect(client.getAccessToken).toHaveBeenCalledTimes(1);
  });
  it('marks revoked grants for reconnection without leaking provider data', async () => {
    client.getAccessToken.mockRejectedValueOnce({
      response: { data: { error: 'invalid_grant', private: 'secret-token' } },
    });
    await expect(
      service.accessToken({
        email: 'sender@gmail.com',
        google_status: 'connected',
        google_refresh_secret: encryptMailSecret(config, 'refresh'),
      }),
    ).rejects.toThrow('kết nối lại Google');
    expect(query.mock.calls[0][0]).toContain(
      "google_status='reconnect_required'",
    );
  });
  it('keeps grants on temporary provider errors', async () => {
    client.getAccessToken.mockRejectedValueOnce(
      new Error('network failure with secret-token'),
    );
    await expect(
      service.accessToken({
        email: 'sender@gmail.com',
        google_status: 'connected',
        google_refresh_secret: encryptMailSecret(config, 'refresh'),
      }),
    ).rejects.toThrow('Không thể làm mới');
    expect(query).not.toHaveBeenCalled();
  });
  it('disconnect disables sending and invalidates pending consent', async () => {
    query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rowCount: 1 });
    await service.disconnect(164);
    expect(query.mock.calls[0][0]).toContain(
      'DELETE FROM google_mail_oauth_states',
    );
    expect(query.mock.calls[1][0]).toContain(
      'google_revision=google_revision+1',
    );
    expect(query.mock.calls[1][0]).toContain("status='inactive'");
  });
});
