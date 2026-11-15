import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { DatabaseService } from '../database/database.service';
import { decryptMailSecret, encryptMailSecret } from './mail-secret';

const mailScope = 'https://mail.google.com/';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
type MailAccount = {
  email: string;
  google_refresh_secret?: string | null;
  google_status?: string | null;
};
type PendingState = {
  sender_id: string;
  email: string;
  revision: number;
  verifier_secret: string;
};

@Injectable()
export class GoogleMailService {
  private readonly tokens = new Map<
    string,
    { token: string; expires: number }
  >();
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  settings() {
    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_OAUTH_CLIENT_SECRET')
      ?.trim();
    const redirectUri = this.config
      .get<string>('GOOGLE_OAUTH_REDIRECT_URI')
      ?.trim();
    const frontend = this.config.get<string>('FRONTEND_BASE_URL')?.trim();
    if (!clientId || !clientSecret || !redirectUri || !frontend)
      throw new ServiceUnavailableException(
        'Chưa cấu hình Google OAuth trên máy chủ. Xem hướng dẫn kết nối Gmail trong README.',
      );
    for (const address of [redirectUri, frontend]) {
      const url = new URL(address);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
      )
        throw new ServiceUnavailableException(
          'Địa chỉ Google OAuth không hợp lệ.',
        );
    }
    return { clientId, clientSecret, redirectUri, frontend };
  }

  available() {
    try {
      this.settings();
      return { configured: true };
    } catch {
      return { configured: false };
    }
  }

  private client() {
    const { clientId, clientSecret, redirectUri } = this.settings();
    return new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
      transporterOptions: { timeout: 15000, retry: false },
    });
  }

  async start(id: number, session: string) {
    const client = this.client();
    const account = (
      await this.database.query<{ email: string; google_revision: number }>(
        'SELECT email,google_revision FROM sender_accounts WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!account)
      throw new BadRequestException('Không tìm thấy tài khoản gửi.');
    const state = randomBytes(32).toString('hex');
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync();
    await this.database.query(
      'DELETE FROM google_mail_oauth_states WHERE expires_at < now()',
    );
    await this.database.query(
      `INSERT INTO google_mail_oauth_states(state_hash,session_hash,sender_id,email,revision,verifier_secret,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
      [
        hash(state),
        hash(session),
        id,
        account.email,
        account.google_revision,
        encryptMailSecret(this.config, codeVerifier),
      ],
    );
    return {
      url: client.generateAuthUrl({
        scope: ['openid', 'email', mailScope],
        access_type: 'offline',
        prompt: 'consent',
        login_hint: account.email,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    };
  }

  async complete(
    state: string,
    code: string,
    denied: boolean,
    session: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(state))
      throw new BadRequestException('Phiên kết nối Google không hợp lệ.');
    const pending = (
      await this.database.query<PendingState>(
        `DELETE FROM google_mail_oauth_states
      WHERE state_hash=$1 AND session_hash=$2 AND expires_at>now() RETURNING sender_id,email,revision,verifier_secret`,
        [hash(state), hash(session)],
      )
    ).rows[0];
    if (!pending)
      throw new BadRequestException(
        'Phiên kết nối Google đã hết hạn hoặc đã sử dụng.',
      );
    if (denied) return { id: pending.sender_id, result: 'cancelled' };
    if (!code || code.length > 4096)
      return { id: pending.sender_id, result: 'failed' };
    try {
      const client = this.client();
      const { tokens } = await client.getToken({
        code,
        codeVerifier: decryptMailSecret(this.config, pending.verifier_secret),
      });
      if (
        !tokens.id_token ||
        !tokens.refresh_token ||
        !tokens.scope?.split(' ').includes(mailScope)
      )
        return { id: pending.sender_id, result: 'missing_permission' };
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.settings().clientId,
      });
      const identity = ticket.getPayload();
      if (
        !identity?.email_verified ||
        identity.email?.toLowerCase() !== pending.email.toLowerCase()
      )
        return { id: pending.sender_id, result: 'wrong_account' };
      // Compare the original email so an edit during consent cannot link the wrong account.
      const saved = await this.database.query(
        `UPDATE sender_accounts SET google_refresh_secret=$3,google_status='connected',google_revision=google_revision+1,
        smtp_host='smtp.gmail.com',smtp_port=465,smtp_user=email
        WHERE id=$1 AND email=$2 AND google_revision=$4 RETURNING id`,
        [
          pending.sender_id,
          pending.email,
          encryptMailSecret(this.config, tokens.refresh_token),
          pending.revision,
        ],
      );
      return {
        id: pending.sender_id,
        result: saved.rowCount ? 'connected' : 'account_changed',
      };
    } catch {
      // Never propagate token-exchange errors: provider errors may contain credentials.
      return { id: pending.sender_id, result: 'failed' };
    }
  }

  returnUrl(result: string, id?: string) {
    const url = new URL(this.settings().frontend);
    url.searchParams.set(
      'screen',
      id ? 'manager-account-edit' : 'manager-account-list',
    );
    url.searchParams.set('role', 'manager');
    url.searchParams.set('google', result);
    if (id) url.searchParams.set('senderId', id);
    return url.toString();
  }

  async disconnect(id: number) {
    await this.database.query(
      'DELETE FROM google_mail_oauth_states WHERE sender_id=$1',
      [id],
    );
    const result = await this.database.query(
      "UPDATE sender_accounts SET google_refresh_secret=NULL,google_status=NULL,google_revision=google_revision+1,status='inactive',inbound_enabled=false WHERE id=$1 RETURNING id",
      [id],
    );
    if (!result.rowCount)
      throw new BadRequestException('Không tìm thấy tài khoản gửi.');
    return { disconnected: true };
  }

  async accessToken(account: MailAccount): Promise<string> {
    const secret = account.google_refresh_secret;
    if (!secret || account.google_status !== 'connected')
      throw new BadRequestException(
        'Cần kết nối lại Google cho tài khoản gửi này.',
      );
    const key = hash(secret);
    const cached = this.tokens.get(key);
    if (cached && cached.expires > Date.now() + 60000) return cached.token;
    const pending = this.refreshing.get(key);
    if (pending) return pending;
    const refresh = this.refresh(account, secret, key);
    this.refreshing.set(key, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshing.delete(key);
    }
  }

  private async refresh(account: MailAccount, secret: string, key: string) {
    const client = this.client();
    client.setCredentials({
      refresh_token: decryptMailSecret(this.config, secret),
    });
    try {
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('Missing access token');
      for (const [entry, cached] of this.tokens)
        if (cached.expires <= Date.now()) this.tokens.delete(entry);
      this.tokens.set(key, {
        token,
        expires: client.credentials.expiry_date || Date.now(),
      });
      return token;
    } catch (error: unknown) {
      const providerError = (
        error as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      if (providerError === 'invalid_grant') {
        await this.database.query(
          "UPDATE sender_accounts SET google_status='reconnect_required' WHERE email=$1 AND google_refresh_secret=$2",
          [account.email, secret],
        );
        throw new BadRequestException(
          'Quyền Google đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại Google.',
        );
      }
      throw new ServiceUnavailableException(
        'Không thể làm mới kết nối Google. Kiểm tra cấu hình OAuth và thử lại.',
      );
    }
  }
}
