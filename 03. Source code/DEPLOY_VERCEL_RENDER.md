# Triển khai miễn phí: FE Vercel + API Render + Neon + SMTP gateway Vercel

FE public: `https://v5-marketing.vercel.app`. API nghiệp vụ và timer nền chạy trên Render Free; Neon Free lưu PostgreSQL; Vercel chỉ làm SMTP gateway để tránh giới hạn kết nối SMTP của Render Free. Không nâng gói có phí.

## Trạng thái đã xác nhận ngày 15/11/2026

- Neon project `v5-marketing-db`: 23 migration và hai tài khoản đăng nhập đã khởi tạo. Chưa chuyển dữ liệu nghiệp vụ local.
- SMTP gateway Vercel trả health 200 qua wrapper API ở Git root, framework Other, Root Directory để trống. Deployment đã nạp secret relay; kiểm tra SMTP qua FE → Render → gateway trả 201, `connected: true`.
- API `https://v5-marketing-api.onrender.com` Live, `/health` trả 200 và database up. Gmail IMAP trực tiếp qua Render trả 201, `connected: true`.
- FE rewrite `/api` sang Render hoạt động; hai lượt kiểm tra API trực tiếp Render và qua FE đều đạt 59/59 assertion, gồm đăng nhập hai vai trò và CRUD PostgreSQL thật.
- Đã chuyển đúng Gmail được yêu cầu từ local ID 164 sang cloud ID 1, mã hóa lại token bằng khóa cloud. Một campaign thử đã gửi đúng một thư, thư được thấy trong Inbox người nhận được phép; reply được IMAP tự động nhận sau khoảng 70 giây và ghép Response đúng. Không chuyển dữ liệu nghiệp vụ local. Chỉ reconnect khi Google báo hết hạn/thu hồi hoặc tài khoản chưa có quyền.

## API Render Free

Repository `VanTruongDUE/50K212.02.3007`; Root Directory `03. Source code/backend`; Node.js 24. Build `npm ci --include=dev && npm run build`; Start `node scripts/migrate.cjs && node dist/main.js`; health `/health`. Render cấp `PORT`; không đặt `VERCEL` trên Render để timer nền hoạt động. Free service có thể sleep; timer không chạy trong lúc sleep, nên không cam kết lịch gửi chính xác từng phút. Không dùng cron ping để coi như đã có worker luôn chạy.

| Biến API Render | Cách dùng |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL Neon, ưu tiên hơn `POSTGRES_*`; TLS `verify-full` |
| `PUBLIC_BASE_URL` | HTTPS origin phục vụ `/api/unsubscribe`: FE có rewrite đúng hoặc API Render thật |
| `FRONTEND_BASE_URL` | `https://v5-marketing.vercel.app` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://v5-marketing.vercel.app/api/sender-accounts/google/callback` |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Web client, chỉ ở backend |
| `SMTP_ENCRYPTION_KEY` | Khóa hex 32 byte của cloud; gateway phải dùng đúng cùng khóa |
| `REMOTE_SMTP_URL` | HTTPS origin SMTP gateway Vercel, không thêm `/api/internal/smtp` |
| `SMTP_RELAY_SECRET` | Secret giống gateway, khác `JOBS_SECRET` |
| `SERPAPI_API_KEY` | Key backend, tìm kiếm thật có thể tiêu credit |
| `JOBS_SECRET` | Chỉ dùng khi chủ động gọi job nội bộ qua Bearer |

Không đưa secret vào Git, `VITE_*`, log hoặc ảnh. Không trỏ dịch vụ public vào PostgreSQL máy cá nhân. Seed bằng `DATABASE_URL` chỉ thêm hai tài khoản chưa tồn tại, không reset mật khẩu/vai trò. Không chạy `db:seed:demo` hoặc chuyển toàn bộ DB local khi chưa có yêu cầu.

## SMTP gateway Vercel

Gateway dùng wrapper `api/index.js` tại Git root thay vì NestJS adapter từ thư mục con có dấu cách; Framework Other và Root Directory để trống. Root `package.json` dùng Node 24; install `npm --prefix '03. Source code/backend' ci --include=dev`, build backend hiện có. Giữ placeholder `public/.gitkeep` cho output của framework Other. Dùng cấu hình root Vercel hiện có cho wrapper, không thêm `functions.src/main.ts`; `api/index.js` có `maxDuration: 300`. Hạn mức miễn phí Vercel vẫn áp dụng; cấu hình 300 giây không bảo đảm không hết quota.

