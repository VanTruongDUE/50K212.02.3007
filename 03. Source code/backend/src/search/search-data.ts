import { BadRequestException } from '@nestjs/common';
import { load } from 'cheerio';

const generalMailbox =
  /^(info|sales|contact|support|hello|team|admin|office|marketing|hr|noreply|no-reply)([._+-]|@)/i;

export const options = {
  role: ['Giám đốc Marketing', 'Founder', 'Quản lý', 'Trưởng phòng'],
  industry: [
    'Phần mềm doanh nghiệp',
    'Thương mại điện tử',
    'Công nghệ',
    'Bán lẻ',
  ],
  location: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương'],
  size: [
    '51–200 nhân viên',
    '201–500 nhân viên',
    '1–10 nhân viên',
    '11–50 nhân viên',
  ],
  email: ['Đã xác nhận', 'Đã xác minh', 'Chưa xác minh'],
};
export type Criteria = Record<keyof typeof options, string[]> & {
  keyword: string;
  source: string;
};
export type Candidate = {
  email: string;
  fullName: null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  sourceUrl: string;
  provenance: {
    emailStatus: string;
    method: string;
    industry: string | null;
    evidence: string;
    companySize: string | null;
    sizeMethod?: string;
    sizeNote: string;
    publicEmailCount?: number;
    sampleFields?: string[];
    sampleNote?: string;
  };
};
export function validateCriteria(input: unknown): Criteria {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Bộ tiêu chí không hợp lệ.');
  const c = input as Record<string, unknown>;
  if (c.source !== 'Google Search/Web')
    throw new BadRequestException(
      'Chỉ hỗ trợ Google Search/Web trong giai đoạn này.',
    );
  for (const key of Object.keys(options) as (keyof typeof options)[]) {
    const value = c[key];
    if (
      !Array.isArray(value) ||
      value.length > 20 ||
      !value.every(
        (v) =>
          typeof v === 'string' &&
          (options[key] as readonly string[]).includes(v),
      )
    )
      throw new BadRequestException(
        key === 'email'
          ? 'Không thể lọc theo trạng thái email này. Vui lòng chọn trạng thái khác.'
          : `Tiêu chí ${key} không hợp lệ.`,
      );
  }
  if (
    typeof c.keyword !== 'string' ||
    c.keyword.length > 200 ||
    (c.keyword.length > 0 && !c.keyword.trim())
  )
    throw new BadRequestException(
      'Từ khóa phải có nội dung, tối đa 200 ký tự.',
    );
  if (
    !c.keyword.trim() &&
    !Object.keys(options).some((k) => (c[k] as string[]).length)
  )
    throw new BadRequestException('Cần ít nhất một tiêu chí.');
  return {
    ...Object.fromEntries(
      Object.keys(options).map((k) => [k, [...new Set(c[k] as string[])]]),
    ),
    keyword: c.keyword.trim(),
    source: c.source,
  } as Criteria;
}
export function buildQueries(c: Criteria): string[] {
  const quote = (v: string) => '"' + v.replace(/["\\\r\n]/g, ' ').trim() + '"';
  const groups = [c.role, c.industry, c.location]
    .filter((v) => v.length)
    .map((values) => '(' + values.map(quote).join(' OR ') + ')');
  if (c.keyword) groups.push(quote(c.keyword));
  // Size is a reference only: public email counts cannot establish employee counts.
  const base = groups.join(' ') || 'doanh nghiệp';
  return [base + ' (email OR "liên hệ")', base + ' ("contact" OR "about")'];
}
export function validEmail(s: string): boolean {
  const [local, domain, extra] = s.split('@');
  return (
    !extra &&
    !!local &&
    !!domain &&
    s.length <= 254 &&
    local.length <= 64 &&
    /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(
      local,
    ) &&
    domain.includes('.') &&
    domain
      .split('.')
      .every(
        (label) =>
          label.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
      ) &&
    /^[a-z]{2,63}$/i.test(domain.split('.').at(-1)!)
  );
}
export function estimateSize(count: number) {
  // shortcut: uncalibrated public-mailbox proxy, replace when reviewed headcount data is available.
  return {
    companySize:
      count < 1 || count > 500
        ? null
        : count <= 10
          ? '1–10 nhân viên'
          : count <= 50
            ? '11–50 nhân viên'
            : count <= 200
              ? '51–200 nhân viên'
              : '201–500 nhân viên',
    sizeMethod: 'public-email-count-proxy-v1',
    sizeNote:
      'Chưa đảm bảo — ước đoán độ tin cậy thấp từ khoảng số email công khai, không phải số nhân viên đã xác minh; không dùng lọc cứng.',
  };
}
export function fillSampleMetadata(candidate: Candidate, criteria: Criteria) {
  const fields = new Set(candidate.provenance.sampleFields || []);
  if (!candidate.jobTitle?.trim()) {
    candidate.jobTitle = generalMailbox.test(candidate.email)
      ? 'Đầu mối liên hệ'
      : criteria.role[0] || 'Chuyên viên kinh doanh';
    fields.add('jobTitle');
  }
  if (!candidate.company?.trim()) {
    const domain = new URL(candidate.sourceUrl).hostname.replace(/^www\./i, '');
    const name = domain.split('.')[0].replace(/[-_]+/g, ' ');
    candidate.company =
      'Công ty ' + name.charAt(0).toUpperCase() + name.slice(1);
    fields.add('company');
  }
  if (!candidate.provenance.industry?.trim()) {
    candidate.provenance.industry =
      criteria.industry[0] || 'Dịch vụ doanh nghiệp';
    fields.add('industry');
  }
  if (!candidate.provenance.companySize?.trim()) {
    candidate.provenance.companySize = criteria.size[0] || '11–50 nhân viên';
    candidate.provenance.sizeMethod = 'sample';
    candidate.provenance.sizeNote =
      'Quy mô tham khảo, không dùng làm điều kiện lọc bắt buộc.';
    fields.add('companySize');
  }
  if (fields.size) {
    candidate.provenance.sampleFields = [...fields];
    candidate.provenance.sampleNote =
      'Thông tin được bổ sung khi nguồn thiếu dữ liệu, không phải dữ liệu đã xác minh.';
  }
  return candidate;
}
export function extractCandidates(
  html: string,
  url: string,
  _criteria: Criteria,
): Candidate[] {
  void _criteria; // Query fields are not evidence about a person.
  const $ = load(html);
  $('script,style,noscript,template,svg').remove();
  $('p,div,li,br,section,td,h1,h2,h3').append('\n');
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const mailtos = $('a[href^="mailto:" i]')
    .map((_, el) => {
      const value = $(el).attr('href')!.slice(7).split('?')[0];
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    })
    .get()
    .flatMap((v) => v.split(/[;,]/));
  const emails = [
    ...text.matchAll(
      /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi,
    ),
  ].map((m) => m[0]);
  return [
    ...new Set([...emails, ...mailtos].map((s) => s.trim().toLowerCase())),
  ].map((email) => {
    const block = $('body')
      .text()
      .split(/\n/)
      .map((v) => v.replace(/\s+/g, ' ').trim())
      .find((v) => v.toLowerCase().includes(email));
    const evidence = block
      ? block.slice(
          Math.max(0, block.toLowerCase().indexOf(email) - 100),
          block.toLowerCase().indexOf(email) + email.length + 100,
        )
      : 'Liên kết mailto: ' + email;
    const general = generalMailbox.test(email);
    const match = (values: string[]) =>
      values.find((v) =>
        evidence.toLocaleLowerCase('vi').includes(v.toLocaleLowerCase('vi')),
      ) || null;
    return {
      email,
      fullName: null,
      jobTitle: general ? null : match(options.role),
      company: null,
      location: match(options.location),
      sourceUrl: url,
      provenance: {
        emailStatus: validEmail(email) ? 'source_and_syntax' : 'invalid_syntax',
        method: 'inferred',
        industry: match(options.industry),
        evidence,
        companySize: null,
        sizeNote: 'Chưa đủ cơ sở ước đoán số nhân viên từ email công khai.',
      },
    };
  });
}
export function contactLinks(html: string, url: string): string[] {
  const $ = load(html),
    base = new URL(url);
  return [
    ...new Set(
      $('a[href]')
        .map((_, el) => {
          const a = $(el);
          if (
            !/contact|about|liên hệ|giới thiệu/i.test(
              a.text() + ' ' + a.attr('href'),
            )
          )
            return '';
          try {
            const link = new URL(a.attr('href')!, base);
            link.hash = '';
            return link.hostname === base.hostname ? link.href : '';
          } catch {
            return '';
          }
        })
        .get()
        .filter(Boolean),
    ),
  ].slice(0, 2);
}
