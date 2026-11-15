const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { SmtpService } = require('../dist/senders/smtp.service');

const client = new Client({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  connectionTimeoutMillis: 3000,
});

async function insert(sql, values) {
  const result = await client.query(`${sql} RETURNING id`, values);
  return result.rows[0].id;
}

function searchContactName(index) {
  const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Đỗ', 'Vũ', 'Ngô'];
  const givenNames = ['Minh Anh', 'Quang Huy', 'Thu Hà', 'Bảo Ngọc', 'Thanh Tùng', 'Hải Yến'];
  return `${surnames[(index - 1) % surnames.length]} ${givenNames[Math.floor((index - 1) / surnames.length)]}`;
}

async function updateExistingSampleLabels() {
  const names = {
    contact_lists: ['Khách hàng phần mềm B2B', 'Danh sách chờ Trưởng phòng duyệt', 'Danh sách cần rà soát lại', 'Kết quả tìm kiếm 48 Contact', 'Danh sách không đạt kiểm tra'],
    filter_templates: ['Công nghệ miền Bắc', 'Nhà sáng lập'],
    email_templates: ['Giới thiệu sản phẩm', 'Bản tin định kỳ'],
    sender_accounts: ['Marketing V5', 'Tài khoản dự phòng', 'Tài khoản bị khóa'],
    campaigns: ['Giới thiệu giải pháp B2B', 'Webinar bảo mật dữ liệu', 'Bản tin tháng trước', 'Chiến dịch đang soạn email', 'Chiến dịch đã lên lịch'],
  };
  for (const [table, labels] of Object.entries(names)) {
    for (const label of labels) await client.query(`UPDATE ${table} SET name=$2 WHERE name=$1`, [`[Demo] ${label}`, label]);
  }
  for (const kind of ['out_of_office', 'other', 'spam', 'unsubscribe', 'bounce']) {
    const contact = await client.query('SELECT full_name FROM contacts WHERE email=$1', [`contact${{ out_of_office: 5, other: 6, spam: 7, unsubscribe: 8, bounce: 4 }[kind]}@example.invalid`]);
    if (contact.rows[0]) await client.query('UPDATE responses SET customer_name=$2 WHERE customer_name=$1', [`[Demo] ${kind}`, contact.rows[0].full_name]);
  }
  await client.query("UPDATE response_email_deliveries SET subject='Phản hồi khách hàng' WHERE subject='[Demo] Phản hồi khách hàng'");
  for (const [oldEmail, newEmail] of [
    ['demo.sender@example.invalid', 'marketing@example.invalid'],
    ['demo.backup@example.invalid', 'backup@example.invalid'],
    ['demo.blocked@example.invalid', 'blocked@example.invalid'],
  ]) await client.query('UPDATE sender_accounts SET email=$2,smtp_user=CASE WHEN smtp_user=$1 THEN $2 ELSE smtp_user END WHERE email=$1', [oldEmail, newEmail]);
  const oldContactEmails = [
    ...Array.from({ length: 8 }, (_, index) => `demo.contact${index + 1}@example.invalid`),
    ...Array.from({ length: 48 }, (_, index) => `demo.search${String(index + 1).padStart(2, '0')}@example.invalid`),
  ];
  await client.query("UPDATE contacts SET email=replace(email,'demo.','') WHERE email=ANY($1::text[])", [oldContactEmails]);
  for (let i = 1; i <= 48; i++) {
    await client.query('UPDATE contacts SET full_name=$3 WHERE email=$1 AND full_name IN ($2,$4)', [`search${String(i).padStart(2, '0')}@example.invalid`, `Khách hàng ${String(i).padStart(2, '0')}`, searchContactName(i), `Contact mẫu ${String(i).padStart(2, '0')}`]);
  }
  await client.query("UPDATE responses SET email=replace(email,'demo.','') WHERE email=ANY($1::text[])", [oldContactEmails]);
  await client.query("UPDATE inbound_messages SET sender_email='unknown@example.invalid' WHERE sender_email='demo.unknown@example.invalid'");
  await client.query("UPDATE email_suppressions SET email='contact8@example.invalid' WHERE email='demo.contact8@example.invalid'");
}

