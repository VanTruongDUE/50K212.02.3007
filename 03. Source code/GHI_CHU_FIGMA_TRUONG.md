# Chỉ mục Figma — trang Trường

> Rà lại 13/11/2026: đã mở các route chính của Nhân viên trên bản FE dùng API ở 1440 × 1024 cùng bộ 49 route Nhân viên; các route đều có tiêu đề và không cuộn ngang. Điều này kiểm chứng điều hướng/màn render, chưa thay thế đối chiếu ảnh riêng cho 75 frame hoặc kiểm tra Google Search (chưa tích hợp theo phạm vi đã chốt).

> Cập nhật 12/11/2026: bản FE đăng nhập thực dùng `LiveFlows.tsx` cho danh sách Contact và Filter Template, còn màn Thiết lập tiêu chí dùng `Flow.tsx` với Google Search bị khóa cho đến khi có tích hợp. Đã tách lại các bước kiểm tra, xác nhận, xem toàn bộ và xuất Contact với dữ liệu API; đã thử luồng xuất CSV trong trình duyệt. Figma Bridge đã kết nối lại: đã đối chiếu trực tiếp màn Thiết lập tiêu chí, Filter Template, Tạo Filter Template và Xuất Contact ở 1440 px; chưa so từng ảnh trong cả 75 frame trên bản FE dùng API.

