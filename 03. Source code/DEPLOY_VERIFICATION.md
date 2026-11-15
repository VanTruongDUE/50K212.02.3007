# Kiểm chứng sau triển khai

Ngày kiểm tra: 15/11/2026.

| Nguồn kiểm tra | Kết quả |
| --- | --- |
| API Render: `https://v5-marketing-api.onrender.com` | 59/59 assertion đạt |
| Qua FE Vercel và rewrite `/api`: `https://v5-marketing.vercel.app` | 59/59 assertion đạt |
| Unit test BE tại thời điểm kiểm tra | 217/217 đạt, 17 test suite |

Hai lượt cloud gọi HTTP thật, dùng hai phiên Nhân viên và Trưởng phòng độc lập, đọc/ghi PostgreSQL cloud thật. Không khởi động BE cục bộ, không giả lập phản hồi API thành công.

## Phạm vi đã kiểm tra

- `POST /api/auth/login`, `GET /api/auth/me` nhiều lần, `POST /api/auth/logout`: đăng nhập đúng vai trò, phiên dùng được qua yêu cầu tiếp theo, đăng xuất khiến phiên cũ bị từ chối. Chưa đăng nhập nhận 401.
- Phân quyền: Nhân viên không vào Dashboard; Trưởng phòng xem được Dashboard nhưng không được tạo Contact list hoặc Response; Nhân viên không tự duyệt danh sách.
- Filter Template: tạo, đọc, sửa; giữ hai giá trị chức vụ đã lưu.
- Email Template: tạo, sửa và đọc lại nội dung đã cập nhật.
- Contact list: tạo một Contact thử → Nhân viên kiểm tra đạt → xác nhận → Trưởng phòng duyệt → Nhân viên đọc lại kết quả duyệt.
- Campaign: tạo từ danh sách đã duyệt, sửa tên/mô tả, lưu tiêu đề/nội dung email và đọc lại. Không chọn lịch gửi hoặc xác nhận gửi.
- Response ngoại tuyến: tạo, chuyển trạng thái sang Đang xử lý, lưu ghi chú và đọc lại lịch sử.
- Follow-up: tạo lịch kênh Gọi điện, bổ sung ghi chú và đọc lại.
- Đối chiếu trực tiếp PostgreSQL xác nhận fixture API đã lưu và chiến dịch thử không tạo bản ghi gửi email.
- Tài liệu HTML tại origin công khai tải được. Đây là kiểm tra HTTP, không phải kiểm tra giao diện trình duyệt.

## Dữ liệu thử và dọn dẹp

Mỗi lượt dùng tiền tố ngẫu nhiên riêng và địa chỉ `example.invalid`. Đã dọn toàn bộ fixture của từng lượt bằng ID chính xác trong một transaction, kèm kiểm tra tên/email fixture; các ID đã tạo đều không còn sau dọn. Không dọn theo tiền tố rộng và không sửa dữ liệu người dùng khác. Không lưu mật khẩu, cookie hoặc URL kết nối database trong báo cáo.

## Gửi và nhận Gmail thật sau kiểm tra CRUD

- Health Render và SMTP gateway Vercel đạt 200. Kiểm tra SMTP từ FE qua Render → Vercel gateway trả 201 `connected: true`; kiểm tra IMAP từ FE qua Render trả 201 `connected: true`.
- Gmail cloud ID 1 được bật IMAP và khởi tạo cursor trước khi gửi, tránh nhập thư cũ. Tạo danh sách một người nhận đã được cho phép `chanbedu14022006@gmail.com`; Nhân viên kiểm tra/xác nhận, Trưởng phòng duyệt, tạo campaign 3, lưu nội dung, xem trước, chọn tài khoản gửi, chọn Gửi ngay rồi xác nhận đúng một lần.
- FE Vercel → API Render → SMTP gateway Vercel → Gmail gửi thành công: PostgreSQL có đúng một delivery `sent`, `sent_count=1`; không gửi đến người nhận khác. Chủ phiên kiểm tra đã quan sát thư thật trong Inbox và gửi đúng một reply bằng giao diện Gmail.
- IMAP timer Render tự nhận reply sau khoảng 70 giây quan sát bằng polling; không gọi đồng bộ thủ công trong thời gian kiểm chứng. Response 3 thuộc campaign 3, người phụ trách NV001, loại `interested`, trạng thái `new`; nội dung trả lời khớp thư kiểm tra.
- Tạo Follow-up 3 qua API, kênh Gọi điện, trạng thái Chờ thực hiện; mục tiêu và ghi chú được xác nhận trong PostgreSQL. Không gửi thêm email Follow-up.
- Giữ list/contact/campaign/Response/Follow-up ID 3 để đối chiếu UI và lịch sử gửi/nhận, theo yêu cầu; không tính chúng vào fixture CRUD đã dọn ở trên.
- Callback HTTPS public đã được lưu trong whitelist Authorized redirect URIs của Google Cloud bằng UI. Đã chạy lại luồng kết nối Google trên Brave: chọn đúng Gmail, cấp quyền, callback HTTPS quay về FE với `google=connected`; kiểm tra SMTP và IMAP sau khi đổi token đều trả 201.

