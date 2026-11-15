# Triển khai Vercel + Render

Phương án đã chốt: React trên Vercel, NestJS trên Render, PostgreSQL riêng cho môi trường public. Chưa tạo dịch vụ hoặc phát sinh phí.

## Render — Backend

- Repository: `VanTruongDUE/50K212.02.3007`.
- Root Directory tính từ Git root: `03. Source code/backend`.
- Runtime: Node.js 24.
- Build Command: `npm ci --include=dev && npm run build`.
- Start Command: `node scripts/migrate.cjs && node dist/main.js`.
- Health Check Path: `/health`.
- Một instance BE ban đầu vì worker gửi thư/IMAP chạy trong tiến trình này.

Tạo PostgreSQL cùng vùng với BE, dùng thông tin kết nối nội bộ. Đặt `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` trong Environment của Render. Không trỏ service public về PostgreSQL trên máy cá nhân.

Các biến khác ở Render:

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `PUBLIC_BASE_URL` | HTTPS origin của BE Render, dùng cho liên kết ngừng nhận email |
| `FRONTEND_BASE_URL` | HTTPS origin của FE Vercel |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<FE-Vercel>/api/sender-accounts/google/callback` |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client đã cấu hình |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Chỉ lưu ở Render |
| `SMTP_ENCRYPTION_KEY` | 32 byte dạng hex, giữ cố định; phải giữ khóa cũ nếu chuyển dữ liệu Gmail đã mã hóa |
| `SERPAPI_API_KEY` | Chỉ lưu ở Render |

Render cung cấp `PORT`; không ép dùng cổng localhost. Không chạy seed hoặc reset database mỗi lần deploy. Khởi tạo hai tài khoản một lần hoặc chuyển dữ liệu sau khi BA chọn phương án; mật khẩu không đưa vào Git hoặc log.

Render Free chặn SMTP 25/465/587 và có thể ngủ khi không sử dụng. Muốn giữ gửi Gmail SMTP và worker chạy liên tục cần chọn gói phù hợp trước khi tạo dịch vụ.

## Vercel — Frontend

- Cùng repository, Root Directory: `03. Source code/frontend`.
- Framework: Vite.
- Install Command: `npm ci`.
- Build Command: `npm run build`.
- Output Directory: `dist`.
- Node.js 24.

Sau khi có URL BE thật, thêm external rewrite `/api/:path*` → `https://<BE-Render>/api/:path*` trong `frontend/vercel.json`. FE đang dùng URL tương đối `/api`; giữ cách này để cookie đăng nhập và callback Google cùng origin Vercel. Không đổi toàn bộ lời gọi FE sang cross-origin hoặc đưa secret vào biến `VITE_*`.

URL BE phải được xác định trước khi ghi rewrite; không deploy cấu hình trỏ tới URL minh họa. Không cache API chứa dữ liệu người dùng. Kiểm tra cookie Secure/HttpOnly, đăng nhập, đăng xuất và callback Google trên HTTPS sau deploy.

## Thứ tự thực hiện

1. Chốt gói Render và phạm vi dữ liệu chuyển lên public.
2. Tạo PostgreSQL và BE Render; nhập secret trực tiếp vào Environment, chạy migration và kiểm tra `/health` trả 200.
3. Ghi rewrite với URL Render thật, triển khai FE Vercel.
4. Cập nhật origin FE và callback trên Render; thêm đúng callback HTTPS vào Google Cloud OAuth client. Giữ callback localhost để vẫn phát triển cục bộ.
5. Khởi tạo/chuyển dữ liệu theo lựa chọn BA, không tự kích hoạt các chiến dịch đang chờ gửi khi chuyển dữ liệu. Kết nối lại Gmail nếu không chuyển token.
6. Thử trên website public: đăng nhập hai role, phiên sau reload, lưu/đọc dữ liệu, quyền truy cập, tài khoản gửi, SMTP/IMAP, Google OAuth và SerpAPI. Chỉ báo website sẵn sàng sau khi kiểm tra live đạt.

Nguồn: [Render Free](https://render.com/docs/free), [Render Web Services](https://render.com/docs/web-services), [Render Postgres](https://render.com/docs/postgresql-creating-connecting), [Vercel Rewrites](https://vercel.com/docs/routing/rewrites).
