# Kết quả sửa FE và nối BE theo Figma

Ngày chốt kiểm chứng: 16/11/2026. Báo cáo này ghi lượt sửa mã cục bộ của Nhân viên và Trưởng phòng, đối chiếu bằng cây layer/metadata Figma và mã nguồn. Không sửa Figma. Kết quả triển khai và hành trình public tiếp theo nằm trong [KIEM_TRA_PUBLIC_2026-11-16.md](KIEM_TRA_PUBLIC_2026-11-16.md).

## Cách xử lý màn hình trùng

Danh mục đối chiếu có 257 ID: Trường 75, Đức + Huy 121, Nhi + Thảo 61. Giữ từng ID để truy vết; các frame trùng chức năng dùng chung component, dữ liệu và điều kiện trạng thái, không tạo thêm route chỉ để trùng tên frame.

Sáu thanh tiêu đề UC và một bảng trạng thái component không phải màn nghiệp vụ. Hai frame Apollo giữ ngoài phạm vi đã chốt. Bốn frame vòng duyệt danh sách chiến dịch giữ quyết định duyệt danh sách gốc trước khi soạn chiến dịch.

[Ma trận trước sửa](DOI_CHIEU_CODE_FE_FIGMA.md) là bằng chứng phát hiện ban đầu, không phải số lỗi còn lại sau sửa. Không dùng số 60 route đã mở để kết luận 257 trạng thái đã được kiểm thử thực tế.

## Thay đổi đã thực hiện

| Nhóm | FE đang dùng sau đăng nhập | BE và dữ liệu |
|---|---|---|
| Khung chung, hai vai trò | Giữ sidebar/header, phân quyền, tên chức năng và breadcrumb đã chốt. Phiên đăng nhập thật ở production không còn rơi vào preview vì tham số URL. Điều chỉnh hàng nút theo quy tắc ẩn/xóa bên trái, các thao tác còn lại bên phải; action trong cột bảng giữ thứ tự riêng. | Giữ xác thực phiên và kiểm tra vai trò tại API. |
| Tiêu chí tìm kiếm | Kiểm tra bất đồng bộ, trạng thái đang kiểm tra/lỗi; ghi nhận tiêu chí, trạng thái thành công rồi mới bắt đầu tìm kiếm. Có Lưu thành Template và khóa thao tác khi ghi nhận. | Thêm `POST contact-searches/check` và `POST contact-searches/criteria`, lưu tiêu chí theo tài khoản. Không tạo job hoặc gọi SerpAPI ở bước kiểm tra/ghi nhận. |
| Kết quả và lịch sử | Bốn cột Contact/Email/Chức vụ/Doanh nghiệp; thông tin nguồn/xác nhận vẫn có trong chi tiết. Tiêu chí dùng nhãn tiếng Việt; lịch sử có người thực hiện; quay lại đúng lịch sử. Tách rỗng/lỗi tải/đang tìm kiếm. | Lịch sử trả `owner_id`; kết quả tiếp tục dùng Contact/job/list thực, không thay bằng dữ liệu preview. |
| Filter Template | Hiện mã, tên, lựa chọn; kiểm tra tên rỗng/trùng ngay tại trường. Sau tạo chuyển tới tóm tắt đúng tiêu chí vừa lưu; retry cũ bị bỏ khi sửa draft. | Giữ POST/PATCH và lỗi trùng của API. Tiêu chí trả về sau lưu được đưa vào draft đúng tài khoản. |
| Kiểm tra/xác nhận/xuất Contact | Hiện định danh danh sách, nguồn/thời gian, kết quả kiểm tra/xác nhận. Có màn không đạt; trạng thái tạo tệp, thành công với liên kết tệp thực; giữ dữ liệu khi lỗi. | Dùng danh sách thuộc quyền truy cập từ DB; giữ bước kiểm tra → xác nhận → Trưởng phòng duyệt. |
| Tạo/lọc người nhận chiến dịch | Giữ form và bước chọn danh sách. Có kết quả lọc bằng 0 với số liệu/lý do thực; xác nhận người nhận là thao tác API. | Kết quả lọc có cấu trúc cho cả thành công và lỗi không còn người nhận; thành công lưu `filter_summary`. Trường hợp 0 không để lại campaign rỗng. |
| Quản lý/sửa chiến dịch | Xem gọi detail API, lỗi xem có hộp thoại. Chiến dịch tạm dừng có bộ chọn phần sửa; chiến dịch đã lên lịch kiểm tra điều kiện sửa thông tin chung. Form sửa gọn có Hủy ở hàng thao tác. | Bảo vệ quyền sở hữu, trạng thái và mốc tối thiểu 15 phút cho sửa thông tin đã lên lịch. Không sửa nội dung/tài khoản/lịch của chiến dịch đang gửi trực tiếp. |
| Trình soạn email | Canvas sửa trực tiếp; ảnh, nút và đường phân cách dựng ngay trong vùng soạn. Giữ thư viện logo, tải tệp, biến cá nhân hóa, xem trước. Định dạng kết hợp không mất dấu/ký tự khi mở lại. | Giữ định dạng khối đã kiểm tra ở BE. Preview draft không ghi đè nội dung đã lưu. Lưu kiểm tra hash phiên bản đã xem trước; thay tệp làm mất hiệu lực preview. |
| Chọn tài khoản gửi chiến dịch | Hydrate đúng tài khoản đã lưu; mặc định tài khoản đủ điều kiện nếu chưa chọn. Đổi tài khoản đổi tên mặc định; tên hiển thị sửa được, tối đa 50 ký tự. Có phục hồi khi không có tài khoản phù hợp. | Lưu `sender_name`, kiểm tra hoạt động/kết nối/hạn mức. Tên hiển thị đi qua cả SMTP trực tiếp và relay. |
| Lịch gửi/xác nhận/tiếp tục | Gắn đúng class bố cục live; có các chỉ báo Hợp lệ/Cần xử lý; dự kiến hoàn tất dùng cùng rate/window/số người chưa gửi. Giữ lịch đã lưu, kiểm tra GMT+7, trong khung giờ, khoảng 15 phút–90 ngày. Sửa lịch tạm dừng trở về resume. | Lưu rate/window; worker dùng cấu hình đó. Xác nhận kiểm tra lại lịch còn hợp lệ. Resume giữ lịch tương lai hợp lệ, chỉ gửi người chưa gửi; chế độ gửi ngay tiếp tục ngay sau xác nhận. Có cờ cần xác nhận lại khi sửa lúc tạm dừng. |
| Response | Chọn đúng bản ghi cho hành động ẩn; combobox khách hàng có dữ liệu Contact thuộc quyền và vẫn nhập được. Có trạng thái không được sửa/ẩn, lỗi và thử lại; lịch sử hiển thị đúng người thực hiện và kênh email/SMS. | Thêm nguồn lựa chọn khách hàng theo quyền sở hữu danh sách; giữ kiểm tra trạng thái, tương tác, Follow-up và loại Response trước khi ẩn. SMS tiếp tục chỉ ghi nhận thủ công. |
| Follow-up | Hai kết quả có phản hồi/hết lượt tách nhau theo dữ liệu thật. Trạng thái và lịch sử dùng outcome; kiểm tra từng tham số; lỗi worker có nội dung riêng. Footer giữ đúng ID được chọn. | Worker rollback khi lỗi, ghi lỗi an toàn để FE đọc và thử lại sau. Không tạo lịch vượt số lượt tối đa; lỗi một bản ghi không chặn cả lượt xử lý. |
| Trưởng phòng kiểm tra danh sách | Hiện nhân viên gửi; thống kê dùng số tiếp nhận/lỗi/trùng/mới từ lần tìm gốc. Kết quả theo trạng thái DB, không suy từ tên URL. | Trả tên chủ danh sách; giữ các bước phê duyệt/không đạt và nhận xét. |
| Trưởng phòng tài khoản gửi | Mã, thời điểm tạo/cập nhật, biểu mẫu, danh sách sau lưu đầy đủ. Tách trùng mã và trùng email; có cảnh báo gần hạn mức; dirty bao gồm mã tài khoản. Không thêm lại nút Quay lại đã được yêu cầu bỏ ở danh sách. | Migration thêm mã duy nhất và timestamp; API kiểm tra tên tối đa 50 ký tự, mã hợp lệ, hạn mức và dữ liệu SMTP. Giữ OAuth, SMTP, IMAP và hạn mức ba ngày đã chốt. |
| Hộp thoại, lỗi, thử lại | Hộp xác nhận không đóng trước khi API thành công. Khóa nút/đóng bằng Escape trong lúc xử lý; giữ focus. Thay dữ liệu đầu vào làm mất retry cũ để không gửi lại payload không còn khớp form. | Giữ nguyên lỗi nghiệp vụ có thể phục hồi; không dùng thông báo thành công để thay một thao tác lưu thất bại. |

