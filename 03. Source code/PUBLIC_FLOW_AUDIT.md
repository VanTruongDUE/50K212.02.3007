# Kết quả audit nghiệp vụ public — 15/11/2026

Nguồn: thao tác Brave bằng agent-desktop trên web public, trace source độc lập, đối chiếu API/PostgreSQL cloud trong lượt này; kết quả triển khai cũ được dẫn riêng ở `DEPLOY_VERIFICATION.md`. Không đồng nhất các phép kiểm tra API với việc đã bấm mọi nút trên web.

**Kết luận hiện tại:** các luồng chính lưu dữ liệu hoạt động, nhưng chưa thể kết luận web đã qua toàn bộ nghiệp vụ. Có P1 đổi danh tính bản ghi khi refresh, đã tái hiện ở Contact, Response và Follow-up. Chưa sửa P1 trong lượt audit này.

| Trạng thái | Phạm vi cụ thể |
| --- | --- |
| PASS cho thao tác đã nêu | Đăng nhập/đăng xuất hai vai trò; form trống, email sai định dạng, sai thông tin và URL manager khi chưa đăng nhập. Nhân viên kiểm tra Chưa đạt rồi Đạt/xác nhận list6; manager duyệt list6, từ chối list7 với nhận xét bắt buộc. CSV tải về có 4 cột, đúng 1 Contact. Tạo/sửa/áp dụng Filter Template3. SMTP verify, IMAP verify và sync có thông báo thành công. Thêm sender Ngừng hoạt động, sửa hạn mức80 rồi hủy/đồng ý Ẩn; danh sách chỉ còn Gmail thật |
| PARTIAL | Campaign7 compose/save/previewdesktop/sender1/nowmode/mở xác nhận cuối rồi đóng; tạo chiến dịch mới từ list6 vừa duyệt qua bước lọc và xác nhận người nhận. Response9 sửa và chuyển Đang xử lý; Response8 hủy popup rồi xác nhận Ẩn. Tạo phone FU7 hẹn17/11; FU4 ghi nhận kết quả needsNext=false; FU7 xác nhận Ẩn. Đối chiếu 11 điều kiện DB/CSV đạt, không phát sinh delivery ở Campaign7. Chưa phủ toàn bộ nhánh lỗi, giới hạn hoặc gửi thật của các thao tác này |
| PASS một lượt tìm thật; chất lượng cần kiểm tra | GUI nhập FPT Software → review → tìm Google/SerpAPI → search1 hoàn tất, xử lý20 trang, 1 Contact mới/list10 → history/detail/xem toàn bộ. Cảnh báo URL lỗi và giới hạn20 trang hiển thị. Email có nguồn fpt.vn/vi, thuộc hệ FPT nhưng chưa đủ chứng minh phù hợp FPT Software; không coi email tìm thấy là đúng chức vụ/doanh nghiệp hoặc nhận thư được |
| FAIL P1 | List6 refresh→list10; RSP9 refresh→RSP6 với stale listId6; FU4/RSP10 refresh→FU3/RSP3 với stale listId9. Người dùng có thể thao tác sai đối tượng sau reload; chưa có bằng chứng đã ghi nhầm dữ liệu |
| FAIL về độ đáp ứng quan sát | Có lần chờ cold start ít nhất90giây. Không phải phép đo latency ổn định hoặc chẩn đoán nguyên nhân đầy đủ; Render Free ngủ/timer dừng vẫn là giới hạn triển khai |
| NOT RUN/PARTIAL | Các nhánh search rỗng/lỗi/thử lại; XLSX/JSON/XML và phân trang nhiều dòng; campaignpause/resume/quota/hẹn giờ tương lai/asset/gửi mới; ResponseEmail/SMS; Follow-upchain/wait/duplicate/optout; OAuthfailures, nhiều phiên/race, chịu tải/phục hồi và toàn bộ196trạng thái Figma. Kiểm tra ảnh desktop gồm cửa sổ chụp rộng1426px ở Campaign và1366px ở Response; chưa phải rà mọi màn ở mọi viewport |

Lần click qua native accessibility không đổi dòng manager không được ghi là lỗi ứng dụng: thao tác bấm trực tiếp dòng thứ hai đã chọn đúng và duyệt thành công.

Lượt gửi Gmail thật trước đó là một phép kiểm tra riêng được cho phép: một campaign3 gửi một thư và nhận reply IMAP tự động, tạo Response3/Follow-up3. Lượt audit Campaign7 chỉ mở rồi đóng xác nhận cuối, không gửi thêm thư. Xem `DEPLOY_VERIFICATION.md` để biết ranh giới bằng chứng và dữ liệu được giữ.

Danh mục và trạng thái chi tiết: `PUBLIC_FLOW_CHECKLIST.md`. Trace P1, caller, phương án sửa tối thiểu và kiểm tra sau sửa: `PUBLIC_ROUTING_FINDING.md`.

Tài liệu không chứa thông tin xác thực, không cam kết phần trăm pixel hoặc dấu đạt cho các nhánh chưa thử. Không sửa code production trong lượt hợp nhất này.

## Kết thúc lượt kiểm tra

- Dữ liệu thử đã dọn theo đúng ID/owner trong transaction:9Response,2campaign chưa gửi,5danh sách,5Contact,search1,filter3 và Follow-up/lịch sử liên quan.29kiểm tra an toàn và11kiểm tra sau commit đạt. Sender thử đã bị xóa bằng thao tác GUI trước đó.
- Bảo toàn campaign3 đã gửi, Response3, Follow-up3 và Gmail sender1. Reload public sau dọn hiển thị đúng RSP-3, loại Quan tâm, trạng thái Mới (ảnh25).
- Kiểm tra cuối: Render `/health` trả `status:ok,database:up`; FE `/api/auth/me` không có cookie trả401. Đây là bằng chứng API public phản hồi và DB sẵn sàng ở thời điểm kiểm tra, không chứng minh chạy liên tục24/7.
- Chỉ tạo ba tài liệu audit; không đổi FE/BE hoặc deploy. Ảnh và manifest/kết quả kiểm tra riêng tư nằm trong `.context-cache/public-audit/`; không đưa cookie/secret vào Git. Các ID fixture trong ảnh đã bị dọn, không dùng để mở lại dữ liệu hiện tại.