## Kiểm tra FE bằng Brave

- Đăng nhập Nhân viên và Trưởng phòng từ form public; header/sidebar chuyển đúng vai trò. Nhân viên đăng xuất bằng popup tài khoản và trở về form đăng nhập.
- Nhân viên mở Contact, Chiến dịch, tạo chiến dịch, chi tiết chiến dịch đã gửi, Response, chi tiết Response 3 và Follow-up 3. Response hiển thị loại Quan tâm, trạng thái Mới và nội dung reply; Follow-up hiển thị đúng kênh Gọi điện/mục tiêu đã lưu.
- Trưởng phòng mở Trang chủ, Kiểm tra danh sách, Danh sách tài khoản gửi và Chi tiết tài khoản. Trang chủ ghi nhận một chiến dịch, một email đã gửi và một Response chưa xử lý. Danh sách chờ duyệt rỗng sau khi danh sách thử đã được duyệt là trạng thái phù hợp.
- Bấm Kiểm tra SMTP/IMAP trong màn chi tiết tài khoản và quan sát thông báo thành công cho từng thao tác. Reload trang vẫn giữ phiên và dữ liệu Gmail Marketing.
- Đã chụp và xem ảnh các màn chính được nêu. Không thay đổi source component, CSS hoặc bố cục FE trong triển khai; SHA-256 bundle JavaScript public khớp bundle build cục bộ `/assets/index-CbYDYd7k.js`.

## Tệp đính kèm lớn

- PDF 5.000.000 byte tải lên qua FE external rewrite đạt 201; tải xuống đạt 200 và SHA-256 khớp. Sửa nháp/xóa tệp thành công, fixture nháp/list/contact được dọn bằng ID chính xác.
- Mô phỏng relay bằng service/controller thật với SMTP/fetch/DB giả lập: tệp 5 MB đi qua DB và được khôi phục nguyên vẹn; HTTP chỉ gửi UUID 52 byte. Đây không phải lượt gửi email kèm tệp thật, chưa thử toàn bộ ngưỡng 10 MB.

## Giới hạn

- 59 assertion mỗi lượt chỉ bao phủ các luồng liệt kê, không phải toàn bộ route hoặc toàn bộ 196 trạng thái Figma; không có kết luận phần trăm tương đồng pixel.
- Kiểm tra Brave chỉ bao phủ các màn/thao tác liệt kê; chưa rà lại mọi popup, validation, breakpoint hoặc toàn bộ 196 trạng thái Figma sau deploy.
- Hai lượt CRUD không gửi email. Lượt Gmail riêng nêu trên chỉ gửi đúng một thư được cho phép và nhận một reply; chưa thử tiếp tục chiến dịch hoặc mọi nhánh lỗi gửi. Không chạy SerpAPI hay tiêu credits tìm kiếm trong kiểm tra cloud này.
- Đã quan sát một lượt IMAP timer chạy tự động; chưa kiểm chứng mọi job nền hoặc scheduler ngoài. Render Free có thể ngủ và dừng timer; Vercel/Neon Free có quota, không có cam kết worker luôn hoạt động.
- Chưa kiểm chứng chịu tải, đánh thức sau thời gian Render Free ngủ hoặc thời gian phản hồi dài hạn của dịch vụ miễn phí.

Script và kết quả riêng tư nằm trong `.context-cache/deploy/`; không đưa thông tin xác thực vào Git.
