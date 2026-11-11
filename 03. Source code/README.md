# Source code

Thư mục này dùng để lưu mã nguồn của dự án.

## Thông tin dự án

- Tên dự án: _Bổ sung sau_
- Mô tả: _Bổ sung sau_

## Quyết định đã chốt

- Ưu tiên nối toàn bộ màn hình ở trang Trường bằng FE trước; BE và API triển khai sau.
- FE: React, theo [thiết kế Figma](https://www.figma.com/design/jXKaLKxLAOL4mVyC4cReYZ/M%C3%A0n-h%C3%ACnh-giao-di%E1%BB%87n_Nh%C3%B3m2?m=auto&t=qDMpQZq3qnBanuPp-1).
- BE: NestJS.
- CSDL: PostgreSQL chạy bằng Docker trong môi trường phát triển.

## Tài liệu chuẩn bị

- [Ghi chú yêu cầu](GHI_CHU_YEU_CAU.md)
- [Chỉ mục Figma trang Trường](GHI_CHU_FIGMA_TRUONG.md)
- [Đề xuất cấu trúc và quy ước code](DE_XUAT_CAU_TRUC_VA_CODE_STYLE.md)

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
backend/        NestJS; chưa có module nghiệp vụ hoặc kết nối CSDL
compose.yaml    PostgreSQL dùng cho môi trường phát triển
.env.example    Biến môi trường mẫu cho PostgreSQL
```

Chỉ thêm thư mục `features` ở FE và `modules` ở BE khi triển khai chức năng đầu tiên; không tạo sẵn các module trống.

## Cài đặt và chạy trên máy phát triển

Cần Node.js và npm để xem FE. Docker Desktop chỉ cần khi chạy PostgreSQL; trong PowerShell tại thư mục này:

```powershell
Copy-Item .env.example .env
# Mở .env và thay POSTGRES_PASSWORD bằng mật khẩu chỉ dùng trên máy này.
docker compose up -d db
```

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

FE mặc định ở `http://localhost:5173`; BE mặc định ở `http://localhost:3000`. PostgreSQL chỉ mở cổng trên `127.0.0.1:5432` (hoặc `POSTGRES_PORT` trong `.env`) và lưu dữ liệu trong Docker volume. BE chưa kết nối PostgreSQL; phần này sẽ được thêm cùng use case cần dữ liệu.

### Luồng giao diện trang Trường

- `http://localhost:5173/`: màn hình đăng nhập. Form kiểm tra trường trống và định dạng email; nhập hợp lệ sẽ chuyển đến trang chính bằng trạng thái FE cục bộ.
- `?preview=empty-errors`, `missing-email`, `invalid-email`, `missing-password`, `credentials`, `role`, `loading`: các trạng thái đăng nhập tương ứng trong Figma.
- `?preview=employee` và `?preview=manager`: hai trang chính theo vai trò. Có thể dùng `?role=manager` trên màn đăng nhập để xem luồng vào trang Trưởng phòng.
- Từ trang chính Nhân viên, dùng menu và các nút để đi qua thiết lập tiêu chí, Filter Template, tìm kiếm, lịch sử, kiểm tra/xác nhận Contact và xuất dữ liệu. URL `?screen=criteria`, `templates`, `history`, `results`, `check`, `all-contacts`, `confirm`, `confirmed`, `export` mở trực tiếp từng màn hình chính.

Giao diện giữ bố cục Figma ở 1440 × 1024 và co lại cho desktop 1366, 1280 và 1024 px; màn hình thấp có thể cuộn dọc. Chưa có thiết kế mobile/tablet.

### Luồng giao diện trang Đức + Huy

- Menu **Chiến dịch**, **Response** và **Follow-up** mở các danh sách tương ứng. Các màn chính dùng `?screen=campaign-list`, `response-list`, `followup-list`.
- Chiến dịch demo nối bước chọn danh sách, kết quả lọc, chọn/soạn và xem trước email, chọn tài khoản, thiết lập lịch, xác nhận. Danh sách mới dừng ở trạng thái **Chờ kiểm tra danh sách**; chỉ chiến dịch mẫu đã duyệt mới mở bước soạn email.
- Response demo có danh sách, chi tiết, thêm/sửa, soạn phản hồi, cập nhật trạng thái và lịch sử. Follow-up demo có danh sách, lập lịch, kết quả, ghi chú và xác nhận xóa. Trạng thái rỗng/lỗi có thể đối chiếu qua `?screen=response-empty`, `response-load-error`, `response-access-denied`, `followup-duplicate`, `followup-optout`.
- Dữ liệu và thao tác trên trang Đức + Huy là minh họa cục bộ, mất khi tải lại trang. Xác nhận chiến dịch, phản hồi và Follow-up **không gửi email/SMS, không lưu lên máy chủ và không chạy lịch nền**. Số liệu lọc 915/115/800 chỉ khớp bộ ba danh sách mẫu trong Figma; bộ chọn khác chờ API để tính chính xác.

Các đường dẫn `preview` và `screen` dùng để đối chiếu Figma. Contact, Filter Template, lịch sử và kết quả tìm kiếm là **dữ liệu minh họa trong Figma**; thao tác chỉ thay đổi trạng thái trong trình duyệt và sẽ mất khi tải lại trang. Có thể mở chi tiết từng lần tìm kiếm; dữ liệu Contact của các lần ngoài bản ghi đầu là minh họa và tiêu chí chi tiết chưa có trong Figma. Màn xuất tạo tệp CSV, XLSX, JSON hoặc XML từ 38 Contact mẫu và tải trực tiếp về máy. Chưa có xác thực, tìm kiếm nguồn hoặc lưu dữ liệu lên máy chủ; BE và API chưa được triển khai.
