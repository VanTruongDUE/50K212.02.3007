# Kiểm tra tích hợp và sidebar hai vai trò — 15/11/2026

## Bổ sung màn Follow-up hết lượt

FE dùng API và bản preview đã có màn thông báo theo frame Figma `99:32140`. Chỉ hiện khi `status=done`, `outcome=no_response` và `attempt>=max_attempts` với số lượt hợp lệ. Trường hợp có phản hồi, còn lượt hoặc vẫn đang chờ giữ màn chi tiết. Thời điểm hết hạn lấy từ `completed_at + wait_days`, không lấy lịch hẹn làm hạn phản hồi. Hai nút Bổ sung ghi chú/Về danh sách giữ đúng mã Follow-up; lưu ghi chú và tải lại quay về đúng nhánh kết quả.

Build/lint và14 test FE đạt. Chrome với API fixture kiểm tra12 trạng thái ở1440×1024 và1366×1024, chọn từ danh sách, lưu ghi chú, tải lại và điều hướng đều đạt; không lỗi JavaScript hoặc cuộn ngang. Đã so ảnh với Figma. Ảnh/log riêng: `.context-cache/followup-exhausted/`. Lượt bổ sung này không đổi BE, không ghi database thật, chưa deploy public.

## Chạy lại riêng BE sau yêu cầu kiểm tra mới

Đã chạy lại, không dùng số kiểm thử cũ thay cho kết quả mới: build đạt;18 suite/224 unit test,3 e2e dùng DB mock,2 entrypoint test đạt. PostgreSQL tạm mới áp dụng23 migration; smoke nghiệp vụ146 kiểm tra HTTP và smoke Search giả lập đạt;9 kiểm tra provenance/ownership bằng PostgreSQL thật đạt. Database tạm đã được xóa và xác nhận không còn tồn tại, không thay đổi dữ liệu nghiệp vụ public.

Bằng chứng mới ở `.context-cache/be-recheck/`: log workflow/search, `isolated-results.json`, `linked-contract-results.json`, `cleanup.json`; kiểm tra public HTTP và Neon được ghi độc lập tại cùng thư mục. Các giới hạn SMTP/IMAP/Google OAuth/SerpAPI thật ở cuối báo cáo vẫn áp dụng. Lượt chạy lại BE này không thay đổi mã nguồn hoặc deploy.

## Kết quả và sửa đổi

Đã kiểm tra bản mã cục bộ dùng FE React → NestJS thật → PostgreSQL riêng; kiểm tra HTTP bản public và đọc database Neon. Không dùng kết quả fixture API của lượt trước để thay cho kiểm tra tích hợp lần này.

Hai lỗi/sai lệch đã xác nhận và sửa:

1. **Tạo chiến dịch mới bị chặn bởi kiểm tra mã bản ghi.** Từ danh sách bấm Tạo chiến dịch mới đi tới `campaign-contacts` nhưng màn này chưa được khai báo là form tạo mới, nên xuất hiện “Không tìm thấy bản ghi”. Đã bổ sung entry route, không kế thừa mã chiến dịch cũ; màn chi tiết/editor vẫn bắt buộc có mã. Có unit test hồi quy và đã chạy lại wizard bằng nút bấm UI.
2. **Sidebar Trưởng phòng lệch Figma.** Đã chỉnh khoảng cách nhóm chính, vị trí icon/logo, chiều rộng vùng chọn và nhãn menu; nhãn “Kiểm tra danh sách” theo Figma, tooltip giữ tên đầy đủ “Kiểm tra danh sách”. Giữ hai mục con tài khoản theo xác nhận của BA trong lượt này. Nhãn con không còn xuống dòng ở hai độ rộng kiểm tra. Cả hai role dùng chữ đậm cho mục đang chọn; Tìm kiếm Contact đóng lại dùng chữ thường như Figma. Header dùng chữ đậm và màu chữ theo thiết kế.

Các sửa đổi cục bộ của lượt trước được bảo toàn. **Chưa commit, push hoặc deploy; web public chưa nhận các sửa đổi giao diện/điều hướng này.** Không sửa Figma.

## Sidebar và kiểm tra trên desktop

- Figma UI MCP đang kết nối khi đọc: file Màn hình giao diện_Nhóm2. Đọc các frame `16:436`, `43:6300`, `486:9432`, `486:8984` và cây sidebar tương ứng.
- Khung sidebar 240px, header 64px. Mục chính 44px; chữ 16px/24px. Trưởng phòng có khoảng cách 12px giữa mục chính, vị trí đầu các hàng khoảng y116/172/228 tại desktop; icon x26, nhãn x58. Sai khác khoảng 1–2px so với Figma không phải mục tiêu chấm pixel của lượt này.
- Giữ Arial đã thống nhất trước, hai submenu tài khoản, điều hướng logo về trang chính, thu gọn nhóm khi đổi chức năng, hover xanh, focus bàn phím và reduced-motion hiện có. Không bỏ chức năng để làm sidebar trông giống ảnh.
- Agent-desktop: đã thao tác Brave đăng nhập Trưởng phòng trên môi trường riêng, mở Tài khoản gửi → Kiểm tra tài khoản gửi → Danh sách tài khoản gửi; đọc lại URL/cây accessibility và chụp ảnh xác minh. Đã kiểm tra điều hướng Response trên public bằng agent-desktop và khôi phục tab public sau khi kết thúc kiểm thử.
- Chrome tự động: **36 route × 1440×1024 / 1366×900 = 72 lượt** nối API/database thật, không lỗi JavaScript, không cuộn ngang. Assert sidebar/header, chiều cao nhãn, vị trí các hàng và chiều cao hai submenu đều đạt.
- Đã bấm mọi đích sidebar của hai role; logo, hover, focus và mở/đóng submenu đều đạt. Các trạng thái lựa chọn/thu gọn được kiểm tra bằng thao tác, không chỉ đọc mã.

