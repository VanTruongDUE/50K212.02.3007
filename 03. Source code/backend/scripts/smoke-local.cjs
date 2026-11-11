const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { InboxService } = require('../dist/inbox/inbox.service');
const { claimDeliverySql } = require('../dist/campaigns/delivery.worker');
const PostalMime = require('postal-mime').default ?? require('postal-mime');

async function main() {
  if (!process.env.DEMO_EMPLOYEE_PASSWORD || !process.env.DEMO_MANAGER_PASSWORD)
    throw new Error('Local demo accounts are required; run db:seed:local first.');
  process.env.SMTP_ENCRYPTION_KEY ||= randomBytes(32).toString('hex');
  process.env.PUBLIC_BASE_URL ||= 'http://localhost:3000';
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.use(cookieParser());
  await app.init();
  const api = request(app.getHttpServer());
  const saved = {};
  const suffix = randomBytes(5).toString('hex');
  const email = `smoke-${suffix}@example.invalid`;
  const suppressedEmail = `suppressed-${suffix}@example.invalid`;
  const check = (response, status) => {
    if (response.status !== status) throw new Error(`${response.req.method} ${response.req.path}: expected ${status}, got ${response.status}: ${JSON.stringify(response.body)}`);
    return response.body;
  };
  const login = async (address, password) => {
    const response = await api.post('/api/auth/login').send({ email: address, password });
    check(response, 200);
    return response.headers['set-cookie'][0].split(';')[0];
  };
  try {
    const employee = await login('minhanh@example.com', process.env.DEMO_EMPLOYEE_PASSWORD);
    const manager = await login('truongphong@example.com', process.env.DEMO_MANAGER_PASSWORD);
    check(await api.get('/api/dashboard').set('Cookie', employee), 403);
    check(await api.get('/api/dashboard').set('Cookie', manager), 200);
    check(await api.get('/api/notifications').set('Cookie', employee), 200);
    check(await api.get('/api/notifications').set('Cookie', manager), 200);
    check(await api.post('/api/contact-lists').set('Cookie', manager).send({}), 403);
    const criteria = { role: ['Founder'], industry: [], location: [], keyword: '', size: [], email: [], source: 'Google Search/Web' };
    check(await api.post('/api/filter-templates').set('Cookie', manager).send({ name: 'Denied', criteria }), 403);
    const filterTemplate = check(await api.post('/api/filter-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, criteria }), 201);
    saved.filterTemplateId = filterTemplate.id;
    check(await api.post('/api/filter-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, criteria }), 409);
    const emailTemplate = check(await api.post('/api/email-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, subject: 'Hello', body: 'Message' }), 201);
    saved.emailTemplateId = emailTemplate.id;
    const list = check(await api.post('/api/contact-lists').set('Cookie', employee).send({ name: `Smoke ${suffix}`, contacts: [{ email, fullName: 'Smoke Contact', company: 'Smoke Company' }, { email: suppressedEmail, fullName: 'Suppressed Contact' }] }), 201);
    saved.listId = list.id;
    saved.contactIds = list.contacts.map((contact) => contact.id);
    check(await api.patch(`/api/contact-lists/${list.id}/review`).set('Cookie', employee).send({ result: 'passed' }), 200);
    check(await api.post(`/api/contact-lists/${list.id}/confirm`).set('Cookie', employee), 201);
    check(await api.post(`/api/contact-lists/${list.id}/approval`).set('Cookie', manager).send({ decision: 'approved' }), 201);
    const sender = check(await api.post('/api/sender-accounts').set('Cookie', manager).send({ name: `Smoke ${suffix}`, email: `sender-${suffix}@example.invalid`, status: 'active', smtpHost: 'localhost', smtpPort: 2525, smtpUser: 'smoke', smtpPassword: 'test-only' }), 201);
    saved.senderId = sender.id;
    if ('smtp_secret' in sender) throw new Error('SMTP secret leaked from account response');
    check(await api.post(`/api/sender-accounts/${sender.id}/sync-inbox`).set('Cookie', employee), 403);
    check(await api.post(`/api/sender-accounts/${sender.id}/sync-inbox`).set('Cookie', manager), 409);
    check(await api.post('/api/sender-accounts').set('Cookie', manager).send({ name: 'Duplicate', email: sender.email }), 409);
    const suppressed = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Suppressed Contact', email: suppressedEmail, kind: 'unsubscribe', content: 'Please unsubscribe' }), 201);
    saved.suppressedResponseId = suppressed.id;
    const campaign = check(await api.post('/api/campaigns').set('Cookie', employee).send({ name: `Smoke campaign ${suffix}`, listIds: [Number(list.id)] }), 201);
    saved.campaignId = campaign.id;
    if (campaign.recipient_count !== 1) throw new Error('Recipient filtering failed');
    check(await api.patch(`/api/campaigns/${campaign.id}/content`).set('Cookie', employee).send({ subject: 'Xin chào {{Họ tên}}', body: 'Chào {{Họ tên}} tại {{Tên doanh nghiệp}}' }), 200);
    const brochure = check(await api.post(`/api/campaigns/${campaign.id}/assets`).set('Cookie', employee).field('kind', 'pdf').attach('file', Buffer.from('%PDF-1.4\nSmoke test'), 'brochure.pdf'), 201);
    if (brochure.kind !== 'pdf' || brochure.size_bytes !== 19) throw new Error('Campaign PDF upload failed');
    const preview = check(await api.post(`/api/campaigns/${campaign.id}/preview`).set('Cookie', employee).send({}), 201);
    if (preview.subject !== 'Xin chào Smoke Contact') throw new Error('Preview personalization failed');
    if (preview.assets.length !== 1) throw new Error('Preview did not include attachment');
    check(await api.patch(`/api/campaigns/${campaign.id}/sender`).set('Cookie', employee).send({ senderAccountId: Number(sender.id) }), 200);
    check(await api.patch(`/api/campaigns/${campaign.id}/schedule`).set('Cookie', employee).send({ scheduledAt: new Date(Date.now() + 30 * 60000).toISOString() }), 200);
    check(await api.post(`/api/campaigns/${campaign.id}/confirm`).set('Cookie', employee), 201);
    const validity = String(parseInt(suffix, 16));
    saved.inboundAccountId = sender.id;
    saved.inboundValidity = validity;
    saved.inboundResponseIds = [];
    const dbForInbox = new Client({ host: process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    await dbForInbox.connect();
    try {
      await dbForInbox.query('EXPLAIN ' + claimDeliverySql);
      await dbForInbox.query("INSERT INTO email_deliveries(campaign_id,contact_id,sender_account_id,state,provider_message_id,sent_at) VALUES($1,$2,$3,'sent',$4,now())", [campaign.id, saved.contactIds[0], sender.id, `<smoke-${suffix}@example.invalid>`]);
      await dbForInbox.query('INSERT INTO imap_cursors(sender_account_id,uid_validity,last_uid) VALUES($1,$2,0)', [sender.id, validity]);
    } finally { await dbForInbox.end(); }
    const inbox = app.get(InboxService);
    const matchedMail = await PostalMime.parse(Buffer.from(`From: Smoke Contact <${email}>\r\nTo: ${sender.email}\r\nSubject: Re: Smoke campaign\r\nMessage-ID: <reply-${suffix}@example.invalid>\r\nIn-Reply-To: <smoke-${suffix}@example.invalid>\r\n\r\nI am interested`));
    if (await inbox.store({ id: sender.id }, validity, 1, matchedMail, new Date()) !== 1) throw new Error('IMAP reply was not linked to campaign');
    if (await inbox.store({ id: sender.id }, validity, 1, matchedMail, new Date()) !== 0) throw new Error('IMAP reply was imported twice');
    const inboxResponses = check(await api.get('/api/responses').set('Cookie', employee), 200);
    const matchedResponse = inboxResponses.find((item) => item.email === email && String(item.campaign_id) === String(campaign.id));
    if (!matchedResponse) throw new Error(`IMAP response correlation failed: ${JSON.stringify(inboxResponses.map(({ email, campaign_id, content }) => ({ email, campaign_id, content })))}`);
    saved.inboundResponseIds.push(matchedResponse.id);
    const unmatchedMail = await PostalMime.parse(Buffer.from(`From: Unknown <unknown-${suffix}@example.invalid>\r\nTo: ${sender.email}\r\nSubject: Question\r\nMessage-ID: <unknown-${suffix}@example.invalid>\r\n\r\nPlease call me`));
    if (await inbox.store({ id: sender.id }, validity, 2, unmatchedMail, new Date()) !== 0) throw new Error('Unmatched IMAP mail was linked unexpectedly');
    check(await api.get('/api/inbox/unmatched').set('Cookie', employee), 403);
    const unmatched = check(await api.get('/api/inbox/unmatched').set('Cookie', manager), 200);
    if (!unmatched.some((item) => item.uid === '2' || item.uid === 2)) throw new Error('Unmatched IMAP mail missing');
    const assigned = check(await api.post(`/api/inbox/${sender.id}/${validity}/2/assign`).set('Cookie', manager).send({ employeeId: 'NV001', kind: 'other' }), 201);
    saved.inboundResponseIds.push(assigned.response_id);
    const response = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Smoke Contact', email, kind: 'interested', content: 'Interested', campaignId: Number(campaign.id) }), 201);
    saved.responseId = response.id;
    const followup = check(await api.post('/api/followups').set('Cookie', employee).send({ responseId: Number(response.id) }), 201);
    saved.followupId = followup.id;
    check(await api.post('/api/followups').set('Cookie', employee).send({ responseId: Number(response.id) }), 409);
    check(await api.patch(`/api/followups/${followup.id}/complete`).set('Cookie', employee).send({ note: 'Called customer', needsNext: false }), 200);
    check(await api.post(`/api/responses/${response.id}/interactions`).set('Cookie', employee).send({ channel: 'note', content: 'Follow-up done' }), 201);
    const sms = check(await api.post(`/api/responses/${response.id}/interactions`).set('Cookie', employee).send({ channel: 'sms', content: 'Đã gửi SMS thủ công' }), 201);
    if (sms.channel !== 'sms') throw new Error('Manual SMS interaction was not saved');
    const responseDetail = check(await api.get(`/api/responses/${response.id}`).set('Cookie', employee), 200);
    if (responseDetail.status !== 'replied' || !responseDetail.interactions.some((item) => item.id === sms.id && item.channel === 'sms')) throw new Error('Manual SMS history or response status is incorrect');
    check(await api.post(`/api/responses/${response.id}/hide`).set('Cookie', employee), 409);
    check(await api.delete(`/api/filter-templates/${filterTemplate.id}`).set('Cookie', employee), 200);
    saved.filterTemplateId = null;
    check(await api.delete(`/api/email-templates/${emailTemplate.id}`).set('Cookie', employee), 200);
    saved.emailTemplateId = null;
    console.log('Smoke passed: roles, templates, list approval, sender, campaign assets, preview, scheduling, IMAP matching, Response, Follow-up.');
  } finally {
    await app.close();
    const db = new Client({ host: process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    await db.connect();
    try {
      if (saved.inboundAccountId) {
        await db.query('DELETE FROM inbound_messages WHERE sender_account_id=$1 AND uid_validity=$2', [saved.inboundAccountId, saved.inboundValidity]);
        await db.query('DELETE FROM imap_cursors WHERE sender_account_id=$1', [saved.inboundAccountId]);
      }
      if (saved.inboundResponseIds) for (const id of saved.inboundResponseIds) await db.query('DELETE FROM responses WHERE id=$1', [id]);
      if (saved.filterTemplateId) await db.query('DELETE FROM filter_templates WHERE id=$1', [saved.filterTemplateId]);
      if (saved.emailTemplateId) await db.query('DELETE FROM email_templates WHERE id=$1', [saved.emailTemplateId]);
      if (saved.responseId) {
        await db.query('DELETE FROM followups WHERE response_id=$1', [saved.responseId]);
        await db.query('DELETE FROM response_interactions WHERE response_id=$1', [saved.responseId]);
        await db.query('DELETE FROM responses WHERE id=$1', [saved.responseId]);
      }
      if (saved.suppressedResponseId) await db.query('DELETE FROM responses WHERE id=$1', [saved.suppressedResponseId]);
      if (saved.campaignId) {
        await db.query('DELETE FROM followups WHERE response_id IN (SELECT id FROM responses WHERE campaign_id=$1)', [saved.campaignId]);
        await db.query('DELETE FROM response_interactions WHERE response_id IN (SELECT id FROM responses WHERE campaign_id=$1)', [saved.campaignId]);
        await db.query('DELETE FROM responses WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM email_deliveries WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaign_recipients WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaign_lists WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaigns WHERE id=$1', [saved.campaignId]);
      }
      if (saved.listId) {
        await db.query('DELETE FROM contact_list_items WHERE list_id=$1', [saved.listId]);
        await db.query('DELETE FROM contact_lists WHERE id=$1', [saved.listId]);
      }
      if (saved.contactIds) for (const id of saved.contactIds) await db.query('DELETE FROM contacts WHERE id=$1', [id]);
      await db.query('DELETE FROM email_suppressions WHERE email=$1', [suppressedEmail]);
      if (saved.senderId) await db.query('DELETE FROM sender_accounts WHERE id=$1', [saved.senderId]);
    } finally { await db.end(); }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
