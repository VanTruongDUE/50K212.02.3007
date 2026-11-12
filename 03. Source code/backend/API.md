# API nội bộ (Nhân viên và Trưởng phòng)

Base URL: `http://localhost:3000`. Các endpoint `/api/*` (trừ đăng nhập và ngừng nhận email) cần cookie phiên `v5_session`. Trình duyệt gọi qua Vite `/api` và tự gửi cookie cùng origin. Dữ liệu trả về dùng tên cột `snake_case` của PostgreSQL; ID kiểu `bigint` được JSON hóa thành chuỗi, khi gửi lại qua JSON cần chuyển thành số nguyên an toàn.

## Đăng nhập

| Method | URL | Nội dung |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ "email": "...", "password": "..." }`; đặt cookie HTTP-only |
| GET | `/api/auth/me` | Vai trò và email của phiên hiện tại |
| POST | `/api/auth/logout` | Xóa phiên và cookie |

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
| GET | `/api/sender-accounts` | Cả hai | Nhân viên chỉ thấy tài khoản `active`; trả số đã dùng trong 3 ngày |
| GET | `/api/sender-accounts/:id` | Cả hai | Chi tiết, không trả mật khẩu SMTP |
| POST/PATCH | `/api/sender-accounts` hoặc `/:id` | Trưởng phòng | `name`, `email`, `status`, `quota3Days`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`, `inboundEnabled` |
| POST | `/api/sender-accounts/:id/verify` | Trưởng phòng | Kiểm tra kết nối SMTP, không gửi email |
| POST | `/api/sender-accounts/:id/verify-inbox` | Trưởng phòng | Kiểm tra kết nối Gmail IMAP |
| POST | `/api/sender-accounts/:id/sync-inbox` | Trưởng phòng | Đồng bộ email mới ngay; lần đầu chỉ khởi tạo con trỏ |
| DELETE | `/api/sender-accounts/:id` | Trưởng phòng | Chỉ khi tài khoản chưa gắn chiến dịch |
| GET/POST | `/api/email-templates` | Cả hai / Nhân viên | Mẫu email; tạo bằng `name`, `subject`, `body` |
| PATCH/DELETE | `/api/email-templates/:id` | Chủ mẫu | Sửa hoặc xóa mẫu của mình |

`smtpPassword` chỉ gửi qua kết nối HTTPS ở môi trường thật. Máy chủ mã hóa bằng `SMTP_ENCRYPTION_KEY`; API không trả khóa hoặc mật khẩu. Gmail có thể cấu hình `smtp.gmail.com:465` nếu tài khoản được phép dùng SMTP và phương thức xác thực phù hợp.

Gmail IMAP dùng cùng tên đăng nhập và mật khẩu ứng dụng đã mã hóa của tài khoản gửi, kết nối `imap.gmail.com:993`. API hiện chưa hỗ trợ OAuth2; một số tài khoản Google không cho phép mật khẩu ứng dụng. Sau khi bật `inboundEnabled`, lần đồng bộ đầu tiên bắt đầu tại cuối INBOX hiện có, nên thư cũ không được nhập. Mỗi lượt lấy tối đa 50 thư mới, chỉ tải nội dung thư tối đa 2 MB; thư không ghép được với email đã gửi xuất hiện trong hàng chờ của Trưởng phòng.

## Chiến dịch

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET | `/api/campaigns`, `/api/campaigns/:id` | Cả hai | Danh sách và chi tiết theo phạm vi |
| POST | `/api/campaigns` | Nhân viên | `{ "name": "...", "listIds": [1, 2] }`; chỉ nhận danh sách đã được duyệt, lọc trùng/đã từ chối/bounce/đã gửi trong 7 ngày |
| PATCH | `/api/campaigns/:id/content` | Chủ chiến dịch | `{ "subject": "...", "body": "..." }`; hỗ trợ `{{Họ tên}}`, `{{Tên doanh nghiệp}}` |
| POST | `/api/campaigns/:id/preview` | Chủ chiến dịch | `{ "contactId": 1 }` hoặc `{}` để xem Contact đầu tiên; cần xem lại sau mỗi lần sửa nội dung |
| GET/POST | `/api/campaigns/:id/assets` | Cả hai / Chủ chiến dịch | Xem danh sách hoặc tải multipart `kind=logo|pdf`, trường tệp `file`; logo PNG/JPG/SVG tối đa 2 MB, tối đa 3 PDF mỗi tệp 10 MB |
| GET/DELETE | `/api/campaigns/:id/assets/:assetId` | Cả hai / Chủ chiến dịch | Tải về hoặc xóa trước khi xác nhận chiến dịch |
| PATCH | `/api/campaigns/:id/sender` | Chủ chiến dịch | `{ "senderAccountId": 1 }` |
| PATCH | `/api/campaigns/:id/schedule` | Chủ chiến dịch | `{ "scheduledAt": "2026-11-12T02:00:00.000Z" }` |
| POST | `/api/campaigns/:id/confirm` | Chủ chiến dịch | Xác nhận lịch gửi sau khi hoàn tất các bước |
| POST | `/api/campaigns/:id/pause`, `/:id/resume` | Chủ/Trưởng phòng | Tạm dừng hoặc tiếp tục các email chưa gửi |
| DELETE | `/api/campaigns/:id` | Chủ chiến dịch | Chỉ trước khi có lần thử gửi |

Worker gửi tối đa 50 email/giờ và hạn mức mặc định 100 email/3 ngày trên mỗi tài khoản, trong khung 08:00–17:00 GMT+7. Gửi dở sau sự cố được tạm dừng để đối chiếu, không tự thử lại khi kết quả SMTP chưa xác định.
Logo PNG/JPG được nhúng vào HTML email; SVG được đính kèm dạng tệp vì nhiều trình đọc email không hiển thị SVG nội tuyến. PDF được gửi như tệp đính kèm. Nếu tổng dung lượng vượt giới hạn nhà cung cấp SMTP, chiến dịch sẽ tạm dừng và ghi lỗi gửi; cần kiểm tra trước khi tiếp tục.

## Response, Follow-up và báo cáo

| Method | URL | Vai trò | Nội dung |
| --- | --- | --- | --- |
| GET/POST | `/api/responses` | Cả hai / Nhân viên | Liệt kê theo người phụ trách; thêm ngoại tuyến bằng `customerName`, `email`, `kind`, `content`, `campaignId?` |
| GET/PATCH | `/api/responses/:id` | Phụ trách | Xem lịch sử tương tác, gửi email và trạng thái; sửa nội dung khi `new` hoặc `processing`; trạng thái theo `new → processing → replied → closed` |
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

`GET /api/unsubscribe/:token` mở trang xác nhận, `POST` ngừng nhận email. Các màn nghiệp vụ của Nhân viên và Trưởng phòng đã gọi API khi đăng nhập thật; chế độ `?preview=` chỉ dùng để xem bản thiết kế. Google Search, Apollo, gửi SMS và OAuth2 Gmail chưa được triển khai.