## Luồng UI → API → database đã chạy

Database kiểm thử riêng trên PostgreSQL local, tạo riêng cho lượt kiểm tra. Khóa Google/Search/relay bỏ trống; lịch chạy nền định kỳ tắt. Địa chỉ fixture đều thuộc `example.invalid`; không gửi email tới người thật.

| Nhóm | Bằng chứng chạy thật |
|---|---|
| Tài khoản và role | Đăng nhập UI hai role → `/auth/me` đúng role; xem hồ sơ; đăng xuất → phiên bị thu hồi, `/auth/me` trả401. |
| Contact | Nhân viên lưu đạt → xác nhận → Trưởng phòng duyệt; đọc lại API xác nhận dữ liệu đã lưu. Xuất CSV có email Contact từ PostgreSQL. |
| Chiến dịch | Bấm tạo mới → nhập tên/mô tả → chọn danh sách đã duyệt → lọc → xác nhận người nhận → chọn bố cục trống → soạn → xem trước cá nhân hóa → lưu → chọn tài khoản → tính/lưu lịch hẹn → xem email → xác nhận. Đọc lại trạng thái scheduled và đúng tài khoản; số email gửi bằng0. Tạm dừng với lý do trống được lưu đúng. |
| Nội dung chiến dịch | Sửa tiêu đề/body, API preview, tải lại vẫn giữ đúng mã và nội dung đã lưu. |
| Response | Sửa nội dung, chuyển trạng thái và đọc lại API; chọn mẫu phản hồi/Hủy; ẩn Response đủ điều kiện không còn trong danh sách. |
| Follow-up | Tạo lịch đúng Response, lưu ghi chú, xác nhận ẩn; GET chi tiết vẫn cho thấy cancelled, giữ lịch sử. Danh sách hiện hành loại lịch đã hủy đúng quy tắc. |
| Tài khoản gửi | Sửa thông tin và đọc lại đúng giá trị. Không đổi tài khoản Gmail public hoặc ngắt OAuth. |

Nhánh Gửi ngay cũng đã thử trong môi trường riêng với SMTP giả trỏ `127.0.0.1:2525`: xác nhận được, kết nối không có máy chủ nên chiến dịch tự tạm dừng. Đây là kiểm tra nhánh lỗi, **không phải gửi Gmail thành công**. `VERCEL=1` tắt timer nhưng thao tác xác nhận Gửi ngay vẫn gọi worker trực tiếp; vì vậy không dùng nhánh này để giả định không có xử lý gửi. Wizard thành công dùng lịch tương lai và được tạm dừng trước khi dọn môi trường.

## BE, database và bản public

| Kiểm tra | Kết quả |
|---|---|
| Unit BE |18 suite,224 test đạt. |
| E2E và Vercel entrypoint |3 e2e dùng DB mock;2 entrypoint test đạt. Không coi đây là kiểm tra database thật. |
| PostgreSQL riêng |23 migration, smoke workflow với146 kiểm tra HTTP và các assert nghiệp vụ/lưu dữ liệu đạt. Search smoke dùng provider/website giả lập đạt. SMTP/IMAP trong smoke được stub. |
| Provenance trên PostgreSQL |9 kiểm tra đạt: lấy đúng search job/list/owner, không dùng job mới hơn của owner khác; giữ thống kê10/2/3/5 khi chỉ còn1 Contact đã lưu; đúng thời điểm duyệt; rollback fixture. |
| Neon public |18 kiểm tra trong transaction READ ONLY;15 SELECT chạy qua controller build mới;23/23 migration; không phát hiện vi phạm integrity trong các truy vấn đã kiểm tra. Không ghi dữ liệu Neon. |
| HTTP public |70 request,115 kiểm tra đạt,0 lỗi;4 trường hợp thiếu dữ liệu được ghi skip. FE200; Render `/health`200/database up; login/me/logout hai role, cookie, API danh sách/chi tiết, anonymous401 và sai role403 đạt. |
| FE |Build/lint đạt;10 unit test điều hướng/validation đạt; `git diff --check` đạt. |

Bản public đang có hợp đồng API cũ: chưa trả các alias thống kê tìm kiếm mới trên Contact list và thông tin duyệt trong linked lists của chiến dịch. Các trường mới ở local cần được deploy cùng FE trước khi xem là đã đồng bộ public.

## Bằng chứng và giới hạn

Bằng chứng riêng trong `.context-cache/role-audit/`: `browser-real-results.json`, `browser-real-captures.json`, `wizard-nav-results.json`, ảnh `1440-*.png` / `1366-*.png`, ảnh `native-*.png`, `backend-check.md`, `public-http.md`, `public-http.json`, `neon-results.json`, `linked-contract-results.json`, các log smoke và `cleanup.json`.

Chưa xác nhận mọi trạng thái của toàn bộ257 frame, mọi tổ hợp dữ liệu hoặc tải đồng thời. Không gửi SMTP/Gmail thật, đồng bộ IMAP thật, cấp lại OAuth hoặc tiêu credit SerpAPI trong lượt này. Database kiểm thử riêng và tiến trình kiểm thử được dọn sau khi hoàn tất; dữ liệu nghiệp vụ production được giữ nguyên. Không coi các kết quả này là cam kết vận hành24/7 trên Render Free.
