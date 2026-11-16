# API nội bộ (Nhân viên và Trưởng phòng)

Base URL: `http://localhost:3000`. Các endpoint `/api/*` (trừ đăng nhập và ngừng nhận email) cần cookie phiên `v5_session`. Trình duyệt gọi qua Vite `/api` và tự gửi cookie cùng origin. Dữ liệu trả về dùng tên cột `snake_case` của PostgreSQL; ID kiểu `bigint` được JSON hóa thành chuỗi, khi gửi lại qua JSON cần chuyển thành số nguyên an toàn.

## Đăng nhập

| Method | URL | Nội dung |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ "email": "...", "password": "..." }`; đặt cookie HTTP-only |
| GET | `/api/auth/me` | Vai trò và email của phiên hiện tại |
| POST | `/api/auth/logout` | Ẩn phiên và cookie |

## Contact

Filter Template: Nhân viên dùng `GET/POST /api/filter-templates`, `GET/PATCH/DELETE /api/filter-templates/:id`. Dữ liệu tạo/sửa gồm `name` và `criteria` với các khóa `role`, `industry`, `location`, `size`, `email` (mảng chuỗi), `keyword` (chuỗi), `source` (chuỗi). Cần ít nhất một tiêu chí; endpoint chỉ lưu mẫu, không gọi Google Search.

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET | `/api/contact-lists` | Cả hai | Danh sách thuộc nhân viên; Trưởng phòng xem tất cả |
| GET | `/api/contact-lists/:id` | Cả hai | Chi tiết kèm Contact |
| POST | `/api/contact-lists` | Nhân viên | `{ "name": "...", "criteria": {}, "contacts": [{ "email": "...", "fullName": "...", "company": "..." }] }` |
| PATCH | `/api/contact-lists/:id/review` | Nhân viên | `{ "result": "passed" }` hoặc `failed` |
| POST | `/api/contact-lists/:id/confirm` | Nhân viên | Xác nhận sau khi `passed` |
| POST | `/api/contact-lists/:id/approval` | Trưởng phòng | `{ "decision": "approved" }` hoặc `rejected` kèm `comment` |

## Tài khoản gửi và mẫu email

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET | `/api/sender-accounts` | Cả hai | Nhân viên chỉ thấy tài khoản `active`; trả số đã dùng trong ngày (GMT+7) |
| GET | `/api/sender-accounts/:id` | Cả hai | Chi tiết, không trả mật khẩu SMTP |
| POST/PATCH | `/api/sender-accounts` hoặc `/:id` | Trưởng phòng | `name`, `email`, `status`, `quotaDaily`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`, `inboundEnabled` |
| POST | `/api/sender-accounts/:id/verify` | Trưởng phòng | Kiểm tra kết nối SMTP, không gửi email |
| POST | `/api/sender-accounts/:id/verify-inbox` | Trưởng phòng | Kiểm tra kết nối Gmail IMAP |
| POST | `/api/sender-accounts/:id/sync-inbox` | Trưởng phòng | Đồng bộ email mới ngay; lần đầu chỉ khởi tạo con trỏ |
| DELETE | `/api/sender-accounts/:id` | Trưởng phòng | Chỉ khi tài khoản chưa gắn chiến dịch |
| GET/POST | `/api/email-templates` | Cả hai / Nhân viên | Mẫu email; tạo bằng `name`, `subject`, `body`, thêm `campaignId` nếu nội dung có ảnh |
| PATCH/DELETE | `/api/email-templates/:id` | Chủ mẫu | Sửa hoặc Ẩn mẫu của mình; khi sửa nội dung có ảnh phải gửi `campaignId` chứa ảnh |
| POST | `/api/email-templates/:id/apply` | Nhân viên | `{ "campaignId": 1 }`; sao chép ảnh của mẫu vào chiến dịch và trả `subject`, `body` với ID ảnh mới |

`smtpPassword` chỉ gửi qua kết nối HTTPS ở môi trường thật. Máy chủ mã hóa bằng `SMTP_ENCRYPTION_KEY`; API không trả khóa hoặc mật khẩu. Gmail có thể cấu hình `smtp.gmail.com:465` nếu tài khoản được phép dùng SMTP và phương thức xác thực phù hợp.

