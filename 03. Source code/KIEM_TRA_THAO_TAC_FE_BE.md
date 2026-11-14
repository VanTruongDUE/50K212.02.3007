# Kiểm tra thao tác FE–BE sau tích hợp

Ngày kiểm tra: 13/11/2026. Phạm vi: Nhân viên và Trưởng phòng, ứng dụng đăng nhập thật qua API, PostgreSQL cục bộ. Không dùng chế độ preview/demo.

## Kết quả và giới hạn

- Mở và chụp ảnh 57 route ở viewport 1440 × 1024: không ghi nhận lỗi JavaScript hoặc tràn ngang toàn trang.
- Thực hiện 69 lượt bấm điều hướng trên các route đó: đạt, không có lỗi JavaScript.
- Các luồng ghi dữ liệu bên dưới được thao tác bằng Playwright trên Chrome thật và đọc lại API để xác nhận lưu dữ liệu.
- Đây là kiểm tra các luồng và trạng thái đã liệt kê, không phải chứng nhận mọi tổ hợp đầu vào hay toàn bộ 196 trạng thái thiết kế Figma.

## Luồng đã chạy

| Nhóm | Thao tác và kết quả |
|---|---|
| Đăng nhập/phân quyền | Đăng nhập cả hai role; Nhân viên bị chặn khi mở màn duyệt của Trưởng phòng; mở thông tin tài khoản; đăng xuất làm `/auth/me` trả 401. |
| Filter Template | Tạo, chọn, cập nhật từ khóa, đọc lại API, áp dụng tiêu chí vào màn tìm kiếm. |
| Contact | Tạo đầu vào kiểm thử bằng API; xem danh sách/chi tiết, kiểm tra đạt, xác nhận; Trưởng phòng chọn đúng danh sách, xem và duyệt. |
| Contact không đạt | Trưởng phòng không thể xác nhận khi nhận xét trống; nhập nhận xét, trả danh sách; API lưu đúng trạng thái và nhận xét. |
| Xuất Contact | Tải được CSV, XLSX, JSON và XML; kiểm tra tên phần mở rộng và tệp tải xuống. Chưa phân tích lại nội dung từng tệp xuất. |
| Tạo Chiến dịch | Nhập tên/mô tả, chọn danh sách đã duyệt, áp dụng lọc, xác nhận người nhận, tiếp tục soạn, chọn bố cục trống. |
| Nội dung email | Nhập tiêu đề/nội dung và biến cá nhân hóa; chọn logo thư viện; tải ảnh nội dung, PDF; chèn đường phân cách và nút HTTPS; lưu mẫu; xem trước máy tính/điện thoại; lưu nội dung. |
| Lỗi nội dung | Biến cá nhân hóa không tồn tại được báo lỗi; không báo lưu thành công giả. |
| Lịch chiến dịch | Chọn tài khoản hoạt động, chọn ngày tương lai/giờ, tính lịch, lưu, mở hộp xem email, xác nhận lên lịch; API trả trạng thái scheduled. |
| Tạm dừng/tiếp tục | Để trống lý do tạm dừng vẫn lưu được; xem nội dung rồi tiếp tục gửi; trạng thái được lưu lại. Dùng lịch tương lai để không phát email. |
| Xóa Chiến dịch | Hủy popup giữ chiến dịch; xác nhận xóa chiến dịch đã lên lịch nhưng chưa gửi thành công sau bản sửa. |
| Response | Kiểm tra trường bắt buộc; tạo, xem, sửa nội dung; tải lại; chuyển trạng thái; ghi nhận SMS thủ công và xem lịch sử. |
| Ẩn Response | Chặn ẩn Response không đủ điều kiện; ẩn được bản ghi loại spam; bản ghi biến mất khỏi danh sách hiện hành. |
| Follow-up | Tạo từ đúng Response; kiểm tra tạo trùng và giữ dữ liệu biểu mẫu khi quay lại; ghi nhận hoàn tất; sửa ghi chú; hủy lịch và xác nhận lịch sử còn qua API chi tiết. Lịch cancelled bị loại khỏi danh sách công việc theo BE hiện tại. |
| Tài khoản gửi | Tạo; sửa trạng thái sang hoạt động; đọc lại API; phản hồi không lộ smtp_secret; kiểm tra SMTP lỗi hiển thị lỗi và vẫn sửa được; hủy popup xóa giữ tài khoản; xác nhận xóa tài khoản chưa sử dụng thành công; lỗi trùng email giữ nguyên biểu mẫu. |
| Các nhánh Chiến dịch bổ sung | Chọn mẫu email đã lưu nạp đúng nội dung; thử các nút định dạng; lịch trong quá khứ báo lỗi; chọn Gửi ngay lưu send_mode=now nhưng chưa xác nhận phát email; Chọn lại người nhận xóa bản nháp cũ và quay về bước chọn danh sách. |
| Lỗi mạng | Chặn request tải Response trong trình duyệt, thấy thông báo lỗi/nút thử lại; bỏ chặn và thử lại tải được dữ liệu. |

