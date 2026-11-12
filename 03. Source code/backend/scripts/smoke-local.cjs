const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { InboxService } = require('../dist/inbox/inbox.service');
const { SmtpService } = require('../dist/senders/smtp.service');
const { FollowupWorker } = require('../dist/followups/followup.worker');
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
    check(await api.get('/api/auth/me').set('Cookie', employee), 200);
    check(await api.get('/api/auth/me').set('Cookie', manager), 200);
    const disposableSession = await login('minhanh@example.com', process.env.DEMO_EMPLOYEE_PASSWORD);
    check(await api.post('/api/auth/logout').set('Cookie', disposableSession), 204);
    check(await api.get('/api/auth/me').set('Cookie', disposableSession), 401);
    check(await api.get('/health'), 200);
    check(await api.get('/'), 200);
    check(await api.get('/api/dashboard').set('Cookie', employee), 403);
    check(await api.get('/api/dashboard').set('Cookie', manager), 200);
    check(await api.get('/api/dashboard?period=month').set('Cookie', manager), 200);
    check(await api.get('/api/dashboard?period=invalid').set('Cookie', manager), 400);
    check(await api.get('/api/notifications').set('Cookie', employee), 200);
    check(await api.get('/api/notifications').set('Cookie', manager), 200);
    check(await api.post('/api/contact-lists').set('Cookie', manager).send({}), 403);
    const criteria = { role: ['Founder'], industry: [], location: [], keyword: '', size: [], email: [], source: 'Google Search/Web' };
    check(await api.post('/api/filter-templates').set('Cookie', manager).send({ name: 'Denied', criteria }), 403);
    const filterTemplate = check(await api.post('/api/filter-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, criteria }), 201);
    saved.filterTemplateId = filterTemplate.id;
    if (!check(await api.get('/api/filter-templates').set('Cookie', employee), 200).some((item) => item.id === filterTemplate.id)) throw new Error('Filter Template list is missing saved item');
    check(await api.get(`/api/filter-templates/${filterTemplate.id}`).set('Cookie', employee), 200);
    check(await api.patch(`/api/filter-templates/${filterTemplate.id}`).set('Cookie', employee).send({ criteria: { ...criteria, keyword: 'updated' } }), 200);
    check(await api.post('/api/filter-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, criteria }), 409);
    const emailTemplate = check(await api.post('/api/email-templates').set('Cookie', employee).send({ name: `Smoke ${suffix}`, subject: 'Hello', body: 'Message' }), 201);
    saved.emailTemplateId = emailTemplate.id;
    if (!check(await api.get('/api/email-templates').set('Cookie', employee), 200).some((item) => item.id === emailTemplate.id)) throw new Error('Email Template list is missing saved item');
    check(await api.patch(`/api/email-templates/${emailTemplate.id}`).set('Cookie', employee).send({ subject: 'Updated hello' }), 200);
    const list = check(await api.post('/api/contact-lists').set('Cookie', employee).send({ name: `Smoke ${suffix}`, contacts: [{ email, fullName: 'Smoke Contact', company: 'Smoke Company' }, { email: suppressedEmail, fullName: 'Suppressed Contact' }] }), 201);
    saved.listId = list.id;
    saved.contactIds = list.contacts.map((contact) => contact.id);
    if (!check(await api.get('/api/contact-lists').set('Cookie', employee), 200).some((item) => item.id === list.id)) throw new Error('Contact List is missing saved item');
    check(await api.get(`/api/contact-lists/${list.id}`).set('Cookie', manager), 200);
    check(await api.patch(`/api/contact-lists/${list.id}/review`).set('Cookie', employee).send({ result: 'passed' }), 200);
    check(await api.post(`/api/contact-lists/${list.id}/confirm`).set('Cookie', employee), 201);
    check(await api.post(`/api/contact-lists/${list.id}/approval`).set('Cookie', manager).send({ decision: 'approved' }), 201);
    const sender = check(await api.post('/api/sender-accounts').set('Cookie', manager).send({ name: `Smoke ${suffix}`, email: `sender-${suffix}@example.invalid`, status: 'active', smtpHost: 'localhost', smtpPort: 2525, smtpUser: 'smoke', smtpPassword: 'test-only' }), 201);
    saved.senderId = sender.id;
    if ('smtp_secret' in sender) throw new Error('SMTP secret leaked from account response');
    if (!check(await api.get('/api/sender-accounts').set('Cookie', manager), 200).some((item) => item.id === sender.id)) throw new Error('Sender list is missing saved item');
    check(await api.get(`/api/sender-accounts/${sender.id}`).set('Cookie', employee), 200);
    check(await api.patch(`/api/sender-accounts/${sender.id}`).set('Cookie', manager).send({ name: `Updated Smoke ${suffix}` }), 200);
    app.get(SmtpService).verify = async () => {};
    check(await api.post(`/api/sender-accounts/${sender.id}/verify`).set('Cookie', manager), 201);
    const disposableSender = check(await api.post('/api/sender-accounts').set('Cookie', manager).send({ name: `Disposable ${suffix}`, email: `disposable-${suffix}@example.invalid` }), 201);
    saved.disposableSenderId = disposableSender.id;
    check(await api.delete(`/api/sender-accounts/${disposableSender.id}`).set('Cookie', manager), 200);
    saved.disposableSenderId = null;
    check(await api.post(`/api/sender-accounts/${sender.id}/sync-inbox`).set('Cookie', employee), 403);
    check(await api.post(`/api/sender-accounts/${sender.id}/sync-inbox`).set('Cookie', manager), 409);
    check(await api.post('/api/sender-accounts').set('Cookie', manager).send({ name: 'Duplicate', email: sender.email }), 409);
    const suppressed = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Suppressed Contact', email: suppressedEmail, kind: 'unsubscribe', content: 'Please unsubscribe' }), 201);
    saved.suppressedResponseId = suppressed.id;
    const tokenDb = new Client({ host: process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    await tokenDb.connect();
    const unsubscribeToken = (await tokenDb.query('SELECT unsubscribe_token FROM contacts WHERE id=$1', [saved.contactIds[1]])).rows[0].unsubscribe_token;
    await tokenDb.end();
    const confirmationPage = await api.get(`/api/unsubscribe/${unsubscribeToken}`);
    check(confirmationPage, 200);
    if (!confirmationPage.text.includes('Ngừng nhận email')) throw new Error('Unsubscribe confirmation failed');
    const unsubscribeResult = await api.post(`/api/unsubscribe/${unsubscribeToken}`);
    check(unsubscribeResult, 201);
    if (!unsubscribeResult.text.includes('Đã ngừng nhận email')) throw new Error('Unsubscribe result failed');
    const campaign = check(await api.post('/api/campaigns').set('Cookie', employee).send({ name: `Smoke campaign ${suffix}`, listIds: [Number(list.id)] }), 201);
    saved.campaignId = campaign.id;
    if (campaign.recipient_count !== 1) throw new Error('Recipient filtering failed');
    const disposableCampaign = check(await api.post('/api/campaigns').set('Cookie', employee).send({ name: `Disposable campaign ${suffix}`, listIds: [Number(list.id)] }), 201);
    saved.disposableCampaignId = disposableCampaign.id;
    check(await api.delete(`/api/campaigns/${disposableCampaign.id}`).set('Cookie', employee), 200);
    saved.disposableCampaignId = null;
    if (!check(await api.get('/api/campaigns').set('Cookie', employee), 200).some((item) => item.id === campaign.id)) throw new Error('Campaign list is missing saved item');
    check(await api.get(`/api/campaigns/${campaign.id}`).set('Cookie', manager), 200);
    check(await api.patch(`/api/campaigns/${campaign.id}/content`).set('Cookie', employee).send({ subject: 'Xin chào {{Họ tên}}', body: 'Chào {{Họ tên}} tại {{Tên doanh nghiệp}}' }), 200);
    const brochure = check(await api.post(`/api/campaigns/${campaign.id}/assets`).set('Cookie', employee).field('kind', 'pdf').attach('file', Buffer.from('%PDF-1.4\nSmoke test'), 'brochure.pdf'), 201);
    if (brochure.kind !== 'pdf' || brochure.size_bytes !== 19) throw new Error('Campaign PDF upload failed');
    if (!check(await api.get(`/api/campaigns/${campaign.id}/assets`).set('Cookie', employee), 200).some((item) => item.id === brochure.id)) throw new Error('Campaign asset list is missing saved file');
    check(await api.get(`/api/campaigns/${campaign.id}/assets/${brochure.id}`).set('Cookie', employee), 200);
    const preview = check(await api.post(`/api/campaigns/${campaign.id}/preview`).set('Cookie', employee).send({}), 201);
    if (preview.subject !== 'Xin chào Smoke Contact') throw new Error('Preview personalization failed');
    if (preview.assets.length !== 1) throw new Error('Preview did not include attachment');
    check(await api.delete(`/api/campaigns/${campaign.id}/assets/${brochure.id}`).set('Cookie', employee), 200);
    check(await api.post(`/api/campaigns/${campaign.id}/preview`).set('Cookie', employee).send({}), 201);
    check(await api.patch(`/api/campaigns/${campaign.id}/sender`).set('Cookie', employee).send({ senderAccountId: Number(sender.id) }), 200);
    check(await api.patch(`/api/campaigns/${campaign.id}/schedule`).set('Cookie', employee).send({ scheduledAt: new Date(Date.now() + 30 * 60000).toISOString() }), 200);
    check(await api.post(`/api/campaigns/${campaign.id}/confirm`).set('Cookie', employee), 201);
    check(await api.post(`/api/campaigns/${campaign.id}/pause`).set('Cookie', employee), 201);
    check(await api.post(`/api/campaigns/${campaign.id}/resume`).set('Cookie', employee), 201);
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
    if (await inbox.store({ id: sender.id }, validity, 3, unmatchedMail, new Date()) !== 0) throw new Error('Second unmatched IMAP mail was linked unexpectedly');
    check(await api.post(`/api/inbox/${sender.id}/${validity}/3/ignore`).set('Cookie', manager), 201);
    app.get(InboxService).verify = async () => {};
    app.get(InboxService).sync = async () => ({ imported: 0 });
    check(await api.patch(`/api/sender-accounts/${sender.id}`).set('Cookie', manager).send({ inboundEnabled: true }), 200);
    check(await api.post(`/api/sender-accounts/${sender.id}/verify-inbox`).set('Cookie', manager), 201);
    check(await api.post(`/api/sender-accounts/${sender.id}/sync-inbox`).set('Cookie', manager), 201);
    const response = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Smoke Contact', email, kind: 'interested', content: 'Interested', campaignId: Number(campaign.id) }), 201);
    saved.responseId = response.id;
    check(await api.patch(`/api/responses/${response.id}/assignee`).set('Cookie', manager).send({ employeeId: 'NV001' }), 200);
    check(await api.patch(`/api/responses/${response.id}`).set('Cookie', employee).send({ status: 'closed' }), 409);
    check(await api.post(`/api/responses/${response.id}/interactions`).set('Cookie', employee).send({ channel: 'email', content: 'Must send through SMTP' }), 400);
    check(await api.post(`/api/responses/${response.id}/reply`).set('Cookie', manager).send({ senderAccountId: Number(sender.id), subject: 'Reply', content: 'Hello' }), 403);
    check(await api.post(`/api/responses/${suppressed.id}/reply`).set('Cookie', employee).send({ senderAccountId: Number(sender.id), subject: 'Reply', content: 'Hello' }), 409);
    const blockedReply = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Blocked Contact', email: suppressedEmail, kind: 'need_info', content: 'Question' }), 201);
    saved.blockedReplyId = blockedReply.id;
    check(await api.post(`/api/responses/${blockedReply.id}/reply`).set('Cookie', employee).send({ senderAccountId: Number(sender.id), subject: 'Reply', content: 'Hello' }), 409);
    const hidden = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Spam Contact', email: `spam-${suffix}@example.invalid`, kind: 'spam', content: 'Spam' }), 201);
    saved.hiddenResponseId = hidden.id;
    check(await api.post(`/api/responses/${hidden.id}/hide`).set('Cookie', employee), 201);
    if (check(await api.get('/api/responses').set('Cookie', employee), 200).some((item) => item.id === hidden.id)) throw new Error('Hidden Response is still listed');
    app.get(SmtpService).send = async () => '<smoke-reply@example.invalid>';
    check(await api.post(`/api/responses/${response.id}/reply`).set('Cookie', employee).send({ senderAccountId: Number(sender.id), subject: 'Reply', content: 'Hello' }), 201);
    const sentResponse = check(await api.get(`/api/responses/${response.id}`).set('Cookie', employee), 200);
    if (sentResponse.email_deliveries[0]?.state !== 'sent' || !sentResponse.interactions.some((item) => item.channel === 'email' && item.content === 'Hello')) throw new Error('SMTP reply or interaction history failed');
    const followup = check(await api.post('/api/followups').set('Cookie', employee).send({ responseId: Number(response.id), channel: 'phone', goal: 'Call customer', reminderMinutes: 30, waitDays: 2, maxAttempts: 3, intervalDays: 2 }), 201);
    saved.followupId = followup.id;
    if (followup.channel !== 'phone' || followup.goal !== 'Call customer' || followup.reminder_minutes !== 30) throw new Error('Follow-up settings were not persisted');
    check(await api.get(`/api/followups/${followup.id}`).set('Cookie', employee), 200);
    check(await api.post('/api/followups').set('Cookie', employee).send({ responseId: Number(response.id), goal: 'Call customer' }), 409);
    check(await api.patch(`/api/followups/${followup.id}/complete`).set('Cookie', employee).send({ note: 'Called customer', needsNext: false }), 200);
    check(await api.patch(`/api/followups/${followup.id}/note`).set('Cookie', employee).send({ note: 'Updated result note' }), 200);
    if (check(await api.get(`/api/followups/${followup.id}`).set('Cookie', employee), 200).note !== 'Updated result note') throw new Error('Follow-up note was not saved');
    const waiting = check(await api.post('/api/responses').set('Cookie', employee).send({ customerName: 'Follow-up Contact', email: `follow-${suffix}@example.invalid`, kind: 'need_info', content: 'Waiting' }), 201);
    saved.waitingResponseId = waiting.id;
    check(await api.patch(`/api/responses/${waiting.id}`).set('Cookie', employee).send({ status: 'processing', content: 'Waiting for callback' }), 200);
    const waitingFollowup = check(await api.post('/api/followups').set('Cookie', employee).send({ responseId: Number(waiting.id), channel: 'phone', goal: 'Call again', waitDays: 1, intervalDays: 2, maxAttempts: 2 }), 201);
    check(await api.patch(`/api/followups/${waitingFollowup.id}/complete`).set('Cookie', employee).send({ note: 'No answer', needsNext: true }), 200);
    const followDb = new Client({ host: process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    await followDb.connect();
    try { await followDb.query("UPDATE followups SET completed_at=now()-interval '2 days' WHERE id=$1", [waitingFollowup.id]); }
    finally { await followDb.end(); }
    await app.get(FollowupWorker).tick();
    const resolvedFollowups = check(await api.get('/api/followups').set('Cookie', employee), 200).filter((item) => item.response_id === waiting.id);
    if (resolvedFollowups.length !== 2 || resolvedFollowups.find((item) => item.id === waitingFollowup.id)?.outcome !== 'no_response' || !resolvedFollowups.some((item) => item.attempt === 2 && item.status === 'pending')) throw new Error('Follow-up wait period or next attempt failed');
    const nextFollowup = resolvedFollowups.find((item) => item.attempt === 2);
    check(await api.delete(`/api/followups/${nextFollowup.id}`).set('Cookie', employee), 200);
    if (check(await api.get(`/api/followups/${nextFollowup.id}`).set('Cookie', employee), 200).status !== 'cancelled') throw new Error('Follow-up cancellation removed history');
    check(await api.post(`/api/responses/${response.id}/interactions`).set('Cookie', employee).send({ channel: 'note', content: 'Follow-up done' }), 201);
    const sms = check(await api.post(`/api/responses/${response.id}/interactions`).set('Cookie', employee).send({ channel: 'sms', content: 'Đã gửi SMS thủ công' }), 201);
    if (sms.channel !== 'sms') throw new Error('Manual SMS interaction was not saved');
    const responseDetail = check(await api.get(`/api/responses/${response.id}`).set('Cookie', employee), 200);
    if (responseDetail.status !== 'replied' || !responseDetail.interactions.some((item) => item.id === sms.id && item.channel === 'sms')) throw new Error('Manual SMS history or response status is incorrect');
    if (!responseDetail.status_history.some((item) => item.from_status === 'new' && item.to_status === 'replied')) throw new Error('Response status history missing');
    check(await api.patch(`/api/responses/${response.id}`).set('Cookie', employee).send({ status: 'closed' }), 200);
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
        await db.query('DELETE FROM response_status_history WHERE response_id=$1', [saved.responseId]);
        await db.query('DELETE FROM response_email_deliveries WHERE response_id=$1', [saved.responseId]);
        await db.query('DELETE FROM responses WHERE id=$1', [saved.responseId]);
      }
      if (saved.waitingResponseId) {
        await db.query('DELETE FROM followups WHERE response_id=$1', [saved.waitingResponseId]);
        await db.query('DELETE FROM response_status_history WHERE response_id=$1', [saved.waitingResponseId]);
        await db.query('DELETE FROM responses WHERE id=$1', [saved.waitingResponseId]);
      }
      if (saved.suppressedResponseId) await db.query('DELETE FROM responses WHERE id=$1', [saved.suppressedResponseId]);
      if (saved.blockedReplyId) await db.query('DELETE FROM responses WHERE id=$1', [saved.blockedReplyId]);
      if (saved.hiddenResponseId) await db.query('DELETE FROM responses WHERE id=$1', [saved.hiddenResponseId]);
      if (saved.campaignId) {
        await db.query('DELETE FROM followups WHERE response_id IN (SELECT id FROM responses WHERE campaign_id=$1)', [saved.campaignId]);
        await db.query('DELETE FROM response_interactions WHERE response_id IN (SELECT id FROM responses WHERE campaign_id=$1)', [saved.campaignId]);
        await db.query('DELETE FROM response_status_history WHERE response_id IN (SELECT id FROM responses WHERE campaign_id=$1)', [saved.campaignId]);
        await db.query('DELETE FROM responses WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM email_deliveries WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaign_recipients WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaign_lists WHERE campaign_id=$1', [saved.campaignId]);
        await db.query('DELETE FROM campaigns WHERE id=$1', [saved.campaignId]);
      }
      if (saved.disposableCampaignId) {
        await db.query('DELETE FROM campaign_recipients WHERE campaign_id=$1', [saved.disposableCampaignId]);
        await db.query('DELETE FROM campaign_lists WHERE campaign_id=$1', [saved.disposableCampaignId]);
        await db.query('DELETE FROM campaigns WHERE id=$1', [saved.disposableCampaignId]);
      }
      if (saved.listId) {
        await db.query('DELETE FROM contact_list_items WHERE list_id=$1', [saved.listId]);
        await db.query('DELETE FROM contact_lists WHERE id=$1', [saved.listId]);
      }
      if (saved.contactIds) for (const id of saved.contactIds) await db.query('DELETE FROM contacts WHERE id=$1', [id]);
      await db.query('DELETE FROM email_suppressions WHERE email=$1', [suppressedEmail]);
      if (saved.senderId) await db.query('DELETE FROM sender_accounts WHERE id=$1', [saved.senderId]);
      if (saved.disposableSenderId) await db.query('DELETE FROM sender_accounts WHERE id=$1', [saved.disposableSenderId]);
    } finally { await db.end(); }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