Gmail IMAP kết nối `imap.gmail.com:993`, dùng OAuth khi tài khoản đã liên kết Google; nếu chưa liên kết thì dùng tên đăng nhập và mật khẩu ứng dụng đã mã hóa. Sau khi bật `inboundEnabled`, lần đồng bộ đầu tiên bắt đầu tại cuối INBOX hiện có, nên thư cũ không được nhập. Mỗi lượt lấy tối đa 50 thư mới, chỉ tải nội dung thư tối đa 2 MB; thư không ghép được với email đã gửi xuất hiện trong hàng chờ của Trưởng phòng.

### Phân loại Response từ IMAP

Khi thư mới ghép được với chiến dịch, BE tự gán `kind` từ phần trả lời tiếng Việt/Anh. Không cần cấu hình thêm hoặc API AI. Phân loại bỏ qua tiêu đề chiến dịch, phần trích dẫn Gmail/Outlook/chuyển tiếp và các dấu kết thúc/chữ ký phổ biến; nội dung lưu trong Response không bị cắt theo bước này (vẫn áp dụng giới hạn lưu 100.000 ký tự hiện có).

| Ví dụ nội dung mới | `kind` |
| --- | --- |
| Tôi cần thêm thông tin / Gửi tôi báo giá | `need_info` |
| Tôi quan tâm / Muốn đặt lịch tư vấn | `interested` |
| Tôi chưa có nhu cầu / Tôi không quan tâm | `not_interested` |
| Đừng gửi email cho tôi nữa / Unsubscribe | `unsubscribe` |
| Chưa rõ, có điều kiện, phủ định việc ngừng nhận hoặc ý định mâu thuẫn | `other` |

Yêu cầu ngừng nhận rõ ràng được ưu tiên và thêm vào danh sách chặn gửi, cập nhật `unsubscribed_at`. Câu hỏi về cách hủy, ví dụ được trích dẫn hoặc câu vừa yêu cầu ngừng vừa muốn nhận tiếp không tự chặn. `need_info` ưu tiên hơn `interested`; nếu vừa không quan tâm vừa yêu cầu thông tin thì để `other`. Vẫn giữ nhận diện thư tự động (`out_of_office`) và thông báo lỗi gửi (`bounce`) hiện có.

Response mới giữ trạng thái `new` và nhân viên phụ trách chiến dịch; nhãn không đồng nghĩa đã xử lý/đã phản hồi. Nhân viên có thể sửa nhãn theo quyền và trạng thái hiện có. Đồng bộ lại cùng UID không tạo bản sao hoặc ghi đè nhãn đã sửa. Không tự phân loại lại lịch sử. Đây là bộ quy tắc nhận diện cụm từ, không đảm bảo hiểu mọi cách diễn đạt; nhân viên cần kiểm tra `other`, thư trích dẫn/chữ ký không chuẩn và nội dung nhiều ý.

Đợt hiệu chỉnh 15/11/2026 bổ sung cách xin bảng giá/tài liệu, chủ thể “chúng tôi/bên mình/we”, phủ định có trạng từ, phủ định kép, lời thuật lại, câu chưa chắc chắn và dấu trích dẫn/chữ ký tiếng Việt. Câu hỏi về sự quan tâm không tự gán `interested`; câu hỏi xin thông tin rõ ràng vẫn nhận `need_info`. Bộ kiểm thử hồi quy có 102 test phân loại, bao gồm 30 biến thể định dạng/trích dẫn trong 5 test tham số hóa. Đây là dữ liệu kiểm thử tổng hợp do người phát triển đặt nhãn, không phải tập email thực tế độc lập để công bố độ chính xác. Chạy bằng `npm --prefix backend test -- --runInBand inbox.service.spec`. Chưa huấn luyện mô hình học máy hoặc gửi nội dung email tới dịch vụ AI.

