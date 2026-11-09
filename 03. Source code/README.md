# Source code

Thư mục này dùng để lưu mã nguồn của dự án.

## Thông tin dự án

- Tên dự án: _Bổ sung sau_
- Mô tả: _Bổ sung sau_

## Quyết định đã chốt

- BA giao công việc theo từng bước; chưa chốt phạm vi triển khai cho bước đầu tiên.
- FE: React, theo [thiết kế Figma](https://www.figma.com/design/jXKaLKxLAOL4mVyC4cReYZ/M%C3%A0n-h%C3%ACnh-giao-di%E1%BB%87n_Nh%C3%B3m2?m=auto&t=qDMpQZq3qnBanuPp-1).
- BE: NestJS.
- CSDL: PostgreSQL chạy bằng Docker trong môi trường phát triển.

## Tài liệu chuẩn bị

- [Ghi chú yêu cầu](GHI_CHU_YEU_CAU.md)
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
frontend/       React + TypeScript + Vite; chưa có màn hình nghiệp vụ
backend/        NestJS; chưa có module nghiệp vụ hoặc kết nối CSDL
compose.yaml    PostgreSQL dùng cho môi trường phát triển
.env.example    Biến môi trường mẫu cho PostgreSQL
```

Chỉ thêm thư mục `features` ở FE và `modules` ở BE khi triển khai chức năng đầu tiên; không tạo sẵn các module trống.

## Cài đặt và chạy trên máy phát triển

Cần Node.js, npm và Docker Desktop. Trong PowerShell tại thư mục này:

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