## Lỗi đã sửa

FE cho xóa chiến dịch đã lên lịch chưa gửi, nhưng BE chỉ chấp nhận draft/approved/paused. Tài liệu DOCX gốc, BR-UC6-03, cho phép xóa chiến dịch chưa gửi email nào, ngoại trừ trạng thái Đang gửi hoặc Hoàn thành.

- BE chấp nhận thêm scheduled, tiếp tục kiểm tra sent_count=0 và không có email_deliveries.
- FE chỉ hiện nút xóa ở draft/approved/scheduled/paused khi sent_count=0, cả danh sách và chi tiết.
- Đã thử lại qua trình duyệt; bổ sung ca xóa chiến dịch scheduled vào smoke test và chạy đạt.

## Kiểm chứng kỹ thuật

- FE build và lint: đạt.
- TypeScript toàn backend (`tsc --noEmit --incremental false`): đạt.
- Backend build và smoke test với PostgreSQL thật sau sửa: đạt.
- Dữ liệu UI kiểm thử được dọn bằng ID cụ thể, đối chiếu tên trước khi xóa trong transaction. Không xóa bộ dữ liệu có trước lượt kiểm tra.

## Chưa được xác nhận

- Gửi email thật, nhận Gmail IMAP thật và các lỗi từ nhà cung cấp: cần cấu hình dịch vụ thật. Smoke test vẫn thay thế SMTP/IMAP bằng hàm mô phỏng.
- Google Search/Apollo chưa tích hợp theo phạm vi đã chốt.
- Xem/phân công/bỏ qua thư IMAP chưa ghép được: BE có API, FE chưa có màn tương ứng để thao tác.
- Chưa kiểm tra mọi tổ hợp kéo thả, phím tắt, đầu vào biên, mọi trạng thái trống và phiên hết hạn giữa từng thao tác; chưa chứng nhận mọi frame Figma.
- Chưa xác nhận qua UI việc gửi ngay phát email thành công, áp dụng lại mọi loại mẫu email và thay đổi danh sách người nhận ở mọi trạng thái chiến dịch.

## Bằng chứng cục bộ

- `.context-cache/integration-audit/routes.json` và ảnh cùng thư mục: 57 route.
- `.context-cache/navigation-results.json`: 69 lượt điều hướng đạt.
- `.context-cache/interaction-results.json`, `campaign-journey.json`, `remaining-results.json`, `remaining-resultsCampaign.json`, `edge-results.json`, `editor-results.json`: kết quả chạy thao tác.
- `.context-cache/final-results.json`: các ca chọn mẫu, định dạng, lịch sai/Gửi ngay, chọn lại người nhận, trùng email và xóa tài khoản đạt.
- Một số lần chạy đầu có lỗi bộ kiểm thử (nhãn bắt buộc chứa dấu *, tên nút khác dự kiến, đọc API trước khi request lưu hoàn tất). Các trường hợp này đã được sửa trong bộ kiểm thử và chạy lại; không tính là lỗi sản phẩm.
- Ca hủy Follow-up trong `edge-results.json` ban đầu tìm bản ghi đã hủy trong API danh sách nên không thấy; đã xác nhận lại qua API chi tiết trong `editor-results.json`: trạng thái cancelled được giữ và bị loại khỏi danh sách công việc.
