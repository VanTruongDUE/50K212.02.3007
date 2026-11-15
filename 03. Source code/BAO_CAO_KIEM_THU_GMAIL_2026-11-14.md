# Kiểm thử luồng Gmail OAuth — 14/11/2026

## Phạm vi và phương pháp

Kiểm thử luồng chính qua HTTP API đang chạy và PostgreSQL thật, dùng phiên đăng nhập Nhân viên và Trưởng phòng. SMTP/IMAP kết nối Gmail thật bằng OAuth. Không giả lập thư trả lời của người nhận; chủ dự án đã trả lời từ hộp thư nhận.

- Người gửi: `vantruongdkrqt@gmail.com`, tài khoản gửi #164.
- Người nhận được chủ dự án cho phép: `chanbedu14022006@gmail.com`.
- Danh sách Contact #101; chiến dịch #144; Response #309; Follow-up #193.
- Tổng email gửi trong lượt kiểm thử chiến dịch này: 2 (1 thư chiến dịch, 1 thư xác nhận khi Nhân viên thực hiện Follow-up).
- Giữ dữ liệu kiểm thử để có thể xem lại trên giao diện; không Ẩn lịch sử gửi.

## Kết quả đã kiểm chứng

| Bước | Kết quả |
| --- | --- |
| Tạo danh sách | Một Contact, đúng email nhận được chỉ định. |
| Kiểm tra/xác nhận | Nhân viên đánh giá đạt và xác nhận; xác nhận trước khi đánh giá bị chặn 409. |
| Duyệt danh sách gốc | Trưởng phòng duyệt; Nhân viên tự duyệt bị chặn 403. |
| Tạo chiến dịch | Chưa duyệt bị chặn 409; sau duyệt lọc đúng một người nhận. |
| Nội dung/xem trước | Lưu nội dung và kiểm tra thay biến tên người nhận. |
| Tài khoản/lịch | Chọn Gmail OAuth, kiểm tra hạn mức, xác nhận Gửi ngay. |
| Gửi chiến dịch | Worker gửi 1/1, lưu provider message ID, chiến dịch completed. Ẩn sau gửi bị chặn 409. |
| Nhận phản hồi | IMAP nhập thư trả lời thật, tự ghép chiến dịch #144, tạo Response #309 và giao NV001. |
| Phân loại/xử lý | Bộ phân loại ban đầu trả other; Nhân viên đổi need_info và chuyển new → processing. Có thông báo Response mới. |
| Follow-up | Tạo lịch hẹn sau 45 giây để thử nhanh, nhắc trước 1 phút; giữ cấu hình chờ 2 ngày, tối đa 3 lần, khoảng cách 2 ngày. |
| Chặn Follow-up | Không tạo thêm lịch pending trùng (409); Trưởng phòng không hoàn tất thay Nhân viên (403). |
| Đến hạn | Nhắc việc xuất hiện; không có email tự gửi. |
| Thực hiện | Nhân viên gửi một thư xác nhận qua API Response; lưu sent, lịch sử tương tác và trạng thái replied. |
| Ghi kết quả | Follow-up done, có ghi chú, needs_next=false; nhắc việc biến mất. |
| Chốt nhu cầu | Response replied → closed; không cho ghi đè nội dung sau chốt (409). Chuyển new thẳng sang closed cũng bị chặn. |
| Xem lại | Cả hai vai trò đọc được kết quả đúng phạm vi; dashboard Trưởng phòng trả dữ liệu. |

## Giới hạn còn lại

- Đây là kiểm thử luồng chính bằng API/database, chưa phải kiểm tra click từng màn hình FE hoặc mọi nhánh ngoại lệ.
- Thư chiến dịch đã được người nhận xác nhận bằng phản hồi thật. Thư Follow-up được SMTP chấp nhận và lưu sent; chưa có xác nhận riêng từ người nhận về thư thứ hai.
- Follow-up done là đã thực hiện; trường outcome vẫn awaiting để chờ đánh giá phản hồi. Không tua thời gian, không giả lập đã chờ 2 ngày, không xác nhận nhánh tự tạo lần 2/3 trong lượt này. needs_next=false nên không yêu cầu lần tiếp.
- Nội dung tiếng Việt “cần thêm thông tin” chưa được bộ phân loại tự gán need_info; đã kiểm thử phân loại thủ công.
- Không thử unsubscribe/bounce/spam với hộp thư thật để tránh thay đổi quyền nhận thư ngoài mục đích kiểm thử.
- Không thực hiện Google Search.
