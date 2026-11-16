# Kiểm tra tích hợp sau khi sửa giao diện — 16/11/2026

## Kết luận và phạm vi

Các luồng chính đã kiểm tra chạy được trên FE local hiện tại, API NestJS hiện tại và PostgreSQL thật trong database kiểm thử riêng. Các thao tác lưu không dùng API giả lập trên trình duyệt. Dữ liệu đã được đọc lại qua API và truy vấn SQL độc lập để đối chiếu.

Không có lỗi JavaScript hoặc HTTP nghiệp vụ thất bại trong lượt chạy cuối. Không phát hiện lỗi hồi quy cần sửa thêm trong các luồng đã chạy. Điều này không chứng minh mọi trạng thái của toàn bộ dự án đều đã đạt, hoặc dịch vụ sẽ ổn định 24/7.

FE local: http://127.0.0.1:5176. API kiểm thử riêng: http://127.0.0.1:3305, chỉ lắng nghe loopback. Không commit, push hoặc deploy trong lượt này. Public vẫn là phiên bản đã triển khai trước những chỉnh sửa local.

## Môi trường và giới hạn kiểm thử

- Database riêng được tạo từ migration và tài khoản seed; không sửa dữ liệu người dùng hiện có.
- SerpAPI và trang web nguồn được thay bằng dữ liệu nguồn kiểm thử tại ranh giới dịch vụ BE. Phần tạo truy vấn, xử lý công việc, trích email, loại trùng, lưu nguồn và lưu Contact dùng code thật.
- Vận chuyển thư ra ngoài được thay bằng bộ ghi nhận trong bộ nhớ tại SmtpService. Xác nhận chiến dịch, dựng nội dung, hàng đợi, DeliveryWorker, cập nhật lịch sử gửi và hạn mức dùng code thật; không gửi email tới người thật.
- Nhập thư dùng PostalMime và InboxService.store thật với thư trả lời có In-Reply-To/Message-ID liên kết tới lượt gửi. Chưa dùng một thư mới đi qua máy chủ Gmail trong vòng E2E local này.
- FollowupWorker chạy thật. Thời điểm hoàn tất của dữ liệu kiểm thử được dịch về quá khứ để kiểm tra hết thời gian chờ; không chờ nhiều ngày thực tế.
- Giới hạn tần suất đăng nhập được bỏ qua riêng trong server kiểm thử để cho phép chạy lại trình duyệt; SessionGuard và kiểm tra role vẫn hoạt động. Không thay đổi cấu hình ứng dụng thật.

## Kết quả luồng tích hợp

| Luồng | Thao tác và bằng chứng | Kết quả |
|---|---|---|
| Đăng nhập hai role | Phiên thật; FE nhận role từ API; nhân viên không được gọi Dashboard, trưởng phòng không được tạo Response thay nhân viên | Đạt |
| Thiết lập tiêu chí → kiểm tra → xác nhận → tìm kiếm | Nhập từ khóa và chọn Google Search/Web trên FE; công việc BE thực thi và lưu 2 Contact | Đạt với nguồn tìm kiếm kiểm thử |
| Kiểm tra danh sách → xác nhận → trưởng phòng duyệt | Chuỗi danh sách tìm kiếm được duyệt qua API. Một danh sách bổ sung được kiểm tra, xác nhận và duyệt hoàn toàn bằng nút trên FE | Đạt; SQL xác nhận passed/confirmed/approved |
| Danh sách tài khoản gửi | Bấm dòng chỉ chọn dòng; bấm cập nhật mở đúng tài khoản | Đạt |
| Cập nhật tài khoản gửi | FE đổi tên, bấm Lưu thông tin; API và SQL đọc lại tên mới, mã QA01, hạn mức 100/3 ngày, trạng thái hoạt động | Đạt |
| Tạo chiến dịch | FE chọn danh sách đã duyệt, nhập tên và áp dụng; tạo đúng bản ghi và URL campaignId | Đạt |
| Soạn email | Mở bố cục; nhập tiêu đề/nội dung có biến; chọn logo thư viện; xem trước; quay lại lưu nội dung | Đạt; nội dung và asset lưu vào BE |
| Chọn tài khoản → lịch gửi | FE chọn tài khoản hoạt động, xác nhận; chọn Gửi ngay; lưu lịch gửi | Đạt |
| Xác nhận chiến dịch | Xem nội dung, đóng popup, xác nhận gửi và đồng ý trong hộp thoại | Đạt |
| DeliveryWorker | Xử lý cả 2 người nhận qua bộ vận chuyển kiểm thử | SQL: 2 lượt sent, chiến dịch completed |
| Nhập thư và phân loại | Thư trả lời ghép chiến dịch, người phụ trách và Contact; tiếng Việt xin thông tin/bảng giá được gán need_info | Đạt |
| Chống nhập trùng | Xử lý lại cùng UID/UIDVALIDITY không tạo Response thứ hai | SQL: đúng 1 inbound_messages cho thư đó |
| Response danh sách/chi tiết | Hiển thị dữ liệu mới từ BE; mở chi tiết và lịch sử | Đạt |
| Sửa Response | FE đổi nội dung và số điện thoại; lưu; SQL xác nhận đúng giá trị | Đạt |
| Cập nhật trạng thái | FE chuyển Mới → Đang xử lý, nhập ghi chú | SQL có lịch sử new → processing cùng ghi chú |
| Phản hồi email | FE nhập nội dung, tiêu đề, chọn tài khoản và gửi | SQL có tương tác email và lượt gửi sent; trạng thái replied |
| Tạo Follow-up | FE tạo lịch gọi điện và mục tiêu; hoàn tất bằng nút trên FE | Đạt; không thực hiện cuộc gọi thật |
| Hết lượt không phản hồi | Chạy worker qua lượt 1 rồi lượt 2; FE mở kết quả | Hiện “Không có phản hồi sau lần 2/2”; không tạo lượt 3 |
| Có phản hồi | Lịch được hoàn tất, sau đó tạo phản hồi đến cùng khách hàng trong khoảng chờ; worker phân giải | outcome=responded; FE mở màn chi tiết, không hiện cảnh báo hết lượt |
| Tải lại và định danh | Reload Response, Follow-up và màn cập nhật tài khoản gửi | Giữ đúng ID; không đổi sang bản ghi đầu tiên |
| Responsive | Kiểm tra màn chi tiết Response tại 390×844 | Không tràn ngang toàn trang |

