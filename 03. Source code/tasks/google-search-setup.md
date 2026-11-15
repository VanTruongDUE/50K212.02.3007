> Cập nhật triển khai: các quyết định/hợp đồng cuối ở `../backend/API.md` và kết quả kiểm chứng ở `../BAO_CAO_GOOGLE_SEARCH_2026-11-15.md`. Phần thiết kế ban đầu bên dưới được giữ để truy vết, không phải tất cả endpoint đã hiện thực đúng tên đề xuất.

# Chuẩn bị dịch vụ và vận hành thử

## Những gì BA cần chuẩn bị

1. Tài khoản SerpAPI và API key. Tạo ở [SerpAPI](https://serpapi.com/), xem điều khoản/gói/credit thực tế trên tài khoản. Chưa chốt gói hoặc chi phí cố định trong tài liệu này; không cần mua gói trước khi kiểm tra nhu cầu.
2. Điền `SERPAPI_API_KEY` trong `.env` cục bộ ở BE khi được triển khai. Không gửi qua chat, không đặt VITE_, không điền key thật vào .env.example, không commit .env. Hiện kiểm tra chỉ thấy key này thiếu.
3. Đã ghi nhận cho phép suy luận chức vụ/ngành/khu vực có nhãn nguồn, kiểm tra email ở mức cú pháp, email chung không có chức vụ cá nhân. Quy mô đã chốt là ước đoán từ số email, độ tin cậy thấp và không lọc cứng; phương pháp quy đổi cần kiểm chứng. Còn chốt ngân sách và kết quả khi website lỗi; Catch-all/khả năng nhận thư ngoài phạm vi cú pháp.
4. Chuẩn bị 3–5 bộ tiêu chí thực tế để nghiệm thu; không cần cung cấp trước website. Ghi kỳ vọng về ngành/chức vụ/khu vực, không yêu cầu chắc chắn phải có số email cố định.

Gmail OAuth và SerpAPI là hai cấu hình độc lập. Không cần đổi Gmail, mật khẩu ứng dụng hoặc OAuth client để tích hợp tìm kiếm.

## Trình tự Dev sau khi tài liệu chốt

- Làm trên nhánh riêng cho Google Search, kiểm tra working tree trước khi đổi nhánh; không mang secret vào Git.
- Viết fixture/unit test và API contract trước, hoàn thành pipeline bằng fixture, migrate DB test, nối các màn đã có.
- Cấu hình key thật trong .env; chỉ báo configured/missing, không in giá trị.
- Khởi động Docker db, chạy migration, build/restart BE và FE theo README hiện có. Cập nhật README/.env.example với biến rỗng khi code hỗ trợ thật; tài liệu này không nói các biến đã hoạt động.
- Chạy bộ test tại google-search-tests.md. Thử live với ngân sách nhỏ đã thống nhất; theo dõi credit trước/sau, lỗi provider và thời gian thực. Nếu không có key, vẫn làm xong fixture/test nhưng báo rõ NOT RUN live.

## Khi gặp lỗi

| Biểu hiện | Hướng xử lý |
| --- | --- |
| Chưa cấu hình | Kiểm tra biến BE, restart đúng instance; không yêu cầu Gmail password |
| Sai key/hết credit | Dừng gọi, kiểm tra tài khoản nhà cung cấp, giữ draft |
| Google có URL nhưng không có email công khai | Kết quả 0 hợp lệ nếu toàn bộ pipeline thành công; không chế email |
| Website chặn/timeout/robots | Báo phạm vi chưa đọc được; không dùng biện pháp vượt chặn |
| Lưu DB lỗi | Không tạo list/Contact một phần; cho tìm lại có chủ ý |
| Job treo sau restart | Kiểm tra lease/attempts và trạng thái worker, không sửa trực tiếp thành succeeded |

Mốc hoàn tất: đủ trạng thái FE với API thật, quyền hai role đúng, lịch sử và số liệu truy vết được, luồng duyệt/chiến dịch không bị đổi, test đã ghi bằng chứng và live đã đối chiếu nguồn. Không đồng nghĩa Google sẽ tìm đủ email cho mọi bộ tiêu chí.
