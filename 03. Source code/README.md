# Source code

Thư mục này dùng để lưu mã nguồn của dự án.

## Thông tin dự án

- Tên dự án: _Bổ sung sau_
- Mô tả: _Bổ sung sau_

## Quyết định đã chốt

- Giao diện được dựng trước theo Figma; BE cho Nhân viên và Trưởng phòng đang được nối theo từng luồng.
- FE: React, theo [thiết kế Figma](https://www.figma.com/design/jXKaLKxLAOL4mVyC4cReYZ/M%C3%A0n-h%C3%ACnh-giao-di%E1%BB%87n_Nh%C3%B3m2?m=auto&t=qDMpQZq3qnBanuPp-1).
- BE: NestJS.
- CSDL: PostgreSQL chạy bằng Docker trong môi trường phát triển.

## Tài liệu chuẩn bị

- [Triển khai FE Vercel + API Render + Neon + SMTP gateway](DEPLOY_VERCEL_RENDER.md) — biến môi trường, callback Google và lịch chạy job.

- [Ghi chú yêu cầu](GHI_CHU_YEU_CAU.md)
- [Chỉ mục Figma trang Trường](GHI_CHU_FIGMA_TRUONG.md)
- [Đề xuất cấu trúc và quy ước code](DE_XUAT_CAU_TRUC_VA_CODE_STYLE.md)
- [Kế hoạch triển khai Google Search/Web](tasks/plan.md) — phạm vi, hiện trạng, quyết định còn mở và thứ tự làm.
- [API/dữ liệu dự kiến](tasks/google-search-spec.md), [ma trận nghiệm thu](tasks/google-search-tests.md), [chuẩn bị SerpAPI](tasks/google-search-setup.md) và [checklist triển khai](tasks/todo.md). Đã có pipeline bằng fixture; hợp đồng API thực tế và giới hạn ở backend/API.md, đã thử một lượt live SerpAPI; xem báo cáo kết quả.

### Danh mục API tham khảo cho BE

[public-apis/public-apis](https://github.com/public-apis/public-apis) là danh mục các API công khai, không phải thư viện NestJS hay dịch vụ API của dự án. Bản sao cục bộ nằm ở `.references/public-apis/` và không được đưa lên Git. Lấy bản sao lần đầu bằng lệnh đầu; cập nhật bản sao đã có bằng lệnh sau:

```powershell
git clone --depth 1 https://github.com/public-apis/public-apis.git .references/public-apis
git -C .references/public-apis pull --ff-only
```

Chỉ chọn API tích hợp sau khi đối chiếu yêu cầu nghiệp vụ và xác minh quyền truy cập, giới hạn sử dụng, điều khoản và tài liệu của nhà cung cấp.

## Tra cứu tài liệu nguồn

`tools/build_document_cache.py` chuyển DOCX bằng [MarkItDown](https://github.com/microsoft/markitdown) và XLSX theo từng ô bằng openpyxl sang Markdown cục bộ tại `.context-cache/`. Script kiểm tra SHA-256 và chỉ chuyển lại file đã thay đổi. Cache bị bỏ qua bởi Git; tài liệu gốc vẫn là nguồn để xác nhận hình ảnh, bảng và các quy tắc quan trọng.

Trên máy hiện tại, chạy trong PowerShell từ thư mục này:

```powershell
& "$env:USERPROFILE\.codex\tools\markitdown-venv\Scripts\python.exe" tools\build_document_cache.py
rg -n "từ khóa cần tìm" .context-cache
```

Nếu máy khác chưa có môi trường này, cài `markitdown[docx,xlsx]==0.1.9` vào một Python 3.10–3.14 virtual environment riêng rồi chạy script bằng Python của môi trường đó.

## Cấu trúc source

```text
frontend/       React + TypeScript + Vite; luồng giao diện trang Trường và Đức + Huy theo Figma
backend/        NestJS; PostgreSQL, xác thực và API nghiệp vụ cho hai vai trò
compose.yaml    PostgreSQL dùng cho môi trường phát triển
.env.example    Biến môi trường mẫu cho PostgreSQL, SMTP và tài khoản thử cục bộ
```

Chỉ thêm thư mục `features` ở FE và `modules` ở BE khi triển khai chức năng đầu tiên; không tạo sẵn các module trống.

## Triển khai public

FE dùng `https://v5-marketing.vercel.app`; API nghiệp vụ/timer nền dùng Render Free, PostgreSQL Neon Free và SMTP gateway Vercel. Neon đã có 23 migration và hai tài khoản; API Render đang build, rewrite FE và kiểm tra public còn chờ. Gateway health đã đạt nhưng secret relay mới cần deployment nạp lại; chưa xác nhận SMTP/IMAP thật. Chưa chuyển dữ liệu nghiệp vụ local; dự kiến chỉ chuyển Gmail ID 164 và mã hóa lại token bằng khóa cloud, không mặc định yêu cầu cấp quyền lại nếu token còn hợp lệ. Render Free có thể sleep, nên lịch nền không được bảo đảm khi service ngủ. Xem hướng dẫn triển khai ở trên.

## Cài đặt và chạy trên máy phát triển

Cần Node.js, npm và Docker Desktop. Trong PowerShell tại thư mục này:

```powershell
Copy-Item .env.example .env
# Mở .env, đặt POSTGRES_PASSWORD, DEMO_EMPLOYEE_PASSWORD và DEMO_MANAGER_PASSWORD riêng cho máy này.
# Tạo khóa 32 byte dạng hex cho SMTP_ENCRYPTION_KEY và giữ khóa đó ổn định.
docker compose up -d db
```

Sau khi cài backend, tạo bảng và hai tài khoản thử cục bộ:

```powershell
cd backend
npm install
npm run db:migrate
npm run db:seed:local
npm run db:seed:demo
npm run test:smoke:local
npm run test:migrations:local
```

`db:seed:local` đặt lại mật khẩu hai tài khoản thử theo `.env` với `POSTGRES_*` local. Khi có `DATABASE_URL`, lệnh chỉ tạo tài khoản chưa tồn tại, không ghi đè mật khẩu/vai trò. Không đưa `.env` hoặc mật khẩu lên Git.

`db:seed:demo` nạp dữ liệu mẫu cho hai vai trò: 56 Contact, 5 danh sách ở các trạng thái kiểm tra/duyệt khác nhau, 2 Filter Template, 2 mẫu email, 3 tài khoản gửi, 5 chiến dịch, 9 Response, 5 Follow-up và 1 thư đến chưa ghép. Tên hiển thị không có nhãn `[Demo]`; khi chạy lại trên database cũ, lệnh bỏ nhãn khỏi các bản ghi mẫu đã tạo. Lệnh chạy trong một transaction và chạy lại không nhân đôi dữ liệu. Email dùng miền `example.invalid`; tài khoản gửi mẫu dùng SMTP loopback và không bật IMAP, nên không gửi thư thật. Chiến dịch đã lên lịch có ngày bắt đầu sau 30 ngày; các trạng thái gửi và phản hồi đã gửi là dữ liệu minh họa, không phải email đã gửi ngoài đời.

Chạy FE và BE ở hai cửa sổ PowerShell riêng:

```powershell
cd frontend
npm install
npm run dev
```

```powershell
cd backend
npm install
npm run start:dev
```

FE mặc định ở `http://localhost:5173`; BE dùng cổng `PORT` trong `.env` (mặc định `3000`). Vite đọc cùng `PORT` để chuyển tiếp `/api` sang BE. Nếu cổng `3000` đã được ứng dụng khác dùng, đặt `PORT=3001` và `PUBLIC_BASE_URL=http://127.0.0.1:3001` trong `.env`, rồi khởi động lại cả FE và BE. PostgreSQL chỉ mở cổng trên `127.0.0.1:5432` (hoặc `POSTGRES_PORT` trong `.env`) và lưu dữ liệu trong Docker volume. `GET http://localhost:<PORT>/health` trả `200` khi kết nối PostgreSQL thành công, hoặc `503` khi không kết nối được.

Các API hiện có: `/api/auth`, `/api/filter-templates`, `/api/contact-lists`, `/api/sender-accounts`, `/api/email-templates`, `/api/campaigns`, `/api/responses`, `/api/followups`, `/api/inbox`, `/api/notifications`, `/api/dashboard`, `/api/unsubscribe`. Xem [hợp đồng API](backend/API.md). Sau khi đăng nhập, các màn nghiệp vụ chính của Nhân viên và Trưởng phòng đọc/ghi PostgreSQL qua API. Google Search/Web đã có pipeline SerpAPI và lịch sử; cần cấu hình key BE để tìm thật. Apollo để sau; không trả Contact giả khi thiếu cấu hình. SMTP gửi chiến dịch theo lịch và phản hồi email chỉ hoạt động khi đã cấu hình tài khoản gửi thật, `SMTP_ENCRYPTION_KEY` và `PUBLIC_BASE_URL`; worker chiến dịch kiểm tra mỗi 30 giây, giới hạn 100 email/3 ngày và 50 email/giờ. Lịch hẹn dùng khung 08:00–17:00 GMT+7; tùy chọn Gửi ngay bắt đầu sau khi xác nhận kể cả ngoài khung giờ hẹn. Khi tạm dừng, lý do có thể để trống và tối đa 250 ký tự; sau khi sửa email/tệp phải xem trước lại trước khi tiếp tục gửi. Follow-up giữ đủ thông số lịch, nhắc việc và sau thời gian chờ mới xác định có/không có phản hồi để tạo lượt tiếp theo khi được yêu cầu. Nếu kết quả gửi không chắc chắn sau sự cố, chiến dịch tạm dừng hoặc phản hồi email bị giữ ở trạng thái cần kiểm tra thủ công trước khi gửi lại. Gmail IMAP đồng bộ mỗi 2 phút khi tài khoản được bật `inboundEnabled`; lần đầu chỉ ghi mốc hiện tại, sau đó nhận thư mới, tối đa 50 thư mỗi lượt và 2 MB mỗi thư. Thư chưa ghép được hiển thị trong `/api/inbox/unmatched` để Trưởng phòng phân công.

### Luồng giao diện trang Trường

- `http://localhost:5173/`: đăng nhập bằng `minhanh@example.com` hoặc `truongphong@example.com` với mật khẩu thử đã đặt trong `.env` rồi chạy `db:seed:local`. Vai trò được lấy từ PostgreSQL, không lấy từ URL.
- `?preview=empty-errors`, `missing-email`, `invalid-email`, `missing-password`, `credentials`, `role`, `loading`: các trạng thái đăng nhập tương ứng trong Figma.
- `?preview=employee` và `?preview=manager`: hai trang chính theo vai trò. `?role=manager` chỉ dùng mở trực tiếp các frame demo để đối chiếu Figma, không xác định role cho lần đăng nhập bằng form.
- Ở chế độ Trưởng phòng, menu **Kiểm tra danh sách Contact** duyệt/từ chối danh sách từ database; **Tài khoản gửi** có hai mục **Kiểm tra tài khoản gửi** và **Danh sách tài khoản gửi**, thao tác thêm/sửa/Ẩn/kiểm tra SMTP/IMAP qua API. Icon tài khoản góc phải mở thông tin tài khoản và nút đăng xuất.
- Từ trang chính Nhân viên, dùng menu để xem danh sách Contact đã lưu, Filter Template, chiến dịch, Response, Follow-up và tài khoản gửi. Nếu thiếu SerpAPI key, màn tiêu chí báo chưa cấu hình và vẫn cho xem lịch sử đã lưu. Danh sách Contact có thể được nạp qua `POST /api/contact-lists` để kiểm thử luồng duyệt/chiến dịch trước khi tích hợp tìm kiếm.

Giao diện giữ bố cục Figma ở 1440 × 1024 và co lại cho desktop 1366, 1280 và 1024 px; màn hình thấp có thể cuộn dọc. Chưa có thiết kế mobile/tablet.

### Luồng giao diện trang Đức + Huy

- Menu **Chiến dịch**, **Response** và **Follow-up** mở các danh sách tương ứng. Các màn chính dùng `?screen=campaign-list`, `response-list`, `followup-list`.
- Chế độ đăng nhập thật dùng danh sách đã được Trưởng phòng duyệt để tạo chiến dịch, lưu nội dung, xem trước cá nhân hóa, chọn tài khoản gửi, đặt lịch và xác nhận. Response email gửi qua SMTP; SMS chỉ được ghi nhận thủ công sau khi đã gửi ngoài hệ thống. Follow-up lưu 7 thông số và kết quả vào database.
- Các trạng thái minh họa Figma vẫn có thể mở riêng ở môi trường dev bằng `?preview=employee&screen=...` hoặc `?preview=manager&screen=...`. Ở chế độ `preview`, dữ liệu vẫn là demo và thao tác không lưu database. Không dùng URL preview để kiểm chứng dữ liệu thật.
- Thư IMAP mới ghép với chiến dịch tự phân loại ý định tiếng Việt/Anh: Quan tâm, Cần thêm thông tin, Không quan tâm, Ngừng nhận email hoặc Khác. Bộ phân loại bỏ qua phần trích dẫn phổ biến, giữ nội dung gốc và trạng thái Mới; nhân viên vẫn có thể sửa nhãn. Xem quy tắc và giới hạn trong [backend/API.md](backend/API.md#phân-loại-response-từ-imap).

Đã thử cấu hình App Password của Gmail thật nhưng Google từ chối xác thực. OAuth được kiểm chứng bằng test và luồng giả lập; chưa xác nhận gửi/nhận Gmail thật cho tới khi cấu hình Google Cloud và cấp quyền thành công. Các tài khoản đăng nhập local nằm trong `.env`, không ghi mật khẩu vào mã nguồn hoặc tài liệu.

### Kết nối Gmail bằng OAuth 2.0

Giữ nguyên Gmail hiện tại. Trưởng phòng mở chi tiết tài khoản gửi và chọn **Kết nối với Google**. OAuth được dùng cho cả SMTP chiến dịch, phản hồi email và Gmail IMAP; không tích hợp Google Search trong bước này.

1. Tạo hoặc chọn Google Cloud project. Trong **Google Auth Platform**, cấu hình Branding, Audience (External) và thêm Gmail cần kết nối vào Test users nếu dự án đang Testing.
2. Tạo OAuth Client loại **Web application**. Đăng ký chính xác Authorized redirect URI: `http://127.0.0.1:5173/api/sender-accounts/google/callback`. Không thay `127.0.0.1` bằng `localhost` nếu đang mở FE bằng IP này. Cấu hình Data Access cho `openid`, email và `https://mail.google.com/` (SMTP/IMAP cần quyền này).
3. Điền `GOOGLE_OAUTH_CLIENT_ID` và `GOOGLE_OAUTH_CLIENT_SECRET` vào `.env` cục bộ. Đặt `GOOGLE_OAUTH_REDIRECT_URI` như trên và `FRONTEND_BASE_URL=http://127.0.0.1:5173`. Giữ `SMTP_ENCRYPTION_KEY` ổn định. Không gửi secret/token qua chat, không đặt biến `VITE_`, không commit file client secret.
4. Chạy `npm --prefix backend run db:migrate`, build và khởi động lại BE. Mở FE, đăng nhập Trưởng phòng, vào tài khoản gửi và bấm kết nối. Đăng nhập đúng Gmail, đọc và cấp quyền trên Google. Ứng dụng từ chối liên kết nếu Gmail được chọn khác địa chỉ tài khoản gửi.
5. Trở về ứng dụng, kiểm tra **SMTP** và **IMAP**. Liên kết thành công không tự gửi thư. Nếu tạo tài khoản mới, lưu ở trạng thái Ngừng hoạt động và chưa bật IMAP, không cần mật khẩu; sau khi liên kết thì có thể kích hoạt và bật IMAP.

Refresh token được mã hóa AES-256-GCM trong DB; access token chỉ giữ tạm trong bộ nhớ BE, dùng chung cho SMTP/IMAP. Phiên kết nối có state một lần, ràng buộc phiên đăng nhập và PKCE, hết hạn sau 10 phút. Callback kiểm tra danh tính, quyền Gmail và không đưa token lên URL FE. Quyền hết hạn/bị thu hồi hiển thị **Cần kết nối lại Google**. Lỗi mạng khi làm mới token không Ẩn quyền đã lưu.

**Ngắt kết nối Google** Ẩn token trong ứng dụng, chuyển tài khoản sang Ngừng hoạt động và tắt đồng bộ IMAP. Thao tác này không thu hồi quyền trên Google; có thể quản lý quyền ở trang Tài khoản Google. Không tự quay lại mật khẩu cũ khi OAuth lỗi. Muốn dùng App Password trở lại, ngắt kết nối rồi cấu hình/kích hoạt SMTP thủ công.

Ứng dụng External ở Testing dùng quyền Gmail có refresh token thường hết hạn sau 7 ngày. Quyền `https://mail.google.com/` là quyền rộng; trước khi phát hành công khai cần đáp ứng chính sách/xác minh của Google. Tài liệu: [OAuth cho web server](https://developers.google.com/identity/protocols/oauth2/web-server), [SMTP/IMAP OAuth và scope](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol), [vòng đời token](https://developers.google.com/identity/protocols/oauth2).


### Google Search/Web qua SerpAPI

Đã có pipeline BE và màn live: thiết lập/xem lại tiêu chí → job tìm kiếm → kết quả/rỗng/lỗi → lịch sử/chi tiết → kiểm tra/xác nhận Contact → Trưởng phòng duyệt. Dùng `SERPAPI_API_KEY` trong `.env` BE, chạy migration (`npm --prefix backend run db:migrate`), build/restart BE rồi chạy FE như trên. Không dùng Gmail OAuth key cho tìm kiếm. `.env.example` chỉ chứa biến rỗng.

Một job giới hạn 2 truy vấn × tối đa 2 trang SerpAPI, 20 trang website tổng, 100 Contact mới và 120 giây. Website đọc được nhưng có trang lỗi trả cảnh báo kết quả chưa đầy đủ; không đọc được trang nào hoặc provider/DB lỗi thì thất bại. Không cam kết tìm đủ số email. Catch-all chưa được hỗ trợ; quy mô chỉ tham khảo, không lọc cứng. Email “Đã xác nhận” chỉ nghĩa là xuất hiện trên nguồn công khai và hợp lệ cú pháp. Chức vụ/ngành/khu vực suy đoán ghi “Chưa đảm bảo”. Proxy quy mô chia khoảng theo số email công khai quan sát được, chưa được hiệu chuẩn với số nhân viên thật; không coi là employee count.

Bộ tải website kiểm tra IP/DNS/redirect, robots.txt, timeout và giới hạn body; không chạy JavaScript, vượt CAPTCHA, đọc PDF hay website cần đăng nhập. Các thư viện thêm: cheerio để phân tích HTML, ipaddr.js để phân loại địa chỉ IP, robots-parser để kiểm tra robots. Không thêm dịch vụ AI hoặc hàng đợi ngoài PostgreSQL.

Kiểm thử không tiêu credit: `npm --prefix backend run test:search:local` (cần PostgreSQL và tài khoản local), dùng provider/website fixtures và dọn dữ liệu tạo bởi test. Các tiến trình gửi/nhận mail trong bài kiểm thử đều bị vô hiệu. Xem [báo cáo triển khai](BAO_CAO_GOOGLE_SEARCH_2026-11-15.md) để phân biệt đã kiểm thử và chưa thử live.