async function seedAdditionalScreens() {
  const existing = await client.query("SELECT 1 FROM contact_lists WHERE owner_id='NV001' AND name='Kết quả tìm kiếm 48 Contact'");
  if (existing.rowCount) return false;

  const criteria = { role: ['Giám đốc Marketing', 'Founder', 'Quản lý'], industry: ['Công nghệ'], location: ['Hà Nội', 'TP. Hồ Chí Minh'], size: [], email: [], keyword: 'giải pháp B2B', source: 'Google Search/Web' };
  const searchList = await insert("INSERT INTO contact_lists(name,owner_id,criteria) VALUES($1,'NV001',$2)", ['Kết quả tìm kiếm 48 Contact', JSON.stringify(criteria)]);
  const failedList = await insert("INSERT INTO contact_lists(name,owner_id,criteria,employee_review) VALUES($1,'NV001',$2,'failed')", ['Danh sách không đạt kiểm tra', JSON.stringify(criteria)]);
  const companies = ['Sao Việt Tech', 'Cloud Harbor', 'BluePeak Software', 'Northstar Labs', 'Meridian Digital', 'OrbitWorks', 'Aster Analytics', 'Vina Cloud Systems'];
  const jobs = ['Giám đốc Marketing', 'Founder', 'Quản lý', 'Trưởng phòng Marketing'];
  const locations = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương'];
  for (let i = 1; i <= 48; i++) {
    const contactId = await insert(
      'INSERT INTO contacts(email,full_name,job_title,company,location,source_url) VALUES($1,$2,$3,$4,$5,$6)',
      [`search${String(i).padStart(2, '0')}@example.invalid`, searchContactName(i), jobs[(i - 1) % jobs.length], companies[(i - 1) % companies.length], locations[(i - 1) % locations.length], `https://example.invalid/search/${i}`],
    );
    await client.query('INSERT INTO contact_list_items(list_id,contact_id) VALUES($1,$2)', [searchList, contactId]);
    if (i <= 3) await client.query('INSERT INTO contact_list_items(list_id,contact_id) VALUES($1,$2)', [failedList, contactId]);
  }

  const base = await client.query("SELECT id,name FROM contact_lists WHERE owner_id='NV001' AND name='Khách hàng phần mềm B2B'");
  const approvedList = base.rows[0]?.id;
  if (!approvedList) throw new Error('The base demo Contact list is missing.');
  const baseContacts = (await client.query("SELECT id,email,full_name FROM contacts WHERE email LIKE 'contact%@example.invalid' ORDER BY id")).rows;
  const sender = (await client.query("SELECT id FROM sender_accounts WHERE email='marketing@example.invalid'")).rows[0]?.id;
  if (baseContacts.length !== 8 || !sender) throw new Error('The base demo Contacts or sender account are missing.');

  const preparing = await insert("INSERT INTO campaigns(name,owner_id,status) VALUES($1,'NV001','approved')", ['Chiến dịch đang soạn email']);
  const scheduled = await insert("INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id,scheduled_at) VALUES($1,'NV001','scheduled',$2,$3,now(),$4,now()+interval '30 days')", ['Chiến dịch đã lên lịch', 'Lời chào dành cho {{Họ tên}}', 'Xin chào {{Họ tên}}, chúng tôi xin gửi thông tin về giải pháp B2B.', sender]);
  for (const campaignId of [preparing, scheduled]) {
    await client.query('INSERT INTO campaign_lists(campaign_id,list_id) VALUES($1,$2)', [campaignId, approvedList]);
    for (const contact of baseContacts.slice(0, 2)) await client.query('INSERT INTO campaign_recipients(campaign_id,contact_id) VALUES($1,$2)', [campaignId, contact.id]);
  }

  const responseData = [
    [baseContacts[4], 'out_of_office', 'processing', 'Tôi đang đi công tác và sẽ phản hồi sau.'],
    [baseContacts[5], 'other', 'new', 'Vui lòng liên hệ lại vào tuần tới.'],
    [baseContacts[6], 'spam', 'new', 'Nội dung không liên quan đến chiến dịch.'],
    [baseContacts[7], 'unsubscribe', 'closed', 'Vui lòng ngừng gửi email đến địa chỉ này.'],
    [baseContacts[3], 'bounce', 'new', 'Hộp thư không nhận được email.'],
  ];
  const responseIds = [];
  for (const [contact, kind, status, content] of responseData) responseIds.push(await insert(
    "INSERT INTO responses(contact_id,customer_name,email,kind,status,assignee_id,content) VALUES($1,$2,$3,$4,$5,'NV001',$6)",
    [contact.id, contact.full_name, contact.email, kind, status, content],
  ));
  const originalResponses = (await client.query("SELECT id,customer_name FROM responses WHERE assignee_id='NV001' AND customer_name IN ('Nguyễn Minh Khang','Lê Quang Duy') ORDER BY id")).rows;
  if (originalResponses.length !== 2) throw new Error('The base responses are missing.');
  await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,outcome,completed_at,channel,goal,note) VALUES($1,'NV001',now()-interval '2 days',1,'done','responded',now()-interval '1 day','email',$2,$3)", [originalResponses[0].id, 'Trao đổi nhu cầu giải pháp', 'Khách hàng đã phản hồi.']);
  await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,outcome,completed_at,channel,goal,note) VALUES($1,'NV001',now()-interval '3 days',1,'done','no_response',now()-interval '1 day','phone',$2,$3)", [responseIds[0], 'Liên hệ sau khi khách hàng trở lại', 'Chưa nhận được phản hồi.']);
  await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,channel,goal,note) VALUES($1,'NV001',now()+interval '1 day',1,'cancelled','sms',$2,$3)", [responseIds[1], 'Nhắn lịch hẹn', 'Lịch đã hủy.']);
  await client.query("INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,'NV001','email',$2)", [originalResponses[1].id, 'Cảm ơn bạn đã phản hồi. Chúng tôi sẽ liên hệ sớm.']);
  await client.query("INSERT INTO response_email_deliveries(response_id,sender_account_id,actor_id,subject,content,state,provider_message_id,sent_at) VALUES($1,$2,'NV001',$3,$4,'sent',$5,now()-interval '2 days')", [originalResponses[1].id, sender, 'Phản hồi khách hàng', 'Cảm ơn bạn đã phản hồi. Chúng tôi sẽ liên hệ sớm.', '<sample-response@example.invalid>']);
  return true;
}

