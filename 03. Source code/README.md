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
npm run test:smoke:local
npm run test:migrations:local
```

`db:seed:local` đặt lại mật khẩu hai tài khoản thử theo `.env` khi chạy lại. Không đưa `.env` hoặc mật khẩu lên Git.

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

FE mặc định ở `http://localhost:5173`; BE mặc định ở `http://localhost:3000`. Vite chuyển tiếp `/api` sang BE. PostgreSQL chỉ mở cổng trên `127.0.0.1:5432` (hoặc `POSTGRES_PORT` trong `.env`) và lưu dữ liệu trong Docker volume. BE đọc cùng file `.env` ở thư mục này. `GET http://localhost:3000/health` trả `200` khi kết nối PostgreSQL thành công, hoặc `503` khi không kết nối được.

Các API hiện có: `/api/auth`, `/api/filter-templates`, `/api/contact-lists`, `/api/sender-accounts`, `/api/email-templates`, `/api/campaigns`, `/api/responses`, `/api/followups`, `/api/inbox`, `/api/notifications`, `/api/dashboard`, `/api/unsubscribe`. Xem [hợp đồng API](backend/API.md). Ngoài đăng nhập và đăng xuất, giao diện hiện vẫn dùng dữ liệu demo; muốn thao tác trên giao diện lưu vào PostgreSQL cần nối các màn với API tương ứng. Google Search và Apollo chưa tích hợp. SMTP gửi theo lịch chỉ hoạt động khi đã cấu hình tài khoản gửi thật, `SMTP_ENCRYPTION_KEY` và `PUBLIC_BASE_URL`; worker kiểm tra mỗi 30 giây trong khung 08:00–17:00 GMT+7, giới hạn 100 email/3 ngày và 50 email/giờ. Nếu kết quả gửi không chắc chắn sau sự cố, chiến dịch tạm dừng để kiểm tra thủ công trước khi tiếp tục. Gmail IMAP đồng bộ mỗi 2 phút khi tài khoản được bật `inboundEnabled`; lần đầu chỉ ghi mốc hiện tại, sau đó nhận thư mới, tối đa 50 thư mỗi lượt và 2 MB mỗi thư. Thư chưa ghép được hiển thị trong `/api/inbox/unmatched` để Trưởng phòng phân công.

### Luồng giao diện trang Trường

- `http://localhost:5173/`: đăng nhập bằng `minhanh@example.com` hoặc `truongphong@example.com` với mật khẩu thử đã đặt trong `.env` rồi chạy `db:seed:local`. Vai trò được lấy từ PostgreSQL, không lấy từ URL.
- `?preview=empty-errors`, `missing-email`, `invalid-email`, `missing-password`, `credentials`, `role`, `loading`: các trạng thái đăng nhập tương ứng trong Figma.
- `?preview=employee` và `?preview=manager`: hai trang chính theo vai trò. `?role=manager` chỉ dùng mở trực tiếp các frame demo để đối chiếu Figma, không xác định role cho lần đăng nhập bằng form.
- Ở chế độ Trưởng phòng, menu **Kiểm tra danh sách Contact** mở luồng duyệt/từ chối danh sách; **Tài khoản gửi** có hai mục **Kiểm tra tài khoản gửi** và **Danh sách tài khoản gửi**. Dữ liệu và kết quả kết nối hiện là mô phỏng FE, chưa lưu qua API. Icon tài khoản góc phải mở thông tin tài khoản và nút đăng xuất.
- Từ trang chính Nhân viên, dùng menu và các nút để đi qua thiết lập tiêu chí, Filter Template, tìm kiếm, lịch sử, kiểm tra/xác nhận Contact và xuất dữ liệu. URL `?screen=criteria`, `templates`, `history`, `results`, `check`, `all-contacts`, `confirm`, `confirmed`, `export` mở trực tiếp từng màn hình chính.

Giao diện giữ bố cục Figma ở 1440 × 1024 và co lại cho desktop 1366, 1280 và 1024 px; màn hình thấp có thể cuộn dọc. Chưa có thiết kế mobile/tablet.

### Luồng giao diện trang Đức + Huy

- Menu **Chiến dịch**, **Response** và **Follow-up** mở các danh sách tương ứng. Các màn chính dùng `?screen=campaign-list`, `response-list`, `followup-list`.
- Chiến dịch demo nối bước chọn danh sách, kết quả lọc, chọn/soạn và xem trước email, chọn tài khoản, thiết lập lịch, xác nhận. Danh sách mới dừng ở trạng thái **Chờ kiểm tra danh sách**; chỉ chiến dịch mẫu đã duyệt mới mở bước soạn email.
- Response demo có danh sách, chi tiết, thêm/sửa, soạn phản hồi, cập nhật trạng thái và lịch sử. Follow-up demo có danh sách, lập lịch, kết quả, ghi chú và xác nhận xóa. Trạng thái rỗng/lỗi có thể đối chiếu qua `?screen=response-empty`, `response-load-error`, `response-access-denied`, `followup-duplicate`, `followup-optout`.
- Dữ liệu và thao tác trên trang Đức + Huy là minh họa cục bộ, mất khi tải lại trang. Xác nhận chiến dịch, phản hồi và Follow-up **không gửi email/SMS, không lưu lên máy chủ và không chạy lịch nền**. Số liệu lọc 915/115/800 chỉ khớp bộ ba danh sách mẫu trong Figma; bộ chọn khác chờ API để tính chính xác.

Các đường dẫn `preview` và `screen` dùng để đối chiếu Figma. Contact, Filter Template, lịch sử và kết quả tìm kiếm trên FE vẫn là dữ liệu minh họa; thao tác trong các màn này mất khi tải lại trang. Màn xuất tạo CSV, XLSX, JSON hoặc XML từ bộ Contact mẫu. Backend chưa có tìm kiếm nguồn, và chưa đồng bộ các thao tác demo FE vào PostgreSQL. Chưa kiểm thử kết nối Gmail/SMTP thật vì chưa có tài khoản thử và quyền truy cập.
