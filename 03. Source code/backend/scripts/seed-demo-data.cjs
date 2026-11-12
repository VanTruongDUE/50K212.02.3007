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

async function seed() {
  await client.connect();
  try {
    await client.query('BEGIN');
    const accounts = await client.query("SELECT id FROM employees WHERE id IN ('NV001','TP001')");
    if (accounts.rowCount !== 2) throw new Error('Run db:seed:local before seeding demo data.');
    const existing = await client.query("SELECT id FROM contact_lists WHERE owner_id='NV001' AND name='[Demo] Khách hàng phần mềm B2B'");
    if (existing.rowCount) {
      // shortcut: a complete first transaction is read-only on rerun; import into a fresh local database to restore deleted demo rows.
      await client.query('COMMIT');
      console.log('Demo data already exists; no records were changed.');
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
      const email = `demo.contact${i + 1}@example.invalid`;
      contactIds.push(await insert(
        'INSERT INTO contacts(email,full_name,job_title,company,location,source_url) VALUES($1,$2,$3,$4,$5,$6)',
        [email, name, job, company, location, `https://example.invalid/company/${i + 1}`],
      ));
    }
    const criteria = { role: ['Giám đốc Marketing', 'Founder'], industry: ['Công nghệ'], location: ['Hà Nội'], size: [], email: [], keyword: 'phần mềm B2B', source: 'Google Search/Web' };
    const approved = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at,manager_review,reviewed_by,reviewed_at) VALUES($1,'NV001',$2,'passed',now(),'approved','TP001',now())",
      ['[Demo] Khách hàng phần mềm B2B', JSON.stringify(criteria)],
    );
    const pending = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at) VALUES($1,'NV001',$2,'passed',now())",
      ['[Demo] Danh sách chờ Trưởng phòng duyệt', JSON.stringify(criteria)],
    );
    const rejected = await insert(
      "INSERT INTO contact_lists(name,owner_id,criteria,employee_review,confirmed_at,manager_review,manager_comment,reviewed_by,reviewed_at) VALUES($1,'NV001',$2,'passed',now(),'rejected',$3,'TP001',now())",
      ['[Demo] Danh sách cần rà soát lại', JSON.stringify(criteria), 'Cần bổ sung thông tin công ty và kiểm tra email.'],
    );
    for (const [listId, indexes] of [[approved, [0, 1, 2, 3, 4, 7]], [pending, [5, 6]], [rejected, [7]]]) {
      for (const index of indexes) await client.query('INSERT INTO contact_list_items(list_id,contact_id) VALUES($1,$2)', [listId, contactIds[index]]);
    }
    await client.query("UPDATE contacts SET unsubscribed_at=now() WHERE id=$1", [contactIds[7]]);
    await client.query("INSERT INTO email_suppressions(email,reason) VALUES('demo.contact8@example.invalid','unsubscribe') ON CONFLICT DO NOTHING");
    await insert("INSERT INTO filter_templates(owner_id,name,criteria) VALUES('NV001',$1,$2)", ['[Demo] Công nghệ miền Bắc', JSON.stringify(criteria)]);
    await insert("INSERT INTO filter_templates(owner_id,name,criteria) VALUES('NV001',$1,$2)", ['[Demo] Nhà sáng lập', JSON.stringify({ ...criteria, role: ['Founder'], location: [] })]);
    await insert("INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,'NV001')", ['[Demo] Giới thiệu sản phẩm', 'Giải pháp cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nChúng tôi muốn giới thiệu giải pháp phù hợp với {{Tên doanh nghiệp}}.']);
    await insert("INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,'NV001')", ['[Demo] Bản tin định kỳ', 'Thông tin dành cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nĐây là bản tin mẫu phục vụ kiểm thử giao diện.']);
    const smtp = new SmtpService(new ConfigService(process.env));
    const secret = smtp.encrypt(randomBytes(24).toString('hex'));
    const sender = await insert(
      "INSERT INTO sender_accounts(name,email,status,quota_3_days,smtp_host,smtp_port,smtp_user,smtp_secret,inbound_enabled) VALUES($1,$2,'active',100,'127.0.0.2',2525,$2,$3,false)",
      ['[Demo] Marketing V5', 'demo.sender@example.invalid', secret],
    );
    await insert("INSERT INTO sender_accounts(name,email,status,quota_3_days) VALUES($1,$2,'inactive',100)", ['[Demo] Tài khoản dự phòng', 'demo.backup@example.invalid']);
    await insert("INSERT INTO sender_accounts(name,email,status,quota_3_days) VALUES($1,$2,'blocked',100)", ['[Demo] Tài khoản bị khóa', 'demo.blocked@example.invalid']);
    const campaign = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id) VALUES($1,'NV001','approved',$2,$3,now(),$4)",
      ['[Demo] Giới thiệu giải pháp B2B', 'Giải pháp cho {{Tên doanh nghiệp}}', 'Xin chào {{Họ tên}},\nĐây là chiến dịch mẫu.', sender],
    );
    const paused = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id,scheduled_at) VALUES($1,'NV001','paused',$2,$3,now(),$4,now()+interval '30 days')",
      ['[Demo] Webinar bảo mật dữ liệu', 'Mời {{Họ tên}} tham gia Webinar', 'Xin chào {{Họ tên}},\nMời bạn tham gia Webinar mẫu.', sender],
    );
    const completed = await insert(
      "INSERT INTO campaigns(name,owner_id,status,subject,body,previewed_at,sender_account_id,scheduled_at,sent_count,created_at) VALUES($1,'NV001','completed',$2,$3,now()-interval '3 days',$4,now()-interval '2 days',1,now()-interval '3 days')",
      ['[Demo] Bản tin tháng trước', 'Bản tin dành cho {{Họ tên}}', 'Đây là nội dung bản tin mẫu.', sender],
    );
    for (const id of [campaign, paused, completed]) await client.query('INSERT INTO campaign_lists(campaign_id,list_id) VALUES($1,$2)', [id, approved]);
    for (const [campaignId, indexes] of [[campaign, [0, 1, 2, 3, 4]], [paused, [0, 1]], [completed, [2]]]) {
      for (const index of indexes) await client.query('INSERT INTO campaign_recipients(campaign_id,contact_id,status,sent_at) VALUES($1,$2,$3,$4)', [campaignId, contactIds[index], campaignId === completed ? 'sent' : 'pending', campaignId === completed ? new Date(Date.now() - 2 * 86_400_000) : null]);
    }
    await client.query("INSERT INTO email_deliveries(campaign_id,contact_id,sender_account_id,state,provider_message_id,created_at,sent_at) VALUES($1,$2,$3,'sent',$4,now()-interval '2 days',now()-interval '2 days')", [completed, contactIds[2], sender, '<demo-delivery@example.invalid>']);
    const responseRows = [
      [campaign, contactIds[0], 'Nguyễn Minh Khang', 'demo.contact1@example.invalid', 'interested', 'new', 'Tôi muốn tìm hiểu thêm về sản phẩm.'],
      [campaign, contactIds[1], 'Trần Hà Linh', 'demo.contact2@example.invalid', 'need_info', 'processing', 'Vui lòng cung cấp bảng giá.'],
      [completed, contactIds[2], 'Lê Quang Duy', 'demo.contact3@example.invalid', 'interested', 'replied', 'Cảm ơn, tôi đã nhận được bản tin.'],
      [completed, contactIds[3], 'Phạm Thu An', 'demo.contact4@example.invalid', 'not_interested', 'closed', 'Hiện tại chúng tôi chưa có nhu cầu.'],
    ];
    const responses = [];
    for (const row of responseRows) responses.push(await insert(
      'INSERT INTO responses(campaign_id,contact_id,customer_name,email,kind,status,assignee_id,content) VALUES($1,$2,$3,$4,$5,$6,\'NV001\',$7)', row,
    ));
    await client.query("INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,'NV001','sms',$2)", [responses[2], 'Đã trao đổi với khách hàng qua SMS (dữ liệu mẫu).']);
    await client.query("INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,'NV001','new','processing'),($1,'NV001','processing','replied')", [responses[2]]);
    await client.query("INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,'NV001','new','processing'),($1,'NV001','processing','replied'),($1,'NV001','replied','closed')", [responses[3]]);
    await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days) VALUES($1,'NV001',now()-interval '1 hour',1,'pending','phone',$2,60,2,3,2)", [responses[1], 'Gọi điện trao đổi bảng giá']);
    await insert("INSERT INTO followups(response_id,assignee_id,due_at,attempt,status,note,completed_at,outcome,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days) VALUES($1,'NV001',now()-interval '1 day',1,'done',$2,now(),'awaiting','sms',$3,30,2,3,2)", [responses[2], 'Đã gửi SMS, đang chờ phản hồi.', 'Kiểm tra nhu cầu sau khi nhận bản tin']);
    await client.query("INSERT INTO inbound_messages(sender_account_id,uid_validity,uid,message_id,sender_email,subject,content,received_at) VALUES($1,'demo-sample',1,$2,$3,$4,$5,now())", [sender, '<demo-inbox@example.invalid>', 'demo.unknown@example.invalid', 'Yêu cầu tư vấn', 'Tôi muốn trao đổi thêm về dịch vụ.']);
    await client.query('COMMIT');
    console.log('Seeded demo data: 8 contacts, 3 lists, 2 filter templates, 2 email templates, 3 senders, 3 campaigns, 4 responses, 2 follow-ups, 1 unmatched inbox message.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
