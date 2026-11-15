import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  buildQueries,
  Candidate,
  contactLinks,
  Criteria,
  extractCandidates,
  estimateSize,
  validateCriteria,
  validEmail,
} from './search-data';
import { SerpProvider } from './serp.provider';
import { WebReader } from './web-reader';
import type { QueryResultRow } from 'pg';
type Job = QueryResultRow & {
  id: string;
  owner_id: string;
  criteria: Criteria;
  status: string;
  request_key: string;
  lease_token: string;
  attempts: number;
};
@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private controller?: AbortController;
  private logger = new Logger(SearchService.name);
  constructor(
    private db: DatabaseService,
    private provider: SerpProvider,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.active) {
        this.active = this.tick()
          .catch(() => this.logger.warn('Không xử lý được job tìm kiếm.'))
          .finally(() => {
            this.active = undefined;
          });
      }
    }, 1000);
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.controller?.abort();
    await this.active;
  }
  capabilities() {
    return {
      configured: this.provider.configured(),
      source: 'Google Search/Web',
      emailVerification: 'source_and_syntax',
      catchAll: false,
      sizeHardFilter: false,
    };
  }
  async create(
    owner: string,
    body: { criteria?: unknown; requestKey?: unknown },
  ) {
    const criteria = validateCriteria(body?.criteria);
    if (
      typeof body.requestKey !== 'string' ||
      !/^[a-z0-9-]{16,80}$/i.test(body.requestKey)
    )
      throw new BadRequestException('Mã yêu cầu tìm kiếm không hợp lệ.');
    // Return an existing job even if credentials are temporarily unavailable.
    const existing = await this.db.query<Job>(
      'SELECT * FROM contact_search_jobs WHERE owner_id=$1 AND request_key=$2',
      [owner, body.requestKey],
    );
    if (existing.rows[0]) {
      if (
        JSON.stringify(existing.rows[0].criteria) !==
        JSON.stringify(JSON.parse(JSON.stringify(criteria)))
      ) {
        const a = existing.rows[0].criteria;
        if (
          Object.keys(criteria).some(
            (k) =>
              JSON.stringify(a[k as keyof Criteria]) !==
              JSON.stringify(criteria[k as keyof Criteria]),
          )
        )
          throw new ConflictException('Mã yêu cầu đã dùng với tiêu chí khác.');
      }
      return this.detail(owner, existing.rows[0].id);
    }
    if (!this.provider.configured())
      throw new ServiceUnavailableException(
        'Tìm kiếm tạm thời không khả dụng. Vui lòng thử lại sau. Bộ tiêu chí đã được giữ lại.',
      );
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `contact-search:${owner}`,
      ]);
      const replay = await client.query<Job>(
        'SELECT * FROM contact_search_jobs WHERE owner_id=$1 AND request_key=$2',
        [owner, body.requestKey],
      );
      if (replay.rows[0]) {
        if (
          Object.keys(criteria).some(
            (k) =>
              JSON.stringify(replay.rows[0].criteria[k as keyof Criteria]) !==
              JSON.stringify(criteria[k as keyof Criteria]),
          )
        )
          throw new ConflictException('Mã yêu cầu đã dùng với tiêu chí khác.');
        await client.query('COMMIT');
        return this.detail(owner, replay.rows[0].id);
      }
      const running = await client.query(
        "SELECT 1 FROM contact_search_jobs WHERE owner_id=$1 AND status IN ('queued','running')",
        [owner],
      );
      if (running.rowCount)
        throw new ConflictException(
          'Bạn đang có một lần tìm kiếm chưa hoàn tất. Hãy mở lại lần tìm hiện tại.',
        );
      const result = await client.query<Job>(
        'INSERT INTO contact_search_jobs(owner_id,request_key,criteria) VALUES($1,$2,$3) RETURNING *',
        [owner, body.requestKey, criteria],
      );
      await client.query('COMMIT');
      return this.detail(owner, result.rows[0].id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  async detail(owner: string, id: string) {
    const result = await this.db.query(
      'SELECT id,criteria,status,stage,attempts,processed,received,invalid,duplicate,new_count,results,warnings,list_id,error,created_at,finished_at FROM contact_search_jobs WHERE id=$1 AND owner_id=$2',
      [id, owner],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
  async history(owner: string, cursor = Number.MAX_SAFE_INTEGER) {
    return (
      await this.db.query(
        'SELECT id,criteria,status,received,invalid,duplicate,new_count,list_id,error,created_at,finished_at FROM contact_search_jobs WHERE owner_id=$1 AND id<$2 ORDER BY id DESC LIMIT 25',
        [owner, cursor],
      )
    ).rows;
  }
  async tick() {
    await this.db.query(
      "UPDATE contact_search_jobs SET status='failed',stage='failed',error='Máy chủ đã gián đoạn lần tìm kiếm. Hãy tìm lại.',finished_at=now() WHERE status='running' AND lease_until<now() AND attempts>=2",
    );
    const token = randomUUID();
    const claimed = await this.db.query<Job>(
      `UPDATE contact_search_jobs SET status='running',stage='searching',lease_token=$1,lease_until=now()+interval '150 seconds',attempts=attempts+1 WHERE id=(SELECT id FROM contact_search_jobs WHERE status='queued' OR (status='running' AND lease_until<now() AND attempts<2) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [token],
    );
    if (!claimed.rows[0]) return;
    const job = claimed.rows[0],
      controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const candidates: Candidate[] = [],
        warnings: string[] = [],
        providerIds: string[] = [],
        urls: string[] = [];
      for (const query of buildQueries(job.criteria)) {
        let start: number | null = 0;
        for (let page = 0; page < 2 && start !== null; page++) {
          const result = await this.provider.search(
            query,
            start,
            controller.signal,
          );
          providerIds.push(result.id);
          urls.push(...result.urls);
          start = result.next;
        }
      }
      const queue = [...new Set(urls)].slice(0, 20),
        seen = new Set<string>(),
        domains = new Set<string>(),
        reader = new WebReader(controller.signal);
      let processed = 0,
        read = 0;
      const stage = async (value: string) => {
        await this.db.query(
          'UPDATE contact_search_jobs SET stage=$3,processed=$4 WHERE id=$1 AND lease_token=$2',
          [job.id, token, value, processed],
        );
      };
      await stage('fetching');
      while (queue.length && processed < 20) {
        controller.signal.throwIfAborted();
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        processed++;
        try {
          const page = await reader.read(url);
          read++;
          candidates.push(
            ...extractCandidates(page.html, page.url, job.criteria),
          );
          const domain = new URL(page.url).hostname;
          if (!domains.has(domain)) {
            domains.add(domain);
            queue.push(...contactLinks(page.html, page.url));
          }
        } catch {
          warnings.push('Không đọc được URL: ' + url.slice(0, 300));
        }
        await stage('fetching');
        if (candidates.length > 1000)
          throw Error('Quá nhiều email ứng viên. Hãy thu hẹp tiêu chí.');
      }
      controller.signal.throwIfAborted();
      if (urls.length && read === 0)
        throw Error(
          'Không đọc được website nào. Hãy điều chỉnh tiêu chí hoặc thử lại.',
        );
      if (queue.length || urls.length > 20)
        warnings.push(
          'Đã đạt giới hạn 20 trang web; kết quả có thể chưa đầy đủ.',
        );
      await stage('saving');
      await this.save(
        job,
        token,
        candidates,
        warnings,
        providerIds,
        controller.signal,
      );
    } catch (e) {
      const message = controller.signal.aborted
        ? 'Lần tìm vượt giới hạn thời gian hoặc máy chủ đang dừng. Hãy tìm lại.'
        : e instanceof Error
          ? e.message
          : 'Không hoàn tất tìm kiếm.';
      await this.db.query(
        "UPDATE contact_search_jobs SET status='failed',stage='failed',error=$3,finished_at=now() WHERE id=$1 AND lease_token=$2 AND status='running'",
        [job.id, token, message.slice(0, 500)],
      );
    } finally {
      clearTimeout(timer);
      this.controller = undefined;
    }
  }
  private async save(
    job: Job,
    token: string,
    candidates: Candidate[],
    warnings: string[],
    providerIds: string[],
    signal: AbortSignal,
  ) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        "SELECT 1 FROM contact_search_jobs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() FOR UPDATE",
        [job.id, token],
      );
      if (!locked.rowCount) throw Error('Job đã được tiến trình khác xử lý.');
      const seen = new Set<string>(),
        results: Record<string, unknown>[] = [],
        domainCounts = new Map<string, Set<string>>();
      for (const c of candidates) {
        const domain = new URL(c.sourceUrl).hostname;
        const emails = domainCounts.get(domain) || new Set<string>();
        if (validEmail(c.email)) emails.add(c.email);
        domainCounts.set(domain, emails);
      }
      let duplicate = 0,
        invalid = 0;
      let listId: string | null = null;
      for (const c of candidates) {
        signal.throwIfAborted();
        if (!validEmail(c.email)) {
          invalid++;
          continue;
        }
        if (seen.has(c.email)) {
          duplicate++;
          continue;
        }
        seen.add(c.email);
        c.provenance.publicEmailCount =
          domainCounts.get(new URL(c.sourceUrl).hostname)?.size || 0;
        Object.assign(
          c.provenance,
          estimateSize(c.provenance.publicEmailCount),
        );
        if (results.length >= 100)
          throw Error(
            'Vượt giới hạn 100 Contact mới. Thu hẹp tiêu chí rồi tìm lại.',
          );
        const saved = await client.query<QueryResultRow & { id: string }>(
          'INSERT INTO contacts(email,full_name,job_title,company,location,source_url,search_provenance) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(lower(email)) DO NOTHING RETURNING *',
          [
            c.email,
            c.fullName,
            c.jobTitle,
            c.company,
            c.location,
            c.sourceUrl,
            c.provenance,
          ],
        );
        if (!saved.rowCount) {
          duplicate++;
          continue;
        }
        if (!listId) {
          const list = await client.query<{ id: string }>(
            'INSERT INTO contact_lists(name,owner_id,criteria) VALUES($1,$2,$3) RETURNING id',
            [
              'Google Search ' + new Date().toISOString().slice(0, 19),
              job.owner_id,
              job.criteria,
            ],
          );
          listId = list.rows[0].id;
        }
        await client.query(
          'INSERT INTO contact_list_items(list_id,contact_id) VALUES($1,$2)',
          [listId, saved.rows[0].id],
        );
        results.push(saved.rows[0]);
      }
      signal.throwIfAborted();
      await client.query(
        "UPDATE contact_search_jobs SET status='succeeded',stage='done',received=$3,invalid=$10,duplicate=$4,new_count=$5,results=$6,warnings=$7,provider_ids=$8,list_id=$9,finished_at=now(),error=NULL WHERE id=$1 AND lease_token=$2",
        [
          job.id,
          token,
          candidates.length,
          duplicate,
          results.length,
          JSON.stringify(results),
          JSON.stringify(warnings),
          JSON.stringify(providerIds),
          listId,
          invalid,
        ],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
