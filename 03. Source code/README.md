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

- [Ghi chú yêu cầu](GHI_CHU_YEU_CAU.md)
- [Chỉ mục Figma trang Trường](GHI_CHU_FIGMA_TRUONG.md)
- [Đề xuất cấu trúc và quy ước code](DE_XUAT_CAU_TRUC_VA_CODE_STYLE.md)

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

`db:seed:local` đặt lại mật khẩu hai tài khoản thử theo `.env` khi chạy lại. Không đưa `.env` hoặc mật khẩu lên Git.

`db:seed:demo` thêm dữ liệu mẫu có nhãn `[Demo]` cho Contact, ba trạng thái duyệt danh sách, mẫu tiêu chí/email, tài khoản gửi, chiến dịch, Response, Follow-up và thư đến chưa ghép. Lệnh chạy trong một transaction và chạy lại sẽ không nhân đôi dữ liệu; không sửa bản ghi khác. Email mẫu dùng miền `example.invalid`. Tài khoản gửi mẫu có cấu hình SMTP giả trên địa chỉ loopback và không bật IMAP: chỉ dùng để xem và thử luồng, không gửi email thật. Chiến dịch mẫu đang tạm dừng hoặc đã hoàn tất nên worker không tự gửi. Lịch sử gửi mẫu là dữ liệu minh họa, không phải email đã gửi ngoài đời.

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

Các API hiện có: `/api/auth`, `/api/filter-templates`, `/api/contact-lists`, `/api/sender-accounts`, `/api/email-templates`, `/api/campaigns`, `/api/responses`, `/api/followups`, `/api/inbox`, `/api/notifications`, `/api/dashboard`, `/api/unsubscribe`. Xem [hợp đồng API](backend/API.md). Sau khi đăng nhập, các màn nghiệp vụ chính của Nhân viên và Trưởng phòng đọc/ghi PostgreSQL qua API. Google Search và Apollo chưa tích hợp: màn tìm kiếm thật báo chưa kết nối, không tạo Contact giả. SMTP gửi chiến dịch theo lịch và phản hồi email chỉ hoạt động khi đã cấu hình tài khoản gửi thật, `SMTP_ENCRYPTION_KEY` và `PUBLIC_BASE_URL`; worker chiến dịch kiểm tra mỗi 30 giây trong khung 08:00–17:00 GMT+7, giới hạn 100 email/3 ngày và 50 email/giờ. Follow-up giữ đủ thông số lịch, nhắc việc và sau thời gian chờ mới xác định có/không có phản hồi để tạo lượt tiếp theo khi được yêu cầu. Nếu kết quả gửi không chắc chắn sau sự cố, chiến dịch tạm dừng hoặc phản hồi email bị giữ ở trạng thái cần kiểm tra thủ công trước khi gửi lại. Gmail IMAP đồng bộ mỗi 2 phút khi tài khoản được bật `inboundEnabled`; lần đầu chỉ ghi mốc hiện tại, sau đó nhận thư mới, tối đa 50 thư mỗi lượt và 2 MB mỗi thư. Thư chưa ghép được hiển thị trong `/api/inbox/unmatched` để Trưởng phòng phân công.

### Luồng giao diện trang Trường

- `http://localhost:5173/`: đăng nhập bằng `minhanh@example.com` hoặc `truongphong@example.com` với mật khẩu thử đã đặt trong `.env` rồi chạy `db:seed:local`. Vai trò được lấy từ PostgreSQL, không lấy từ URL.
- `?preview=empty-errors`, `missing-email`, `invalid-email`, `missing-password`, `credentials`, `role`, `loading`: các trạng thái đăng nhập tương ứng trong Figma.
- `?preview=employee` và `?preview=manager`: hai trang chính theo vai trò. `?role=manager` chỉ dùng mở trực tiếp các frame demo để đối chiếu Figma, không xác định role cho lần đăng nhập bằng form.
- Ở chế độ Trưởng phòng, menu **Kiểm tra danh sách Contact** duyệt/từ chối danh sách từ database; **Tài khoản gửi** có hai mục **Kiểm tra tài khoản gửi** và **Danh sách tài khoản gửi**, thao tác thêm/sửa/xóa/kiểm tra SMTP/IMAP qua API. Icon tài khoản góc phải mở thông tin tài khoản và nút đăng xuất.
- Từ trang chính Nhân viên, dùng menu để xem danh sách Contact đã lưu, Filter Template, chiến dịch, Response, Follow-up và tài khoản gửi. Khi chưa có nguồn Google Search, trang tìm kiếm và lịch sử hiển thị trạng thái chưa kết nối. Danh sách Contact có thể được nạp qua `POST /api/contact-lists` để kiểm thử luồng duyệt/chiến dịch trước khi tích hợp tìm kiếm.

Giao diện giữ bố cục Figma ở 1440 × 1024 và co lại cho desktop 1366, 1280 và 1024 px; màn hình thấp có thể cuộn dọc. Chưa có thiết kế mobile/tablet.

### Luồng giao diện trang Đức + Huy

- Menu **Chiến dịch**, **Response** và **Follow-up** mở các danh sách tương ứng. Các màn chính dùng `?screen=campaign-list`, `response-list`, `followup-list`.
- Chế độ đăng nhập thật dùng danh sách đã được Trưởng phòng duyệt để tạo chiến dịch, lưu nội dung, xem trước cá nhân hóa, chọn tài khoản gửi, đặt lịch và xác nhận. Response email gửi qua SMTP; SMS chỉ được ghi nhận thủ công sau khi đã gửi ngoài hệ thống. Follow-up lưu 7 thông số và kết quả vào database.
- Các trạng thái minh họa Figma vẫn có thể mở riêng ở môi trường dev bằng `?preview=employee&screen=...` hoặc `?preview=manager&screen=...`. Ở chế độ `preview`, dữ liệu vẫn là demo và thao tác không lưu database. Không dùng URL preview để kiểm chứng dữ liệu thật.

Chưa kiểm thử kết nối Gmail/SMTP thật vì chưa có tài khoản thử và quyền truy cập. Các tài khoản đăng nhập local nằm trong `.env`, không ghi mật khẩu vào mã nguồn hoặc tài liệu.