async function seed() {
  await client.connect();
  try {
    await client.query('BEGIN');
    const accounts = await client.query("SELECT id FROM employees WHERE id IN ('NV001','TP001')");
    if (accounts.rowCount !== 2) throw new Error('Run db:seed:local before seeding demo data.');
    await updateExistingSampleLabels();
    const existing = await client.query("SELECT id FROM contact_lists WHERE owner_id='NV001' AND name='Khách hàng phần mềm B2B'");
    if (existing.rowCount) {
      const added = await seedAdditionalScreens();
      await client.query('COMMIT');
      console.log(added ? 'Added sample records for the remaining employee and manager screens.' : 'Sample records already exist; no new records were added.');
      return;
    }
    const contacts = [
      ['Nguyễn Minh Khang', 'Giám đốc Marketing', 'Sao Việt Tech', 'Hà Nội'],
      ['Trần Hà Linh', 'Founder', 'Cloud Harbor', 'TP. Hồ Chí Minh'],
      ['Lê Quang Duy', 'Trưởng phòng Marketing', 'BluePeak Software', 'Đà Nẵng'],
      ['Phạm Thu An', 'Quản lý', 'Northstar Labs', 'Hà Nội'],
      ['Hoàng Bảo Ngọc', 'Giám đốc Marketing', 'Meridian Digital', 'TP. Hồ Chí Minh'],
      ['Đỗ Thanh Tùng', 'Founder', 'OrbitWorks', 'Đà Nẵng'],
      ['Vũ Mai Phương', 'Quản lý', 'Aster Analytics', 'Hà Nội'],
      ['Ngô Đức Long', 'Trưởng phòng Marketing', 'Vina Cloud Systems', 'Bình Dương'],
    ];
    const contactIds = [];
    for (let i = 0; i < contacts.length; i++) {
      const [name, job, company, location] = contacts[i];
      const email = `contact${i + 1}@example.invalid`;
      contactIds.push(await insert(
        'INSERT INTO contacts(email,full_name,job_title,company,location,source_url) VALUES($1,$2,$3,$4,$5,$6)',
        [email, name, job, company, location, `https://example.invalid/company/${i + 1}`],
      ));
    }
    const criteria = { role: ['Giám đốc Marketing', 'Founder'], industry: ['Công nghệ'], location: ['Hà Nội'], size: [], email: [], keyword: 'phần mềm B2B', source: 'Google Search/Web' };
    const approved = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at,manager_review,reviewed_by,reviewed_at) VALUES($1,'NV001',$2,'passed',now(),'approved','TP001',now())",
      ['Khách hàng phần mềm B2B', JSON.stringify(criteria)],
    );
    const pending = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at) VALUES($1,'NV001',$2,'passed',now())",
      ['Danh sách chờ Trưởng phòng duyệt', JSON.stringify(criteria)],
    );
    const rejected = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at,manager_review,manager_comment,reviewed_by,reviewed_at) VALUES($1,'NV001',$2,'passed',now(),'rejected',$3,'TP001',now())",
      ['Danh sách cần rà soát lại', JSON.stringify(criteria), 'Cần bổ sung thông tin công ty và kiểm tra email.'],
    );
    for (const [listId, indexes] of [[approved, [0, 1, 2, 3, 4, 7]], [pending, [5, 6]], [rejected, [7]]]) {
      for (const index of indexes) await client.query('INSERT INTO contact_list_items(list_id,contact_id) VALUES($1,$2)', [listId, contactIds[index]]);
    }
    await client.query("UPDATE contacts SET unsubscribed_at=now() WHERE id=$1", [contactIds[7]]);
    await client.query("INSERT INTO email_suppressions(email,reason) VALUES('contact8@example.invalid','unsubscribe') ON CONFLICT DO NOTHING");
    await insert("INSERT INTO filter_templates(owner_id,name,criteria) VALUES('NV001',$1,$2)", ['Công nghệ miền Bắc', JSON.stringify(criteria)]);
    await insert("INSERT INTO filter_templates(owner_id,name,criteria) VALUES('NV001',$1,$2)", ['Nhà sáng lập', JSON.stringify({ ...criteria, role: ['Founder'], location: [] })]);
    await insert("INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,'NV001')", ['Giới thiệu sản phẩm', 'Giải pháp cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nChúng tôi muốn giới thiệu giải pháp phù hợp với {{Tên doanh nghiệp}}.']);
    await insert("INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,'NV001')", ['Bản tin định kỳ', 'Thông tin dành cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nĐây là bản tin cập nhật thông tin sản phẩm.']);
    const smtp = new SmtpService(new ConfigService(process.env));
    const secret = smtp.encrypt(randomBytes(24).toString('hex'));
    const sender = await insert(
      "INSERT INTO sender_accounts(name,email,status,quota_3_days,smtp_host,smtp_port,smtp_user,smtp_secret,inbound_enabled) VALUES($1,$2,'active',100,'127.0.0.2',2525,$2,$3,false)",
      ['Marketing V5', 'marketing@example.invalid', secret],
    );
    await insert("INSERT INTO sender_accounts(name,email,status,quota_3_days) VALUES($1,$2,'inactive',100)", ['Tài khoản dự phòng', 'backup@example.invalid']);
    await insert("INSERT INTO sender_accounts(name,email,status,quota_3_days) VALUES($1,$2,'blocked',100)", ['Tài khoản bị khóa', 'blocked@example.invalid']);
    const campaign = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id) VALUES($1,'NV001','approved',$2,$3,now(),$4)",
      ['Giới thiệu giải pháp B2B', 'Giải pháp cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nChúng tôi muốn giới thiệu giải pháp phù hợp.', sender],
    );
    const paused = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id,scheduled_at,paused_at,pause_reason) VALUES($1,'NV001','paused',$2,$3,now(),$4,now()+interval '30 days',now()-interval '1 day','Cần rà soát nội dung email trước khi gửi tiếp')",
      ['Webinar bảo mật dữ liệu', 'Mời {{Họ tên}} tham gia Webinar', 'Xin chào {{Họ tên}},\nMời bạn tham gia Webinar bảo mật dữ liệu.', sender],
    );
    const completed = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id,scheduled_at,sent_count,created_at) VALUES($1,'NV001','completed',$2,$3,now()-interval '3 days',$4,now()-interval '2 days',1,now()-interval '3 days')",
      ['Bản tin tháng trước', 'Bản tin dành cho {{Họ tên}}', 'Đây là nội dung bản tin tháng trước.', sender],
    );
    for (const id of [campaign, paused, completed]) await client.query('INSERT INTO campaign_lists(campaign_id,list_id) VALUES($1,$2)', [id, approved]);
    for (const [campaignId, indexes] of [[campaign, [0, 1, 2, 3, 4]], [paused, [0, 1]], [completed, [2]]]) {
      for (const index of indexes) await client.query('INSERT INTO campaign_recipients(campaign_id,contact_id,status,sent_at) VALUES($1,$2,$3,$4)', [campaignId, contactIds[index], campaignId === completed ? 'sent' : 'pending', campaignId === completed ? new Date(Date.now() - 2 * 86_400_000) : null]);
    }
    await client.query("INSERT INTO email_deliveries(campaign_id,contact_id,sender_account_id,state,provider_message_id,created_at,sent_at) VALUES($1,$2,$3,'sent',$4,now()-interval '2 days',now()-interval '2 days')", [completed, contactIds[2], sender, '<sample-delivery@example.invalid>']);
    const responseRows = [
      [campaign, contactIds[0], 'Nguyễn Minh Khang', 'contact1@example.invalid', 'interested', 'new', 'Tôi muốn tìm hiểu thêm về sản phẩm.'],
      [campaign, contactIds[1], 'Trần Hà Linh', 'contact2@example.invalid', 'need_info', 'processing', 'Vui lòng cung cấp bảng giá.'],
      [completed, contactIds[2], 'Lê Quang Duy', 'contact3@example.invalid', 'interested', 'replied', 'Cảm ơn, tôi đã nhận được bản tin.'],
      [completed, contactIds[3], 'Phạm Thu An', 'contact4@example.invalid', 'not_interested', 'closed', 'Hiện tại chúng tôi chưa có nhu cầu.'],
    ];
    const responses = [];
    for (const row of responseRows) responses.push(await insert(
      'INSERT INTO responses(campaign_id,contact_id,customer_name,email,kind,status,assignee_id,content) VALUES($1,$2,$3,$4,$5,$6,\'NV001\',$7)', row,
    ));
    await client.query("INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,'NV001','sms',$2)", [responses[2], 'Đã trao đổi với khách hàng qua SMS.']);
    await client.query("INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,'NV001','new','processing'),($1,'NV001','processing','replied')", [responses[2]]);
    await client.query("INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,'NV001','new','processing'),($1,'NV001','processing','replied'),($1,'NV001','replied','closed')", [responses[3]]);
    await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days) VALUES($1,'NV001',now()-interval '1 hour',1,'pending','phone',$2,60,2,3,2)", [responses[1], 'Gọi điện trao đổi bảng giá']);
    await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,note,completed_at,outcome,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days) VALUES($1,'NV001',now()-interval '1 day',1,'done',$2,now(),'awaiting','sms',$3,30,2,3,2)", [responses[2], 'Đã trao đổi qua SMS, đang chờ phản hồi.', 'Kiểm tra nhu cầu sau khi nhận bản tin']);
    await client.query("INSERT INTO inbound_messages(sender_account_id,uid_validity,uid,message_id,sender_email,subject,content,received_at) VALUES($1,'sample-inbox',1,$2,$3,$4,$5,now())", [sender, '<sample-inbox@example.invalid>', 'unknown@example.invalid', 'Yêu cầu tư vấn', 'Tôi muốn trao đổi thêm về dịch vụ.']);
    await seedAdditionalScreens();
    await client.query('COMMIT');
    console.log('Seeded sample records for employee and manager workflows.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