Gateway cần cùng `DATABASE_URL`, `SMTP_ENCRYPTION_KEY`, Google OAuth client và `SMTP_RELAY_SECRET` với API Render. Không đặt `REMOTE_SMTP_URL` ở gateway. Biến `VERCEL` tự có và tắt timer nền; không chạy gửi chiến dịch/đồng bộ Inbox tự động trên gateway.

- Render tạo yêu cầu UUID tạm trong `smtp_relay_requests`, chứa email tài khoản và nội dung đã render; tệp đính kèm biểu diễn bằng base64 trong DB. HTTP chỉ gửi UUID nên không áp giới hạn body Vercel lên tệp email.
- `POST /api/internal/smtp/verify` và `/api/internal/smtp/send` yêu cầu `Authorization: Bearer <SMTP_RELAY_SECRET>`. Đây là endpoint nội bộ dùng secret, không dùng session đăng nhập; có cookie đăng nhập cũng không vượt được kiểm tra secret.
- Gateway lấy/xóa yêu cầu còn hạn 2 phút bằng `DELETE ... RETURNING` trước khi gửi, rồi tra tài khoản SMTP active từ DB. Không nhận SMTP host, mật khẩu hoặc token từ HTTP. UUID đã dùng/không tồn tại không gửi lại được.
- Render gọi HTTPS, timeout 30 giây, không tự retry. Khi timeout, phải kiểm tra hộp thư đã gửi trước khi thử lại để tránh trùng. Payload được xóa khi tiêu thụ hoặc kết thúc lời gọi; bản hết hạn được dọn khi có yêu cầu relay tiếp theo.
- SMTP tại gateway; IMAP vẫn chạy trực tiếp trên API Render. Ngoài health, ngày 15/11 đã kiểm chứng thư gửi thật và reply thật; xem [báo cáo kiểm chứng](DEPLOY_VERIFICATION.md). Kết quả một lượt không chứng minh độ sẵn sàng dài hạn hoặc mọi email đều gửi/nhận thành công.

## FE, Google OAuth và tài khoản Gmail

FE root `03. Source code/frontend`, Vite, install `npm ci`, build `npm run build`, output `dist`. Rewrite `/api/:path*` trong `frontend/vercel.json` hiện trỏ đến `https://v5-marketing-api.onrender.com/api/:path*`. Giữ API tương đối để cookie/callback qua origin FE.

Google Cloud OAuth Web client đã lưu chính xác `https://v5-marketing.vercel.app/api/sender-accounts/google/callback` trong Authorized redirect URIs qua UI Google Cloud. Giữ callback localhost riêng; Gmail phải nằm trong Test users nếu app còn Testing. Token Gmail đã được giải mã bằng khóa local rồi mã hóa lại bằng khóa cloud trong tiến trình kín; không in token hoặc mang nguyên ciphertext với khóa khác. Đã chạy lại trọn luồng cấp quyền trên public bằng Brave, callback về FE với `google=connected`; SMTP/IMAP sau đó kiểm tra thành công. Nếu quyền Google không còn hợp lệ, Trưởng phòng dùng **Kết nối với Google** để cấp lại.

## Job nền

API Render chạy timer Delivery, Inbox, Follow-up và Search khi tiến trình còn hoạt động. Không cấu hình scheduler ngoài gọi song song các timer. Các endpoint `POST /api/internal/jobs/{delivery,inbox,followups,search}` vẫn được bảo vệ bằng `JOBS_SECRET`, so sánh constant-time; các task dùng chung PostgreSQL advisory transaction lock để hạn chế chạy đồng thời. Scheduler ngoài theo phút chưa cấu hình và không phải thành phần đã kiểm chứng của phương án hiện tại. Trên Vercel, timer bị tắt; gateway không thay vai trò worker Render.

## Kiểm tra sau deploy

1. Render Live, `/health` database up; FE `/api/auth/me` trả API thay vì HTML.
2. Đăng nhập hai vai trò, reload, logout, Secure/HttpOnly cookie và CRUD fixture riêng.
3. Gateway deployment nhận secret mới; endpoint relay không secret trả 401, không chạy SMTP.
4. Chuyển đúng tài khoản Gmail được yêu cầu và kiểm tra SMTP/IMAP theo người nhận thử đã được chỉ định; báo riêng gửi, nhận và lịch nền.
5. Ghi rõ giới hạn Render Free sleep, timeout relay và các phần chưa kiểm chứng. Không báo website hoạt động đầy đủ chỉ từ health 200.

Nguồn: [Render Free](https://render.com/docs/free), [Render Web Services](https://render.com/docs/web-services), [Vercel Function duration](https://vercel.com/docs/functions/configuring-functions/duration), [node-postgres SSL](https://node-postgres.com/features/ssl), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
