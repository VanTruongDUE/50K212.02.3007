// Isolated provider/website fixtures; never calls SerpAPI or sends mail.
const {NestFactory}=require('@nestjs/core');
const {AppModule}=require('../dist/app.module');
const {SearchService}=require('../dist/search/search.service');
const {SerpProvider}=require('../dist/search/serp.provider');
const {WebReader}=require('../dist/search/web-reader');
const {DatabaseService}=require('../dist/database/database.service');
const {randomUUID}=require('node:crypto');
const cookieParser=require('cookie-parser');
const request=require('supertest');
for(const [path,name] of [['../dist/campaigns/delivery.worker','DeliveryWorker'],['../dist/inbox/inbox.service','InboxService'],['../dist/followups/followup.worker','FollowupWorker'],['../dist/search/search.service','SearchService']])require(path)[name].prototype.onModuleInit=function(){};
(async()=>{
const app=await NestFactory.create(AppModule,{logger:['error']});app.use(cookieParser());await app.init();
const db=app.get(DatabaseService),service=app.get(SearchService),provider=app.get(SerpProvider),api=request(app.getHttpServer());
const suffix=randomUUID().slice(0,8),one=`one-${suffix}@example.invalid`,two=`sales-${suffix}@example.invalid`,existing=`existing-${suffix}@example.invalid`;
const jobs=[],contacts=[],lists=[];
let mode='success';let calls=0;
const criteria={role:[],industry:[],location:[],size:[],email:[],keyword:'test '+suffix,source:'Google Search/Web'};
const check=(r,status)=>{if(r.status!==status)throw Error(`${r.req.path}: expected ${status}, got ${r.status}: ${JSON.stringify(r.body)}`);return r.body};
try{
 const login=async(email,password)=>{const r=await api.post('/api/auth/login').send({email,password});check(r,200);return r.headers['set-cookie'][0].split(';')[0]};
 const employee=await login('minhanh@example.com',process.env.DEMO_EMPLOYEE_PASSWORD),manager=await login('truongphong@example.com',process.env.DEMO_MANAGER_PASSWORD);
 check(await api.get('/api/contact-searches/history'),401);
 check(await api.get('/api/contact-searches/history').set('Cookie',manager),403);
 provider.configured=()=>false;
 const unavailable=check(await api.post('/api/contact-searches').set('Cookie',employee).send({criteria,requestKey:randomUUID()}),503);
 if(/SERPAPI|API_KEY|cấu hình|demo/i.test(unavailable.message))throw Error('Operational search failure exposed implementation details');
 provider.configured=()=>true;
 provider.search=async()=>{calls++;if(mode==='provider-failure')throw Error('Fixture provider unavailable');return {id:'fixture',urls:mode==='empty'?[]:['https://example.invalid/a','https://example.invalid/b'],next:null}};
 WebReader.prototype.read=async(url)=>{if(mode==='web-failure')throw Error('Fixture website unavailable');return {url,html:url.endsWith('/a')?`<p>Giám đốc Marketing ${one} Hà Nội</p><p>${existing}</p><a href="mailto:broken">Invalid</a>`:`<p>${one}</p><p>${two}</p>`}};
 const prior=await db.query('INSERT INTO contacts(email,company) VALUES($1,$2) RETURNING id',[existing,'Original company']);contacts.push(prior.rows[0].id);
 const make=async()=>{const key=randomUUID();const job=check(await api.post('/api/contact-searches').set('Cookie',employee).send({criteria,requestKey:key}),202);jobs.push(job.id);return {job,key}};
 const first=await make();check(await api.post('/api/contact-searches').set('Cookie',employee).send({criteria,requestKey:randomUUID()}),409);
 const replay=check(await api.post('/api/contact-searches').set('Cookie',employee).send({criteria,requestKey:first.key}),202);if(replay.id!==first.job.id)throw Error('Idempotency failed');
 check(await api.post('/api/contact-searches').set('Cookie',employee).send({criteria:{...criteria,keyword:'different'},requestKey:first.key}),409);
 await service.tick();const result=check(await api.get('/api/contact-searches/'+first.job.id).set('Cookie',employee),200);
 if(result.status!=='succeeded')throw Error('Expected success: '+result.error);
 lists.push(result.list_id);contacts.push(...result.results.map(c=>c.id));
 if(result.received!==5||result.invalid!==1||result.duplicate!==2||result.new_count!==2)throw Error('Invalid classification counts '+JSON.stringify({received:result.received,invalid:result.invalid,duplicate:result.duplicate,new:result.new_count}));
 if(!result.results.every(c=>c.search_provenance.emailStatus==='source_and_syntax'))throw Error('Missing provenance');
 if(!result.results.every(c=>[c.job_title,c.company,c.search_provenance.industry,c.search_provenance.companySize].every(v=>typeof v==='string'&&v.trim()&&!/mẫu|demo|giả lập/i.test(v))))throw Error('Missing search fallback metadata or visible sample labels');
 const list=check(await api.get('/api/contact-lists/'+result.list_id).set('Cookie',employee),200);if(list.employee_review!=='pending'||list.confirmed_at||list.manager_review!=='pending')throw Error('Search skipped review');
 const persisted=await db.query('SELECT job_title,company,search_provenance FROM contacts WHERE id=ANY($1::bigint[])',[result.results.map(c=>c.id)]);if(!persisted.rows.every(c=>c.job_title&&c.company&&c.search_provenance.industry&&c.search_provenance.companySize))throw Error('Search fallback metadata was not persisted');
 await service.detail('NV001',first.job.id);try{await service.detail('OTHER-OWNER',first.job.id);throw Error('Owner boundary failed')}catch(e){if(e.status!==404)throw e}
 check(await api.patch(`/api/contact-lists/${list.id}/review`).set('Cookie',employee).send({result:'passed'}),200);
 check(await api.post(`/api/contact-lists/${list.id}/confirm`).set('Cookie',employee),201);
 check(await api.post(`/api/contact-lists/${list.id}/approval`).set('Cookie',manager).send({decision:'approved'}),201);
 const second=await make();await service.tick();const duplicates=await service.detail('NV001',second.job.id);if(duplicates.list_id||duplicates.new_count||duplicates.duplicate!==4)throw Error('Duplicate-only search created a list');
 mode='empty';const empty=await make();await service.tick();const zero=await service.detail('NV001',empty.job.id);if(zero.status!=='succeeded'||zero.received!==0||zero.list_id)throw Error('Empty search handling failed');
 for(const failure of ['provider-failure','web-failure']){mode=failure;const item=await make();await service.tick();const failed=await service.detail('NV001',item.job.id);if(failed.status!=='failed'||failed.list_id||failed.results.length)throw Error('Failure persisted partial contacts');}
 mode='success';
 const rollbackEmail=`rollback-${suffix}@example.invalid`;
 WebReader.prototype.read=async(url)=>({url,html:`<p>${rollbackEmail}</p>`});
 const originalConnect=db.connect.bind(db);
 db.connect=async()=>{const client=await originalConnect();const query=client.query.bind(client);client.query=async(sql,...args)=>{if(typeof sql==='string'&&sql.includes("SET status='succeeded'"))throw Error('Fixture final write failed');return query(sql,...args)};const release=client.release.bind(client);client.release=()=>{client.query=query;release()};return client};
 const rollback=await make();await service.tick();db.connect=originalConnect;
 const rollbackResult=await service.detail('NV001',rollback.job.id);
 if(rollbackResult.status!=='failed'||(await db.query('SELECT 1 FROM contacts WHERE email=$1',[rollbackEmail])).rowCount)throw Error('Final persistence failure did not roll back Contacts');
 const expired=await make();await db.query("UPDATE contact_search_jobs SET status='running',attempts=2,lease_until=now()-interval '1 second' WHERE id=$1",[expired.job.id]);await service.tick();if((await service.detail('NV001',expired.job.id)).status!=='failed')throw Error('Expired job did not stop at attempt limit');
 const old=await db.query('SELECT company FROM contacts WHERE id=$1',[prior.rows[0].id]);if(old.rows[0].company!=='Original company')throw Error('Existing Contact overwritten');
 const history=check(await api.get('/api/contact-searches/history').set('Cookie',employee),200);if(!jobs.every(id=>history.some(row=>row.id===id)))throw Error('History missing attempts');
 check(await api.get('/api/contact-searches/history?cursor=bad').set('Cookie',employee),400);
 if(calls===0)throw Error('No provider fixture used');
 console.log('Search smoke passed: auth, owner, missing key, idempotency, counts, invalid-before-duplicate, provenance, empty/duplicate-only, provider/website failure, history, employee check and manager approval. DB rollback and expired lease limit. No external HTTP/email.');
}finally{
 if(jobs.length)await db.query('DELETE FROM contact_search_jobs WHERE id=ANY($1::bigint[])',[jobs]);
 if(lists.length)await db.query('DELETE FROM contact_lists WHERE id=ANY($1::bigint[])',[lists]);
 if(contacts.length)await db.query('DELETE FROM contacts WHERE id=ANY($1::bigint[])',[contacts]);
 await app.close();
}
})().catch(e=>{console.error(e.message);process.exitCode=1});