## Chiến dịch

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET | `/api/campaigns`, `/api/campaigns/:id` | Cả hai | Danh sách và chi tiết theo phạm vi |
| POST | `/api/campaigns` | Nhân viên | `{ "name": "...", "listIds": [1, 2] }`; chỉ nhận danh sách đã được duyệt, lọc trùng/đã từ chối/bounce/đã gửi trong 7 ngày |
| PATCH | `/api/campaigns/:id` | Chủ chiến dịch | Sửa `name`, `description` khi đang chuẩn bị, đã lên lịch hoặc tạm dừng; cả hai trường bắt buộc |
| PATCH | `/api/campaigns/:id/content` | Chủ chiến dịch | `{ "subject": "...", "body": "..." }`; hỗ trợ `{{Họ tên}}`, `{{Tên doanh nghiệp}}`, khối ảnh `[[Hình ảnh:ID]]`, nút `[[Nút:Tên|https://...]]` và `[[Đường phân cách]]`; cho phép sửa khi chuẩn bị hoặc tạm dừng |
| POST | `/api/campaigns/:id/preview` | Chủ chiến dịch | `{ "contactId": 1 }` hoặc `{}` để xem Contact đầu tiên; cần xem lại sau mỗi lần sửa nội dung, kể cả trước khi tiếp tục chiến dịch tạm dừng |
| GET/POST | `/api/campaigns/:id/assets` | Cả hai / Chủ chiến dịch | Xem danh sách hoặc tải multipart `kind=logo|pdf|image`, trường tệp `file`; ảnh nội dung PNG/JPG tối đa 2 MB, logo PNG/JPG/SVG tối đa 2 MB, tối đa 3 PDF mỗi tệp 10 MB; cho phép sửa khi chuẩn bị hoặc tạm dừng |
| GET/DELETE | `/api/campaigns/:id/assets/:assetId` | Cả hai / Chủ chiến dịch | Tải về hoặc Ẩn khi chiến dịch đang chuẩn bị hoặc tạm dừng |
| PATCH | `/api/campaigns/:id/sender` | Chủ chiến dịch | `{ "senderAccountId": 1 }` |
| PATCH | `/api/campaigns/:id/schedule` | Chủ chiến dịch | `{ "scheduledAt": "2026-11-12T02:00:00.000Z" }` để hẹn trước ít nhất 15 phút, hoặc `{ "sendNow": true }` để bắt đầu ngay sau xác nhận |
| POST | `/api/campaigns/:id/confirm` | Chủ chiến dịch | Xác nhận lịch gửi sau khi hoàn tất các bước |
| POST | `/api/campaigns/:id/pause`, `/:id/resume` | Chủ/Trưởng phòng | Tạm dừng với `{ "reason": "..." }` tùy chọn, tối đa 250 ký tự; lưu thời điểm và lý do. Tiếp tục các email chưa gửi; nếu đã sửa nội dung/tệp khi tạm dừng, phải xem trước lại |
| DELETE | `/api/campaigns/:id` | Chủ chiến dịch | Chỉ trước khi có lần thử gửi, kể cả chiến dịch đã tạm dừng |

Worker gửi tối đa 50 email/giờ và hạn mức mặc định 100 email/ngày trên mỗi tài khoản. Khi chọn tài khoản, xác nhận hoặc tiếp tục chiến dịch, API kiểm tra hạn mức còn lại đủ cho số email chưa gửi; chiến dịch đang tạm dừng có thể đổi tài khoản gửi. Lịch hẹn gửi trong khung 08:00–17:00 GMT+7; lựa chọn Gửi ngay bắt đầu sau khi xác nhận kể cả ngoài khung giờ hẹn. Gửi dở sau sự cố được tạm dừng để đối chiếu, không tự thử lại khi kết quả SMTP chưa xác định.
Logo PNG/JPG và ảnh nội dung được nhúng vào HTML email bằng CID; SVG được đính kèm dạng tệp vì nhiều trình đọc email không hiển thị SVG nội tuyến. PDF được gửi như tệp đính kèm. Nếu tổng dung lượng vượt giới hạn nhà cung cấp SMTP, chiến dịch sẽ tạm dừng và ghi lỗi gửi; cần kiểm tra trước khi tiếp tục.
Các dấu định dạng từ thanh công cụ soạn thảo (`**đậm**`, `_nghiêng_`, `~gạch chân~`) được dựng thành HTML khi gửi. Ảnh nội dung không còn được tham chiếu sẽ không đính kèm vào email.

