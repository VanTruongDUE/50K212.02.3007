# Rà soát và sửa giao diện từ mục 20 đến hết Word

Ngày: 16/11/2026. Bản sửa ở máy cục bộ, chưa commit hoặc triển khai public trong lượt này.

## Phạm vi đối chiếu

Đã đọc 72 mục màn hình thuộc phần còn lại của bản Word, bắt đầu mục 20 (trang 25), gồm cả các mục Trưởng phòng được đặt ở cuối tài liệu. Có 66 mục gắn frame Figma, tương ứng 61 frame khác nhau; các mục trùng trạng thái được dùng chung phần triển khai. Phần phụ lục ảnh đã thêm ở lượt trước không được tính lại thành màn mới.

Sáu mục chưa có frame Figma riêng: 60 (ghi nhận kết quả Follow-up), 68–69 (tài khoản gửi Nhân viên), 82 (danh sách Contact đã lưu), 83 (thông tin cá nhân), 90 (lưu mẫu email). Giữ chức năng hiện có; không kết luận các màn này đã khớp một frame độc lập.

## Các phần đã chỉnh

- Tài khoản gửi: form thêm/cập nhật và chi tiết theo hai cột; nhóm trường, mô tả, thanh nút. Giữ OAuth, SMTP và IMAP trong nhóm cấu hình mở rộng, giữ xác thực và dữ liệu API.
- Chiến dịch: bố cục mẫu trống, phần lịch dự kiến riêng, nhãn hợp lệ, thanh nút có nền, vị trí nút chính, hộp xác nhận và lớp phủ, thông báo thành công trên danh sách.
- Contact: bảng xem toàn bộ, duyệt danh sách, bố cục xuất dữ liệu và trạng thái xuất thành công; thông tin nguồn vẫn xem được.
- Response: ngữ cảnh bản ghi, lưới thông tin, lịch sử, nút thao tác và form cập nhật. Form trả lời chọn tài khoản gửi hợp lệ ban đầu.
- Follow-up: nhãn trường, bố cục kết quả và lịch sử; tải lại màn thành công vẫn lấy đúng lịch theo ID; tải lại ghi chú khôi phục nội dung đã lưu. Giữ màn hết lượt riêng với nhánh có phản hồi.

Không đổi hạn mức thành giới hạn theo ngày/giờ như dữ liệu minh họa Figma: yêu cầu đã chốt là 100 email trong 3 ngày. Không thay dữ liệu thật bằng tên, số lượng hoặc chức vụ mẫu trong Figma. Các trường thông tin trống trong dữ liệu hiện tại vẫn hiển thị trung thực.

## Kiểm chứng

- Build và lint FE đạt; 24/24 bài kiểm tra FE đạt; git diff --check đạt.
- Mở và chụp 47 route, đối chiếu cấu trúc với ảnh/frame Figma đã đọc. Không gặp lỗi JavaScript hay lỗi không tìm thấy bản ghi trong bộ dữ liệu kiểm tra.
- 94 trường hợp responsive (47 route × 768px và 390px): không tràn ngang trang, không phát hiện lỗi JavaScript.
- Kiểm tra riêng các trạng thái: xác nhận chiến dịch sau xem email, tạm dừng với lý do trống, tiếp tục gửi, dự kiến lịch gửi/điều chỉnh, xuất CSV/XLSX/JSON/XML, kết quả kiểm tra tài khoản và lưu cập nhật, Follow-up chờ thực hiện/chờ phản hồi/hết lượt.
- Kiểm tra việc mở nhóm cấu hình khi trường SMTP không hợp lệ; hộp thoại phủ toàn viewport và đóng được bằng Escape.

Đọc dữ liệu qua API public và chạy FE cục bộ. Các thao tác ghi API trong kiểm thử được giả lập/cô lập để không sửa dữ liệu public hoặc gửi email. Vì vậy kết quả này xác nhận giao diện và đường đi của thao tác; không thay thế kiểm thử BE/SMTP/IMAP đầu cuối thật. Một số frame dài vốn lớn hơn 1024px; giữ nội dung đầy đủ và cho cuộn khi cần, không giấu trường để ép vừa một màn.

Không sửa tài liệu Word trong lượt này. Không cam kết tỷ lệ khớp pixel hoặc mọi trạng thái đều đã chạy với BE thật.

## Các route đã chụp lại