Nguồn: [Màn hình giao diện_Nhóm2](https://www.figma.com/design/jXKaLKxLAOL4mVyC4cReYZ/M%C3%A0n-h%C3%ACnh-giao-di%E1%BB%87n_Nh%C3%B3m2?m=auto&t=qDMpQZq3qnBanuPp-1), trang `Trường` (`11:2`). Đã đọc danh sách và nội dung 75 frame qua Figma UI MCP; đã xem ảnh một số frame chính. Đây là chỉ mục để tìm lại đúng thiết kế, không thay thế việc đọc frame/component và so ảnh khi code.

## Hệ giao diện quan sát được

- Các màn hình chính và trạng thái có kích thước **1440 × 1024**; frame tổng hợp `Trạng thái tương tác` cao 1160 px. Chưa thấy frame cho viewport khác trên trang này.
- Giao diện DarkBlue; font **Arial**. Text style: heading 24/32 bold, body 16/24 regular, label 16/24 bold, table header 14/20 bold.
- Token tiêu biểu của `SP1/Draft/UI`: canvas `#081426`, surface `#0d1d33`, raised `#142b47`, selected `#203f64`, text `#edf5ff`, secondary `#b4c7e2`, primary `#2d6cdf`, border `#294567`, error `#ffa8ae`, focus `#bedbff`. Radius control 8 px, panel 12 px; spacing cơ bản 8/16/24 px. File còn có collection `V5/UI` tham chiếu các primitive tương ứng.
- Màn hình đăng nhập ban đầu `156:31985`: form bên trái rộng 432 px, tiêu đề Email/Mật khẩu/nút Đăng nhập; ảnh nơi làm việc bên phải 688 × 976 px, có lớp caption phía dưới. Ảnh là asset trong Figma, cần xuất đúng asset khi code.
- Sau đăng nhập, layout ứng dụng có sidebar 240 px và vùng nội dung bên phải. Frame thành công của Nhân viên và Trưởng phòng dùng menu khác nhau.
- Sáu frame đầu trang (`16:20` đến `16:130`) có nhãn **UI Draft** trong nội dung. Các frame chi tiết phía sau thể hiện rõ hơn từng trạng thái; cần dùng đúng frame được BA chỉ định khi triển khai, nhất là khi tên frame trùng nhau.

## UC1 — Đăng nhập

| Nhóm | Frame ID | Nội dung đã thấy |
| --- | --- | --- |
| Nhập liệu | `156:31985`, `156:32011` | Ban đầu và đã nhập email/mật khẩu; mật khẩu được che. |
| Validation | `156:32037`, `156:32063`, `156:32089`, `156:32115` | Thiếu cả hai trường, thiếu email, email sai định dạng, thiếu mật khẩu; lỗi hiện sát trường. |
| Xác thực/quyền | `156:32141`, `156:32167` | Sai email hoặc mật khẩu; không xác định được quyền, kèm nguyên nhân và hướng xử lý. |
| Tương tác | `156:32193`, `156:32219`, `156:32245`, `156:32481` | Đang đăng nhập, focus Email, hover nút, focus nút. Khi đang xử lý giữ giá trị đã nhập. |
| Vai trò sau đăng nhập | `156:32271`, `156:32370` | Trang chính Nhân viên Marketing và Trưởng phòng Marketing; sidebar khác nhau. |
| Ví dụ Trưởng phòng | `156:32406`, `156:32430` | Đã nhập thông tin và đang đăng nhập với vai trò Trưởng phòng. |

## UC2–UC4 — Tìm kiếm và quản lý Contact

| Nhóm | Frame ID | Nội dung đã thấy |
| --- | --- | --- |
| Thiết lập tiêu chí | `16:188`, `38:6251`, `16:373` | Chọn chức vụ, ngành nghề, địa điểm, từ khóa, quy mô, trạng thái email và nguồn Google Search/Web hoặc Apollo; xem lại rồi xác nhận trước khi tìm. |
| Filter Template | `16:241`, `16:271`, `16:322` | Xem/áp dụng, tạo và cập nhật Template. Tên và bộ tiêu chí được kiểm tra trước khi lưu. |
| Tìm kiếm | `16:626`, `16:403`, `16:645`, `16:664` | Đang tìm, kết quả, không có Contact, tìm kiếm thất bại. Không có kết quả vẫn lưu lịch sử 0; thất bại giữ bộ tiêu chí và không tạo Contact mới. |
| Kiểm tra/xác nhận | `16:436`, `16:472`, `16:496`, `372:12675`–`372:14747` | Lưu đánh giá Đạt/Chưa đạt riêng với xác nhận; danh sách chỉ xác nhận sau khi đạt. Có xem toàn bộ Contact qua 5 trang. |
| Xuất | `16:529`, `18:3126`, `18:3162`, `18:3198`, `18:3234`, `54:8613`, `16:750`, `16:865` | Chọn CSV/XLSX/JSON/XML, trạng thái đang tạo CSV, thành công và thất bại; lỗi giữ danh sách và định dạng đã chọn. |
| Lịch sử | `16:560`, `16:589`, `16:789`, `54:8553` | Danh sách các lần tìm và trang chi tiết; trạng thái chưa có dữ liệu/lỗi tải. |
| Validation/lỗi bổ sung | `16:683`, `16:731`, `16:770`, `16:808`, `16:827`, `16:846`, `54:7783`–`54:8583`, `56:9111`, `56:9526` | Ít nhất một điều kiện hợp lệ, từ khóa không chỉ có khoảng trắng, tên Template thiếu/trùng, Apollo lỗi/rỗng, lưu/đánh giá/xác nhận/tải dữ liệu lỗi. Các thông báo nêu cách sửa hoặc thử lại. |
| Trạng thái điều khiển | `56:9043` | Default, hover, focus bàn phím, disabled, loading cho nút/field/select; lỗi có cả nội dung và viền. Khi lỗi giữ bản nháp; khi xử lý khóa gửi lặp, không hiển thị tiến độ giả. |

Số lượng `48 nhận được / 7 không hợp lệ / 3 trùng / 38 mới hợp lệ`, tên Contact, email mẫu và ngày giờ trong các frame là **dữ liệu minh họa**, không phải dữ liệu hoặc quy tắc mặc định của hệ thống.

Trước khi code từng màn hình: đọc lại `get_design_context` và screenshot của frame ID tương ứng, kiểm tra component/variant/asset, đối chiếu UC/BPMN, rồi so ảnh ở viewport 1440 × 1024.

## Cập nhật kiểm tra FE — 10/11/2026

- Đã có FE cho luồng Nhân viên Marketing. 43 route/trạng thái UC2–UC4 đều có nội dung và không cuộn ngang toàn trang khi kiểm tra trên trình duyệt ở 1440 × 1024 và 1280 × 900. Luồng chính từ chọn tiêu chí → kết quả → kiểm tra → xác nhận → chọn định dạng xuất đi được bằng nút trên màn hình. Màn đăng nhập và 9 trạng thái xem thử của UC1 cũng mở được ở 1440 × 1024; đã thử lỗi thiếu hai trường và đăng nhập hợp lệ để vào Trang chính.
- Đã so ảnh trực quan màn Thiết lập tiêu chí và Kết quả tìm kiếm với frame Figma cùng kích thước 1440 × 1024. Đã sửa nguồn tìm kiếm mặc định: hai ô đều chưa chọn như frame ban đầu; khi tiếp tục mà chưa chọn nguồn, FE hiển thị lỗi và giữ tiêu chí đã nhập.
- Chưa thể kết luận toàn bộ 75 frame khớp Figma: chưa so ảnh từng frame và từng trạng thái. Danh sách/lịch sử tìm kiếm nay mở được chi tiết từng lần; chỉ lần đầu có dữ liệu Contact gốc từ Figma, những lần khác hiển thị dữ liệu minh họa và không tự tạo tiêu chí chưa được cung cấp. Màn xuất tạo tệp CSV, XLSX, JSON hoặc XML từ 38 Contact mẫu. Các trạng thái lỗi phụ thuộc tình huống chỉ có route xem thử, chưa có đường thao tác tự nhiên để kích hoạt.
