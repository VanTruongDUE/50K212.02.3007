# Đối chiếu kiểu chữ FE với Figma — 16/11/2026

Đã đo computed style trên 31 màn/route của hai role và đối chiếu với các frame Figma qua MCP. Phạm vi là kiểu chữ và các nhãn liên quan; không sửa API, database, quyền hay quy tắc gửi email. Chưa commit hoặc deploy các thay đổi kiểu chữ này.

## Thay đổi

| Thành phần | Kết quả |
|---|---|
| Font | Giữ Arial trên các frame Nhân viên, trang chính và chi tiết tài khoản dùng Arial; tải Inter vào dự án cho nhóm frame quản lý Trưởng phòng dùng Inter. Hai nhãn tại màn sửa Response và khung quy tắc Follow-up dùng Inter theo node Figma tương ứng. |
| Font thực tế | Chromium xác nhận Arial-BoldMT được dùng cho tiêu đề Nhân viên; Inter Variable được tải từ file dự án và dùng cho tiêu đề Trưởng phòng. Không chỉ kiểm tra chuỗi font-family. |
| Tiêu đề | 24px, Bold 700, line-height 32px, màu #edf5ff theo các frame đã đối chiếu. |
| Nội dung và nhãn | Chỉnh các chỗ đang 14/15px về 16px với line-height 24px khi frame yêu cầu; giữ Regular 400/Bold 700 theo từng nhóm. |
| Sidebar | Mục con từ 14px thành 16px; chỉnh màu chữ; giữ nguyên logic chỉ mục được chọn mới in đậm theo yêu cầu BA trước đó. |
| Bảng | Chỉnh header, dòng dữ liệu, lịch sử tìm kiếm và Response/Follow-up theo font/cỡ/màu của frame; không áp dụng máy móc style Table Header 14px vì nhiều node Figma đã override thành 16px. |
| Nút | Màu chữ primary #f6faff trên nhóm Arial và #edf5ff trên nhóm quản lý Inter theo thiết kế; căn lại độ đậm của thao tác trong bảng chiến dịch. |
| Trạng thái | Badge chiến dịch dùng 16px/24px, chỉnh màu; nhãn paused hiển thị “Đã tạm dừng”. Giá trị trạng thái BE vẫn là paused. |
| Breadcrumb, hướng dẫn | Chỉnh cỡ chữ, line-height, màu nguồn/tiêu chí, trạng thái xác nhận và hướng dẫn. |
| Dấu bắt buộc | Ẩn dấu sao tại các nhãn mà Figma không có dấu sao trong form tài khoản gửi/template; thuộc tính required và kiểm tra dữ liệu vẫn giữ nguyên. |
| Font asset | File Inter Variable gốc, kèm SIL Open Font License. Font được phục vụ cùng FE, không cần gọi dịch vụ font bên ngoài. |

## Kiểm chứng

- Đọc trực tiếp thông số TEXT của các frame dùng trong đối chiếu qua Figma MCP.
- Đo font-family, font-size, font-weight, line-height, color của những nhãn xuất hiện trên FE.
- Đối chiếu 687 lần xuất hiện có nội dung trùng khớp giữa FE và node Figma. Đây không phải số lượng toàn bộ chữ của toàn dự án.
- Kiểm tra font tải xong bằng document.fonts.ready và font thực tế bằng Chromium CSS.getPlatformFontsForNode.
- Chụp ảnh ở 1440px, 1024px và 390px cho hai màn đại diện hai font; không tràn ngang toàn trang trên các màn này.
- Build, lint, 24/24 test FE, git diff --check đều đạt. Build còn cảnh báo bundle lớn hơn 500 KB như trước.
- Không thực hiện thao tác ghi dữ liệu hoặc gửi email thật trong lượt kiểm tra kiểu chữ.

## Các trường hợp cần diễn giải khi đọc audit.json

File so sánh tự động còn sáu cờ thô, đã rà theo ngữ cảnh:

1. Frame “Tạo chiến dịch mới” có line-height 64px trong khung chữ 32px. BA đã chọn giữ 32px để tránh cắt chữ.
2. Trang chính Nhân viên: Figma gán đậm cho “Thiết lập tiêu chí” dù đây chưa phải mục đang chọn. Giữ logic trạng thái chọn đã được BA yêu cầu, không ép in đậm mặc định.
3. Trang chính Trưởng phòng và chi tiết tài khoản: Figma để chữ mục đang chọn Regular; FE giữ Bold theo yêu cầu BA trước đó.
4. Tiêu đề “Kiểm tra danh sách” đã bỏ hậu tố Contact theo yêu cầu BA. Thuật toán trùng chữ đối chiếu nhầm với nhãn sidebar 16px; tiêu đề vẫn dùng style Heading 24px/32px của frame.
5. Số “4” trong dữ liệu tài khoản gửi trùng số thứ tự stepper Figma. Ô dữ liệu giữ 16px Regular; không lấy kiểu chữ số stepper để áp vào số liệu BE.

Không đổi dữ liệu khách hàng, số người nhận, nhãn nghiệp vụ hoặc hạn mức 3 ngày thành giá trị minh họa trong Figma. Không kết luận mọi trạng thái của toàn bộ file Figma đã được so chữ từng node; lượt này bao phủ các màn chính đã mở và các thành phần dùng chung.

## Bằng chứng

- [Kết quả đối chiếu theo màn và node](audit.json)
- [Font thực tế và kiểm tra ba kích thước](render-results.json)
- [Nhân viên desktop](anh/employee-verified-1440.png)
- [Trưởng phòng desktop](anh/manager-verified-1440.png)
- [Trưởng phòng mobile](anh/manager-verified-390.png)

Phần sửa này đang ở local. Bản public hiện tại vẫn là commit ffcb876, chưa có thay đổi kiểu chữ trong báo cáo này.