## Kiểm chứng cục bộ

- FE production build đạt; FE lint đạt.
- 24 test FE đạt: điều hướng bản ghi, trạng thái hết lượt, tham số Follow-up, lịch/khung giờ GMT+7, biến/định dạng email, trường tài khoản và lỗi API có cấu trúc.
- BE build và lint các file BE đã sửa đạt; 230 unit test đạt, gồm rollback/lỗi worker, lịch hết hiệu lực khi xác nhận và tên gửi qua relay.
- Trên PostgreSQL tạm tách biệt: chạy đủ migration → seed tài khoản kiểm thử → smoke HTTP đạt. Kiểm tra hai vai trò, chọn Contact, Template, xác nhận/phê duyệt danh sách, campaign, tệp, preview, sender, lịch, pause/resume, Response và Follow-up. Có thêm trường hợp trùng mã, lọc còn 0 người nhận và preview nháp không commit nội dung. Database tạm được dọn sau bài kiểm tra.
- Kiểm tra DOM bản build tại 1440×1024 với dữ liệu/API fixtures: 24 nhóm kiểm tra đạt, gồm một lượt mở 60 route canonical; không có lỗi JavaScript trong các ca đó. Có kiểm tra chọn bản ghi khác, quay lại lịch sử, preview → hủy không PATCH content, template vừa sửa sau lỗi, canvas định dạng lồng và tệp CSV tải thật.
- DOM fixtures chỉ kiểm tra FE; smoke PostgreSQL/HTTP kiểm tra API và DB riêng. Không đánh đồng chúng với kiểm thử mọi trạng thái trên bản public.

## Triển khai và giới hạn kiểm chứng

Cập nhật lượt tiếp theo ngày 16/11: mã qua commit `996ae72` đã lên main; migration 024 và 025 đã áp dụng vào Neon; FE, SMTP gateway Vercel và BE Render đã triển khai. Hành trình public và giới hạn nằm trong [KIEM_TRA_PUBLIC_2026-11-16.md](KIEM_TRA_PUBLIC_2026-11-16.md). Tài khoản gửi cũ được giữ, mã được điền `TK-<id>`.

Không gửi email thật, đồng bộ hộp thư thật hoặc tiêu credit SerpAPI trong lượt kiểm thử này. Không dùng ảnh để cam kết phần trăm giống giao diện; không tuyên bố đã thao tác độc lập 257/257 trạng thái Figma. Các số liệu phía trên là kiểm chứng cục bộ; xem báo cáo public cập nhật để biết phần đã chạy trên bản triển khai.