| Mục | Vai trò | Route | Frame đối chiếu |
|---|---|---|---|
| 07-tp-danh-sach-tai-khoan | Trưởng phòng | `?screen=manager-account-list` | 486:9371 |
| 08-tp-cap-nhat-tai-khoan | Trưởng phòng | `?screen=manager-account-edit&role=manager&senderId=1` | 486:9491 |
| 14-tp-kiem-tra-tai-khoan | Trưởng phòng | `?screen=manager-account-check` | 486:9094 |
| 15-tp-ket-qua-tai-khoan | Trưởng phòng | `?screen=manager-account-result-good&role=manager&senderId=1` | 486:9161 |
| 16-tp-luu-tai-khoan | Trưởng phòng | `?screen=manager-account-saved&role=manager&senderId=1` | 486:9677 |
| 20-nv-da-xac-nhan | Nhân viên | `?screen=confirmed&listId=22` | 16:496 |
| 21-tp-cho-kiem-tra | Trưởng phòng | `?screen=manager-review` | 486:8785 |
| 22-tp-chi-tiet-danh-sach | Trưởng phòng | `?screen=manager-review-detail&role=manager&listId=22` | 486:8846 |
| 23-tp-da-duyet | Trưởng phòng | `?screen=manager-review-approved&role=manager&listId=22` | 486:8984 |
| 24-nv-xuat-contact | Nhân viên | `?screen=export&listId=22` | 18:3126 |
| 25-nv-xuat-thanh-cong | Nhân viên | `?screen=export-success&listId=22` | 16:750 |
| 28-nv-toan-bo-contact | Nhân viên | `?screen=all-contacts&listId=22` | 372:12675 |
| 29-nv-chien-dich | Nhân viên | `?screen=campaign-list` | 327:241209 |
| 30-nv-tao-chien-dich | Nhân viên | `?screen=campaign-contacts` | 327:251508 |
| 32-nv-ket-qua-loc | Nhân viên | `?screen=campaign-filtered&campaignId=15` | 327:252065 |
| 33-nv-nguoi-nhan-da-luu | Nhân viên | `?screen=campaign-pending&campaignId=15` | 327:252598 |
| 34-nv-thu-vien-email | Nhân viên | `?screen=campaign-email&campaignId=15` | 327:253992 |
| 35-nv-bo-cuc-email | Nhân viên | `?screen=campaign-layouts&campaignId=15` | 327:254169 |
| 36-nv-soan-email | Nhân viên | `?screen=campaign-editor&campaignId=15` | 327:254324 |
| 37-nv-xem-truoc-may-tinh | Nhân viên | `?screen=campaign-preview&campaignId=15` | 327:255883 |
| 40-nv-chon-tai-khoan | Nhân viên | `?screen=campaign-sender&campaignId=15` | 327:256420 |
| 42-nv-thiet-lap-lich | Nhân viên | `?screen=campaign-schedule&campaignId=15` | 327:257674 |
| 45-nv-xac-nhan-chien-dich | Nhân viên | `?screen=campaign-confirm&campaignId=15` | 327:258992 |
| 49-nv-danh-sach-response | Nhân viên | `?screen=response-list` | 43:6174 |
| 50-nv-chi-tiet-response | Nhân viên | `?screen=response-detail&responseId=26` | 43:6303 |
| 51-tp-them-tai-khoan | Trưởng phòng | `?screen=manager-account-add` | 486:9432 |
| 52-tp-chi-tiet-tai-khoan | Trưởng phòng | `?screen=manager-account-detail&senderId=1` | 229:33584 |
| 53-nv-them-response | Nhân viên | `?screen=response-add` | 43:6301 |
| 54-nv-cap-nhat-response | Nhân viên | `?screen=response-edit&responseId=26` | 60:6324 |
| 55-nv-trang-thai-response | Nhân viên | `?screen=response-status&responseId=30` | 43:6297 |
| 56-nv-tao-followup | Nhân viên | `?screen=followup-create&responseId=31` | 43:6299 |
| 57-nv-followup-da-tao | Nhân viên | `?screen=followup-success&followupId=17` | 99:32139 |
| 58-nv-danh-sach-followup | Nhân viên | `?screen=followup-list` | 43:6302 |
| 59-nv-followup-cho-thuc-hien | Nhân viên | `?screen=followup-result&followupId=17` | 43:6298 |
| 60-nv-ghi-nhan-ket-qua | Nhân viên | `?screen=followup-detail&followupId=17` | Không có frame riêng |
| 62-nv-ghi-chu-followup | Nhân viên | `?screen=followup-note&followupId=17` | 43:6304 |
| 63-nv-soan-phan-hoi | Nhân viên | `?screen=response-reply&responseId=30` | 43:6300 |
| 64-nv-da-gui-phan-hoi | Nhân viên | `?screen=response-detail&responseId=30` | 43:6303 |
| 65-nv-lich-su-phan-hoi | Nhân viên | `?screen=response-history&responseId=30` | 47:7604 |
| 66-nv-lich-su-trang-thai | Nhân viên | `?screen=response-status-history&responseId=30` | 47:7735 |
| 68-nv-tai-khoan-gui | Nhân viên | `?screen=sender-list` | Không có frame riêng |
| 69-nv-chi-tiet-tai-khoan | Nhân viên | `?screen=sender-detail&senderId=1` | Không có frame riêng |
| 76-nv-chon-muc-sua | Nhân viên | `?screen=campaign-list&campaignId=15` | 327:247194 |
| 78-nv-tiep-tuc-chien-dich | Nhân viên | `?screen=campaign-resume&campaignId=15` | 327:249944 |
| 82-nv-cac-danh-sach-contact | Nhân viên | `?screen=contact-lists` | Không có frame riêng |
| 83-nv-menu-tai-khoan | Nhân viên | `?screen=profile` | Không có frame riêng |
| 87-nv-xuat-xlsx | Nhân viên | `?screen=export&listId=23` | 18:3162 |