## Response, Follow-up và báo cáo

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET/POST | `/api/responses` | Cả hai / Nhân viên | Liệt kê theo người phụ trách; thêm ngoại tuyến bằng `customerName`, `content`, `email?`, `phone?`, `campaignId?`; loại mặc định `other` |
| GET/PATCH | `/api/responses/:id` | Phụ trách | Xem lịch sử tương tác, gửi email và trạng thái; sửa tên khách hàng, email, số điện thoại, nội dung khi `new` hoặc `processing`; trạng thái theo `new → processing → replied → closed` |
| POST | `/api/responses/:id/reply` | Phụ trách | `{ "senderAccountId": 1, "subject": "...", "content": "..." }`; gửi email qua SMTP, lưu trạng thái gửi và lịch sử; không gửi tới Response từ chối/rác/bounce |
| POST | `/api/responses/:id/interactions` | Phụ trách | `{ "channel": "sms|note", "content": "..." }`; ghi SMS đã gửi ngoài hệ thống hoặc ghi chú; SMS cập nhật trạng thái `replied` |
| POST | `/api/responses/:id/hide` | Phụ trách | Chỉ ẩn spam/unsubscribe chưa phản hồi và chưa có Follow-up |
| PATCH | `/api/responses/:id/assignee` | Trưởng phòng | `{ "employeeId": "NV001" }` |
| GET/POST | `/api/followups` | Cả hai / Nhân viên | Danh sách; tạo bằng `responseId`, `goal`, `channel?`, `dueAt?`, `reminderMinutes?`, `waitDays?`, `maxAttempts?`, `intervalDays?`, `note?`; mặc định sau 2 ngày làm việc |
| GET | `/api/followups/:id` | Phụ trách/Trưởng phòng | Chi tiết |
| PATCH | `/api/followups/:id/complete` | Phụ trách | `{ "note": "...", "needsNext": false }`; chờ phản hồi đủ số ngày cấu hình rồi mới tạo lịch kế tiếp nếu cần, tối đa 3 lần |
| DELETE | `/api/followups/:id` | Phụ trách | Chỉ lịch `pending`; chuyển `cancelled`, giữ lịch sử |
| GET | `/api/dashboard?period=week|month` | Trưởng phòng | Số liệu tổng hợp |
| GET | `/api/notifications` | Cả hai | Cảnh báo hiện tại: Follow-up quá hạn, Response mới, chiến dịch tạm dừng, danh sách chờ duyệt và tài khoản bị khóa |
| GET | `/api/inbox/unmatched` | Trưởng phòng | Thư đến chưa ghép với chiến dịch |
| POST | `/api/inbox/:accountId/:validity/:uid/assign` | Trưởng phòng | `{ "employeeId": "NV001", "kind": "other", "campaignId": 1 }`; gắn thư thành Response |
| POST | `/api/inbox/:accountId/:validity/:uid/ignore` | Trưởng phòng | Ẩn thư không liên quan khỏi hàng chờ |

`GET /api/unsubscribe/:token` mở trang xác nhận, `POST` ngừng nhận email. Các màn nghiệp vụ của Nhân viên và Trưởng phòng đã gọi API khi đăng nhập thật; chế độ `?preview=` chỉ dùng để xem bản thiết kế. Google Search, Apollo và gửi SMS chưa được triển khai.

### Gmail OAuth (Trưởng phòng)

| Method | Endpoint | Hành vi |
|---|---|---|
| GET | `/api/sender-accounts/google/status` | `{configured: boolean}`, không trả secrets |
| POST | `/api/sender-accounts/:id/google/connect` | `{url}` để chuyển đến Google; state ràng buộc phiên, PKCE và tài khoản |
| GET | `/api/sender-accounts/google/callback` | Google trả code/state hoặc error; kiểm tra phiên, scope và danh tính rồi redirect 303 về FE với mã kết quả, không có token |
| POST | `/api/sender-accounts/:id/google/disconnect` | Ẩn token cục bộ, hủy phiên liên kết đang chờ, ngừng hoạt động và tắt IMAP; không thu hồi grant Google |