## Đối chiếu giao diện

Đối chiếu theo ảnh BA cung cấp và các frame đã đọc qua Figma MCP, ở viewport desktop 1440×1024. Giữ dữ liệu từ database; không thay bằng tên khách hàng hay số liệu minh họa của Figma.

| Màn hình | Nguồn chuẩn | Nội dung đã kiểm tra |
|---|---|---|
| Popup thông tin chiến dịch | Frame 327:241792 / dialog 327:242322 | Popup 480px, tiêu đề, hai cột, badge, ngày giờ, nút Đóng |
| Quản lý Response | Frame 43:6174 | Các cột, ngày/giờ hai dòng, viền hàng, vị trí Thêm/Ẩn |
| Chi tiết Response | Frame 43:6303 | Thông tin ba cột, bảng lịch sử, các nút lịch sử, bốn nút cuối |
| Cập nhật Response | Frame 60:6324 | Chọn khách hàng, Email/Điện thoại hai cột, khung nội dung và Lưu/Hủy |
| Cập nhật trạng thái | Frame 43:6297 | Hai cột trạng thái, ghi chú, khung thông tin và Xác nhận/Hủy |
| Danh sách tài khoản gửi | Frame 486:10326 và ảnh BA | Bốn cột, màu chọn, hướng dẫn, ba nút |
| Cập nhật tài khoản gửi | Frame 486:10446 và ảnh BA | Hai cột, trạng thái, hướng dẫn, Lưu/Hủy; giữ cấu hình kết nối |
| Tạo/soạn chiến dịch | Các ảnh BA và frame đã đối chiếu trong lượt sửa | Các bước, checkbox, thư viện mẫu, logo, editor, tài khoản và lịch gửi được thao tác trong lượt E2E |

Các khác biệt được giữ theo quyết định nghiệp vụ: hạn mức 3 ngày thay cho ngày/giờ; sidebar Trưởng phòng giữ hai mục con; cấu hình Gmail/SMTP/IMAP mở rộng vẫn có để quản lý kết nối. Dữ liệu dài có thể làm khối cao hơn để không cắt chữ.

**Điểm chưa khớp nghiệp vụ Figma:** dòng hướng dẫn của màn cập nhật trạng thái Figma cho phép “Hủy”, nhưng BE chỉ cho new → processing → replied → closed. Lượt sửa FE không tự thêm nhánh Hủy; giao diện chỉ ghi chuyển trạng thái BE đang hỗ trợ. Đây vẫn là điểm cần BA quyết định, không đánh dấu đã hoàn thành nhánh này.

## Kiểm tra public và dịch vụ thật

Không deploy. Chỉ kiểm tra kết nối của bản public hiện tại:

- Render /health: HTTP 200, status=ok, database=up.
- Qua FE public → API: kiểm tra tài khoản Google đang liên kết, /verify: HTTP 201, verified=true.
- /verify-inbox: HTTP 201, verified=true.
- Không gửi email mới, không đồng bộ thêm nội dung thư hoặc tạo dữ liệu thử trên database public.

Các kiểm tra này xác nhận tài khoản gửi/hộp thư đang kiểm tra kết nối thành công; không chứng minh một email mới đã gửi và nhận thành công qua Gmail sau lượt sửa FE này. Tìm kiếm SerpAPI thật chưa được chạy lại trong lượt này.

## Kiểm tra tự động

- FE: 24/24 test đạt; build và lint đạt.
- BE: 230/230 unit test thuộc 19 suite đạt; 3/3 HTTP e2e test đạt; build đạt.
- Migration → seed → smoke nghiệp vụ trên database PostgreSQL riêng: đạt.
- Migration → seed → smoke tìm kiếm trên database PostgreSQL riêng: đạt.
- Browser: các thao tác chính nêu trên đạt, không có lỗi runtime hoặc HTTP nghiệp vụ trong lượt chạy cuối.
- git diff --check đạt; có cảnh báo chuẩn hóa LF/CRLF ở flow.css đã tồn tại.

## Bằng chứng

- [Dữ liệu kiểm chứng trực tiếp từ PostgreSQL](database-results.json)
- [Log HTTP và kết quả trình duyệt ở lượt cuối](browser-results.json)
- [Kiểm tra kết nối public/mail thật](live-mail-results.json)
- Ảnh các bước trong thư mục [anh](anh/), đánh số theo luồng. Một số bước được chụp ở lượt đầu và giữ lại khi chạy tiếp; log lượt cuối không thay thế ảnh và kiểm chứng database của các bước trước đó.

Chưa kiểm tra tải lớn, phục hồi sự cố, tất cả 196 trạng thái Figma hoặc vận hành dài hạn. Không kết luận toàn bộ dự án hoàn tất 100% từ kết quả của phạm vi này.

Server kiểm thử riêng đã dừng và database kiểm thử đã được dọn sau khi lưu bằng chứng. Server local đang dùng trước đó và dữ liệu public được giữ nguyên.
