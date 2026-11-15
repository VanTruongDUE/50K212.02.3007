# Kiểm thử Gmail thật sau nâng cấp phân loại — 15/11/2026

## Phạm vi và cách kiểm tra

Dùng agent-desktop thao tác Brave trên hộp thư nhận đã được cho phép. Gửi một email từ Response 352 qua Gmail OAuth và trả lời trực tiếp thư đó bằng các thư riêng. Đồng bộ IMAP, đối chiếu dữ liệu Response qua API; không nhập giả các thư nhận vào database.

## Kết quả thư nhận thực tế

| Nội dung trả lời mới | Response | Nhãn | Trạng thái |
| --- | --- | --- | --- |
| Tôi quan tâm | 353 | interested | new |
| Gửi giúp tôi bảng giá | 354 | need_info | new |
| Tôi chưa có nhu cầu | 355 | not_interested | new |
| Tôi chưa chắc tôi quan tâm | 356 | other | new |
| Đừng gửi email cho tôi nữa | 357 | unsubscribe | new |

Cả năm thư đều tự ghép chiến dịch 144 và nhân viên NV001. Nội dung trích dẫn email kiểm thử chứa nhiều ý định không làm thay đổi nhãn của phần trả lời mới.

## Luồng liên quan

- SMTP và IMAP OAuth xác thực thành công; đã gửi một email từ ứng dụng đến hộp thư nhận.
- Đã thao tác đăng nhập Nhân viên, xem danh sách và chi tiết Follow-up, ghi kết quả và hoàn tất trên giao diện. Follow-up 211 lưu trạng thái done, ghi chú và needs_next=false trong database.
- Đăng xuất Nhân viên, đăng nhập Trưởng phòng hiển thị đúng menu theo vai trò. Trưởng phòng đọc được lịch Follow-up qua API.
- Tạo danh sách kiểm thử, nhân viên kiểm tra và xác nhận, trưởng phòng duyệt qua API. Tạo chiến dịch mới bị chặn vì người nhận đã nhận chiến dịch trong 7 ngày; giữ quy tắc, không sửa dữ liệu lịch sử để vượt chặn.

- Sau thư ngừng nhận, thử gửi phản hồi từ Response 354 bị chặn HTTP 409: “Địa chỉ email đã bị chặn nhận thư.” Không có email bổ sung được gửi trong phép thử này. Hộp thư nhận đang bị chặn trong ứng dụng theo yêu cầu kiểm thử cuối; chưa khôi phục quyền nhận.

## Giới hạn

Đây là năm tình huống email thật có kiểm soát, không phải phép đo độ chính xác trên tập email khách hàng độc lập. Chưa kiểm tra lại mọi màn hình của dự án trong lượt này. Google Search chưa được triển khai trong đợt kiểm thử này.