Tài khoản gửi trả thêm `google_status`: `null`, `connected`, `reconnect_required`. `configured` hỗ trợ cả App Password và OAuth. Không trả refresh token. Khi đã liên kết Google, không sửa email/SMTP/mật khẩu trước khi ngắt kết nối. Các endpoint kiểm tra SMTP, IMAP, gửi chiến dịch và phản hồi tự dùng OAuth khi có liên kết; không fallback mật khẩu nếu OAuth hết quyền.


## Google Search/Web — Nhân viên

Các endpoint `/api/contact-searches` yêu cầu SessionGuard và role employee; chỉ đọc job/lịch sử của chủ sở hữu.

| Method | URL | Nội dung |
| --- | --- | --- |
| GET | `/api/contact-searches/capabilities` | configured, source, emailVerification=source_and_syntax, catchAll=false, sizeHardFilter=false; không trả key |
| POST | `/api/contact-searches` | `{criteria:{role:[],industry:[],location:[],size:[],email:[],keyword:"phần mềm",source:"Google Search/Web"},requestKey:"UUID"}` → 202 job; dùng lại requestKey khi mất response |
| GET | `/api/contact-searches/history?cursor=ID` | 25 lần/job của chủ sở hữu, gồm queued/running/failed/succeeded; cursor=ID cuối để tải tiếp |
| GET | `/api/contact-searches/:id` | criteria snapshot, status/stage, processed, received/invalid/duplicate/new_count, results, warnings, list_id, error, timestamps |

queued → running → succeeded/failed. Không dùng phần trăm giả. Khóa idempotency cùng owner + cùng payload trả lại job; khác payload 409. Một owner chỉ có một job chưa xong. Lease 150 giây, job timeout 120 giây, tối đa 2 lần claim sau gián đoạn. Khi succeeded: received=invalid+duplicate+new_count. Email không hợp lệ xếp trước trùng. Contact tồn tại không ghi đè. Danh sách chỉ tạo khi có Contact mới và giữ trạng thái chưa kiểm tra/chưa duyệt. Toàn bộ Contact/list/result commit cùng transaction.

Các trạng thái lỗi: 400 tiêu chí/requestKey/cursor sai, 401 thiếu phiên, 403 sai role, 404 không sở hữu/không có job, 409 job khác đang chạy hoặc key khác payload, 503 thiếu key. Provider/crawler lỗi sau khi nhận job được lưu status failed và safe error, không giả kết quả rỗng. Website lỗi một phần được lưu warnings, thành công chỉ phản ánh phạm vi đã đọc. Không có email mới vẫn lưu job succeeded với list_id=null.

contacts có thêm search_provenance: emailStatus, method=inferred, industry, evidence, companySize/sizeMethod/sizeNote và publicEmailCount. Quy mô `public-email-count-proxy-v1` gán khoảng 1–10/11–50/51–200/201–500 theo khoảng số email đã quan sát; ngoài 1–500 để null. Đây là proxy chưa hiệu chuẩn, luôn “Chưa đảm bảo”, không phải số nhân viên thật và không lọc cứng. Không đoán địa chỉ email. Email chung không gán chức vụ cá nhân. API danh sách Contact trả metadata này; xuất danh sách có nguồn và ghi chú khi chứa Contact từ tìm kiếm.

Thiết kế ban đầu ở tasks/ chỉ là đề xuất; các endpoint thực tế ở mục này và source là hợp đồng đã triển khai. Lần thử live SerpAPI chưa chạy vì thiếu key; không xem fixtures là bằng chứng chất lượng Google thật.

### Hạn mức ngày

Hạn mức được đặt lại lúc 00:00 theo `Asia/Ho_Chi_Minh`. Số đã dùng cộng cả chiến dịch và phản hồi email, gồm thư đã gửi trong ngày và các lượt đang gửi chưa xác định kết quả (kể cả bắt đầu trước 00:00); thư lỗi không chiếm hạn mức. Dữ liệu đọc dùng `quota_daily`, `used_today`, `quota_warning`; ghi dùng `quotaDaily` (1–100). Cột lưu trữ `quota_3_days`, thuộc tính cũ `used_3_days` và tham số `quota3Days` được giữ để tương thích phiên bản cũ, nhưng cùng mang ý nghĩa hạn mức ngày. Không cần đổi giá trị cấu hình hiện có hay chạy migration.
