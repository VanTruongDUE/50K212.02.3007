# Kiểm tra bản public ngày 16/11/2026

Website: https://v5-marketing.vercel.app. API: https://v5-marketing-api.onrender.com.

## Triển khai và kiểm tra

- `9eb862f`: đồng bộ typography theo Figma, font Inter và tài liệu đối chiếu.
- `318901e`: sửa nút “Xem hồ sơ / Lập lịch” để mở form Follow-up đang có.
- `2ff7fa5`: bổ sung tên khách hàng trên thông báo tạo lịch, sửa đường dẫn “Tạo lịch khác”, làm đậm trạng thái xác nhận danh sách.
- Vercel báo success; JS/CSS public trùng bản build local. Render `/health` trả `status: ok`, `database: up`.
- Build, lint và 24 bài kiểm tra FE đạt. Kiểm tra trình duyệt local mô phỏng đúng hợp đồng POST tạo Follow-up không chứa tên khách hàng: thông báo vẫn hiện đúng tên, nút tạo lịch khác mở lại đúng form. Không ghi dữ liệu public trong phép kiểm tra mô phỏng này.

## Năm lượt tìm email thật

Thao tác nhập tiêu chí, kiểm tra, xác nhận và bắt đầu tìm được thực hiện trên Brave bằng agent-desktop. Số liệu đối chiếu bằng API public sau khi tác vụ hoàn tất; kết quả lưu trong database public.

| Từ khóa | Mã tìm | Danh sách | Nhận được | Không hợp lệ | Trùng | Email mới |
|---|---:|---:|---:|---:|---:|---:|
| logistics | 7 | 24 | 20 | 2 | 0 | 18 |
| công ty phần mềm | 8 | 25 | 6 | 0 | 0 | 6 |
| du lịch | 9 | 26 | 17 | 2 | 2 | 13 |
| nội thất | 10 | 27 | 5 | 0 | 0 | 5 |
| bao bì | 11 | 28 | 7 | 1 | 4 | 2 |
| Tổng | | | 55 | 5 | 6 | 44 |

Mỗi lượt đọc tối đa 20 trang. Có website lỗi/chặn truy cập, tài liệu PDF, mạng xã hội và kết quả ngoài nhóm doanh nghiệp mục tiêu. Cảnh báo chi tiết nằm trong `ket-qua-tim-kiem.json`. Email mới là email công khai hợp lệ cú pháp, chưa chứng minh khả năng nhận thư hay đúng chức vụ. Danh sách CSV giữ email và URL nguồn; không kèm token hủy đăng ký.

## Luồng đã thao tác thật trên public

1. Đăng nhập Nhân viên, tìm kiếm thật, xem kết quả, tải lại trang vẫn giữ đúng mã tìm kiếm.
2. Kiểm tra danh sách 24 → lưu Đạt → xác nhận. API lưu `employee_review=passed`, `confirmed_at` và `manager_review=pending`.
3. Đăng xuất, đăng nhập Trưởng phòng → chọn danh sách 24 → xem chi tiết → Duyệt. API lưu `manager_review=approved`.
4. Tài khoản gửi → chọn Gmail Marketing → Cập nhật → Lưu thông tin. Database ghi thời điểm cập nhật mới, giữ email và cấu hình. Xác thực gửi và IMAP cùng đạt.
5. Trở lại Nhân viên → tạo chiến dịch 19 từ danh sách vừa duyệt → lọc 18 người nhận → xác nhận người nhận → chọn bố cục → soạn nội dung → chọn logo thư viện → xem trước → lưu → chọn tài khoản gửi → lưu lịch → màn xác nhận hiển thị đủ bốn nhóm hợp lệ.
6. Chiến dịch 19 được giữ bản nháp chưa xác nhận gửi. Không gửi thư tới 44 email vừa tìm được.
7. Response 3: Mới → Đang xử lý → gửi một phản hồi thật tới hộp thư kiểm thử `chanbedu14022006@gmail.com`. Gmail nhận thư, API lưu lịch sử và trạng thái Đã phản hồi.
8. Mở Gmail trên Brave, trả lời “Tôi cần thêm thông tin về giải pháp.” → IMAP tự tạo Response 32, đúng chiến dịch 3, nhãn `need_info`, trạng thái Mới.
9. Follow-up → mở form lập lịch bằng nút đã sửa → chọn Response 3 → lưu FU-18 với lịch mặc định hai ngày làm việc. Mở chi tiết, ghi nhận hoàn tất; trạng thái chuyển sang đang chờ phản hồi.
10. Gửi thêm thư trả lời từ hộp thư kiểm thử sau khi hoàn tất FU-18. IMAP tạo Response 33. Worker tự đổi FU-18 sang `done/responded` lúc 05:40:55 UTC. Mở lại và tải lại màn kết quả vẫn đúng Trường kiểm tra public / Response 3 / FU-18. Không có lỗi worker.

## Đối chiếu giao diện

- Rà 31 màn public, 700 lần xuất hiện nội dung chữ khớp với dữ liệu Figma đã trích: font, cỡ, độ đậm, chiều cao dòng, màu. Có ảnh từng màn trong thư mục `anh` và kết quả trong `doi-chieu-kieu-chu.json`.
- Bảy cờ ban đầu: một dòng trạng thái xác nhận thiếu đậm đã sửa và xác nhận lại trên public; các cờ còn lại là line-height 32px đã được chốt, quy tắc sidebar chỉ in đậm mục đang chọn, hoặc đối chiếu chuỗi nhầm giữa tiêu đề/sidebar và số dữ liệu/số bước. Đây không phải phép so sánh pixel toàn bộ trạng thái Figma.
- Kiểm tra font thực tế trong trình duyệt: Arial cho màn Response Nhân viên, Inter Variable cho cập nhật tài khoản Trưởng phòng. Hai màn đại diện không tràn ngang ở 1440, 1024 và 390px. Không suy rộng kết quả này thành đã kiểm mọi màn ở mọi breakpoint.

## Các điểm còn cần lưu ý

- Chưa gửi một chiến dịch mới trọn vẹn trong lượt này: hộp thư kiểm thử đã nhận chiến dịch trong bảy ngày gần đây. Không bỏ qua quy tắc chống gửi lại; đang chờ chủ dự án cung cấp hộp thư kiểm thử khác. Gửi Response và nhận trả lời qua Gmail đã kiểm tra thật.
- Câu “Tôi cần thêm thông tin về giải pháp.” được phân loại đúng. Câu “Tôi đã nhận được thông tin và muốn được tư vấn thêm.” về nhãn Khác; bộ quy tắc chưa bao phủ biến thể này và cần nhân viên kiểm tra.
- Luồng Hủy Response trong Figma chưa có trạng thái BE tương ứng; public hiện chỉ cho Mới → Đang xử lý → Đã phản hồi → Đã chốt nhu cầu. Không tự bổ sung trạng thái nghiệp vụ trong lần kiểm thử này.
- Chưa chờ đủ nhiều ngày để thử thực tế nhánh hết thời gian chờ và hết lượt trên public. Nhánh hết lượt đã có kiểm tra tự động và kiểm thử tích hợp trước đây; không coi đó là đã chạy lại thời gian thật trên public lần này.
- Render Free và OAuth Testing vẫn có giới hạn vận hành. Kết quả kiểm tra này không bảo đảm vận hành liên tục 24/7 hoặc mọi trạng thái Figma đều hoàn hảo.
