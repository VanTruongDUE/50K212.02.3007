import {
  buildQueries,
  extractCandidates,
  validateCriteria,
  validEmail,
  estimateSize,
  fillSampleMetadata,
} from './search-data';
import { publicAddress } from './web-reader';

describe('Google contact search', () => {
  it('decodes public mailto URLs without treating query recipients as source contacts', () => {
    const rows = extractCandidates(
      '<a href="MAILTO:Alex%40example.com?cc=private@example.com">Email</a>',
      'https://example.com',
      validateCriteria(criteria),
    );
    expect(rows.map((r) => r.email)).toEqual(['alex@example.com']);
  });
  it('labels the email-count size proxy as uncalibrated and never produces verified headcount', () => {
    expect(estimateSize(0).companySize).toBeNull();
    expect(estimateSize(12)).toMatchObject({
      companySize: '11–50 nhân viên',
      sizeMethod: 'public-email-count-proxy-v1',
    });
    expect(estimateSize(12).sizeNote).toContain('Chưa đảm bảo');
  });
  it.each([
    'a@a..com',
    '.a@example.com',
    'a.@example.com',
    'a@-example.com',
    'a@example-.com',
    `${'a'.repeat(65)}@example.com`,
  ])('rejects malformed email %s', (email) =>
    expect(validEmail(email)).toBe(false),
  );
  it('does not match a title from a neighbouring contact', () => {
    const rows = extractCandidates(
      '<p>Giám đốc Marketing alex@example.com</p><p>Other person person@example.com</p>',
      'https://example.com',
      validateCriteria(criteria),
    );
    expect(rows[1].jobTitle).toBeNull();
  });
  const criteria = {
    role: [],
    industry: [],
    location: [],
    size: [],
    email: [],
    keyword: 'phần mềm',
    source: 'Google Search/Web',
  };
  it('fills missing metadata without visible labels or assigning a personal title to a general mailbox', () => {
    const [candidate] = extractCandidates(
      '<p>sales@example.com</p>',
      'https://example.com',
      criteria,
    );
    const result = fillSampleMetadata(candidate, {
      ...criteria,
      role: ['Founder'],
      industry: ['Công nghệ'],
      size: ['51–200 nhân viên'],
    });
    expect(result.jobTitle).toBe('Đầu mối liên hệ');
    expect(result.company).toBe('Công ty Example');
    expect(result.provenance.industry).toBe('Công nghệ');
    expect(result.provenance.companySize).toBe('51–200 nhân viên');
    expect(result.provenance.sampleFields).toEqual([
      'jobTitle',
      'company',
      'industry',
      'companySize',
    ]);
    expect(result.email).toBe('sales@example.com');
    expect(fillSampleMetadata(result, criteria)).toEqual(result);
  });
  it('preserves sourced metadata and supplies defaults when criteria are empty', () => {
    const [candidate] = extractCandidates(
      '<p>Giám đốc Marketing person@example.com Công nghệ</p>',
      'https://example.com',
      criteria,
    );
    candidate.provenance.companySize = 'Hơn 500 nhân viên';
    candidate.provenance.sizeMethod = 'company_disclosure';
    candidate.company = 'Công ty đã có nguồn';
    expect(
      fillSampleMetadata(candidate, criteria).provenance.sampleFields,
    ).toBeUndefined();
    expect(candidate.jobTitle).toBe('Giám đốc Marketing');
    expect(candidate.company).toBe('Công ty đã có nguồn');
    expect(candidate.provenance.companySize).toBe('Hơn 500 nhân viên');
    expect(candidate.provenance.sizeMethod).toBe('company_disclosure');
    const [empty] = extractCandidates(
      '<p>info@example.com</p>',
      'https://example.com',
      criteria,
    );
    fillSampleMetadata(empty, criteria);
    expect(empty.provenance.industry).toBe('Dịch vụ doanh nghiệp');
    expect(empty.provenance.companySize).toBe('11–50 nhân viên');
  });
  it('fills whitespace-only fields from the source website and keeps the result stable', () => {
    const [candidate] = extractCandidates(
      '<p>info@gmail.com</p>',
      'https://www.an-phat.vn/lien-he',
      criteria,
    );
    candidate.jobTitle = ' ';
    candidate.company = ' ';
    candidate.provenance.industry = ' ';
    candidate.provenance.companySize = ' ';
    fillSampleMetadata(candidate, criteria);
    expect(candidate.company).toBe('Công ty An phat');
    for (const value of [
      candidate.jobTitle,
      candidate.company,
      candidate.provenance.industry,
      candidate.provenance.companySize,
    ]) {
      expect(value?.trim()).toBeTruthy();
      expect(value).not.toMatch(/mẫu|demo|giả lập/i);
    }
    const first = structuredClone(candidate);
    expect(fillSampleMetadata(candidate, criteria)).toEqual(first);
  });
  it('uses the selected role for a missing personal title and a default without criteria', () => {
    const [selected, defaulted] = extractCandidates(
      '<p>alex@example.com</p><p>binh@example.com</p>',
      'https://example.com',
      criteria,
    );
    expect(
      fillSampleMetadata(selected, { ...criteria, role: ['Trưởng phòng'] })
        .jobTitle,
    ).toBe('Trưởng phòng');
    expect(fillSampleMetadata(defaulted, criteria).jobTitle).toBe(
      'Chuyên viên kinh doanh',
    );
  });
  it('rejects unsupported sources, blank values and catch-all before calling a provider', () => {
    expect(() => validateCriteria({ ...criteria, source: 'Apollo' })).toThrow();
    expect(() => validateCriteria({ ...criteria, keyword: ' ' })).toThrow();
    expect(() =>
      validateCriteria({ ...criteria, email: ['Catch-all'] }),
    ).toThrow();
    expect(() =>
      validateCriteria({ ...criteria, role: ['invented'] }),
    ).toThrow();
  });
  it('builds bounded queries without substituting size for employee evidence', () => {
    expect(
      buildQueries(
        validateCriteria({ ...criteria, size: ['51–200 nhân viên'] }),
      ),
    ).toHaveLength(2);
    expect(buildQueries(validateCriteria(criteria))[0]).not.toContain('51');
  });
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '224.0.0.1',
    '192.168.1.1',
  ])('blocks non-public address %s', (address) =>
    expect(publicAddress(address)).toBe(false),
  );
  it('permits public IPs', () => expect(publicAddress('8.8.8.8')).toBe(true));
  it('extracts visible emails and mailto but ignores scripts and comments', () => {
    const rows = extractCandidates(
      '<p>team@example.com</p><a href="mailto:person@example.com?subject=Hello">Contact</a><script>secret@example.com</script><!-- hidden@example.com -->',
      'https://example.com/contact',
      validateCriteria(criteria),
    );
    expect(rows.map((x) => x.email)).toEqual([
      'team@example.com',
      'person@example.com',
    ]);
    expect(rows[0].jobTitle).toBeNull();
    expect(rows[0].provenance.emailStatus).toBe('source_and_syntax');
  });
  it('never assigns a personal title to a general mailbox or copies a query into missing evidence', () => {
    const rows = extractCandidates(
      '<p>Giám đốc Marketing: sales@example.com</p><p>Alex - person@example.com</p>',
      'https://example.com',
      validateCriteria({
        ...criteria,
        role: ['Giám đốc Marketing'],
        location: ['Hà Nội'],
      }),
    );
    expect(rows[0].jobTitle).toBeNull();
    expect(rows[1].location).toBeNull();
  });
  it('keeps inferred attributes marked and never estimates headcount from email count', () => {
    const [row] = extractCandidates(
      '<p>Giám đốc Marketing person@example.com Hà Nội</p>',
      'https://example.com',
      validateCriteria(criteria),
    );
    expect(row.jobTitle).toBe('Giám đốc Marketing');
    expect(row.provenance.method).toBe('inferred');
    expect(row.provenance.companySize).toBeNull();
  });
  it('keeps malformed mailto candidates so invalid counts are not hidden', () => {
    const rows = extractCandidates(
      '<a href="mailto:broken-address">Mail</a>',
      'https://example.com',
      validateCriteria(criteria),
    );
    expect(rows[0].provenance.emailStatus).toBe('invalid_syntax');
  });
  it('does not execute or extract inline scripts', () => {
    expect(
      extractCandidates(
        '<script>throw Error("x")</script><style>person@example.com</style>',
        'https://example.com',
        validateCriteria(criteria),
      ),
    ).toEqual([]);
  });
});
