# Kiểm chứng sửa giao diện và luồng public — 16/11/2026

## Phiên bản và môi trường

- FE: https://v5-marketing.vercel.app ; API: https://v5-marketing-api.onrender.com ; PostgreSQL: Neon.
- Đã đẩy `e65f8f4`, `e183933` và `996ae72` lên main. Commit cuối tách thời điểm worker xác định kết quả Follow-up khỏi thời điểm hoàn tất công việc. Render xác nhận **Deploy succeeded**, nguồn `996ae72`. FE public trả bundle `index-DjTRL9Mw.js`; FE và SMTP gateway Vercel triển khai thành công.
- Migration `024_figma_workflow_fields.sql` và `025_followup_result_time.sql` đã áp dụng trên Neon. Không reset database hoặc thay thông tin đăng nhập Gmail.
- API mới `POST /api/contact-searches/check` trả 401 khi không đăng nhập, 201 với Nhân viên hợp lệ; không còn 404. Đây là kiểm chứng BE mới đang phục vụ, ngoài kiểm tra health.

## Các lỗi đã sửa và đối chiếu Figma

| Vấn đề | Cách sửa | Kiểm chứng |
|---|---|---|
| Tạo chiến dịch hiện không tìm thấy bản ghi | Form tạo mới không đi qua guard bắt buộc có campaign ID; alias `campaign-create` đi đúng `campaign-contacts`. Giữ guard cho màn chi tiết để không mở nhầm bản ghi. | Brave public: Chiến dịch → Tạo chiến dịch mới mở form; tiếp tục tạo chiến dịch 13 thành công. DOM có ca không có campaign nào/không có ID. |
| Chữ Tài khoản gửi đậm khi chưa chọn | Font thường được đặt trực tiếp cho nút nav; chỉ active/nhánh mở và mục con active dùng font đậm. | DOM kiểm tra Trang chính, Kiểm tra danh sách và Tài khoản gửi; Brave đi qua cả hai vai trò. |
| Thiếu cập nhật tài khoản từ danh sách | Khôi phục hàng nút Cập nhật tài khoản / Thêm tài khoản gửi mới, dùng dòng đang chọn (mặc định dòng đầu). Bảng Tên/Mã/Email/Hạn mức/Trạng thái, callout và form cập nhật giữ luồng API thật. Không thêm lại nút Quay lại ở danh sách theo quyết định trước của BA. | Figma Bridge đọc lại frame `486:9371` và `229:33515`; Brave mở cập nhật Gmail Marketing và lưu thành công. Public API kiểm tra thêm/sửa/trùng mã/ẩn tài khoản riêng, dọn fixture sau kiểm tra. |
| Lỗi cũ còn hiện sau khi sửa email hợp lệ | Xóa lỗi validation khi mở bản xem trước hợp lệ. | DOM tái hiện preview rỗng → sửa nội dung → preview thành công không còn lỗi cũ. |
| Tiến độ gửi chưa cập nhật khi BE hoàn thành | Danh sách tự tải lại mỗi 5 giây khi còn scheduled/sending; dừng khi rời danh sách hoặc không còn chiến dịch đang hoạt động. Dùng lại xử lý lỗi tải API. | DOM chuyển sending → completed và thấy Hoàn thành mà không tải lại trang. |
| Giờ kết quả Follow-up lấy nhầm giờ hoàn tất | Worker lưu `resolved_at` khi xác định kết quả; lịch sử tách thời điểm nhân viên hoàn tất và thời điểm hệ thống xác định có/không phản hồi. Bản ghi cũ không có mốc thì hiện `—`, không tự dựng giờ. | Unit, HTTP/PostgreSQL tạm và DOM đạt. Trên public, fixture API riêng được worker tự chuyển responded, resolved_at sau completed_at; đã dọn fixture theo ID. Không gửi thêm email cho phép thử thời gian. |

Hai bộ frame tài khoản gửi có cấu trúc khác nhau: bản quản lý cũ có hàng nút cập nhật ở dưới, bản xem danh sách mới có thêm metadata. Lượt này ưu tiên hàng nút và cấu trúc mà BA vừa gửi ảnh, giữ hạn mức đã yêu cầu; thông tin thời điểm vẫn có ở chi tiết. Hai mục con sidebar tiếp tục được giữ theo quyết định BA trước đó.

## Hành trình thật bằng agent-desktop trên Brave

1. Đăng nhập Trưởng phòng: mở danh sách tài khoản → Cập nhật tài khoản → Lưu → màn thành công. Kiểm tra SMTP trả kết nối thành công; giữ nguyên Gmail OAuth và hạn mức.
2. Đăng nhập Nhân viên: mở Chiến dịch → Tạo mới để tái kiểm tra lỗi ban đầu; sau đó vào tìm kiếm, nhập từ khóa `phần mềm`, khu vực Đà Nẵng, nguồn Google Search/Web.
3. Kiểm tra → xác nhận tiêu chí → bắt đầu tìm kiếm thật. SerpAPI/đọc website hoàn tất job **3**, nhận **7 email**, lưu danh sách **19**. Bản ghi tiêu chí của NV001 được đọc lại trong DB. Tiêu chí thật được khôi phục sau bài smoke, không để tiêu chí fixture ghi đè.
4. Trên FE: kiểm tra danh sách 19 → Lưu đạt → Xác nhận. Trưởng phòng mở yêu cầu → Xem danh sách → Duyệt; DB trả employee_review=passed, manager_review=approved.
5. Không gửi thư tới các địa chỉ vừa thu thập. Phần gửi dùng danh sách kiểm tra **18**, có một địa chỉ chủ tài khoản đã cho phép: `vantruongdkrqt@gmail.com`. Danh sách này được tạo/chuẩn bị kiểm tra qua API, duyệt trên Brave; không được trình bày là kết quả Google Search.
6. Nhân viên tạo chiến dịch **13** trên FE: chọn danh sách 18 → lọc → xác nhận người nhận → chọn bố cục → soạn nội dung → xem trước → đóng xem trước → lưu → chọn Gmail và tên hiển thị V5 Marketing → Gửi ngay → tính/lưu lịch → xem lại nội dung → xác nhận gửi.
7. DB xác nhận campaign 13 completed, một campaign delivery sent, một recipient sent, có provider acknowledgement và không có lỗi. Đây là **một email chiến dịch** gửi vào chính hộp thư được cho phép.
8. IMAP tự nhận thư và tạo Response **25**, ghép campaign 13, assignee NV001, nhãn Khác. Vì gửi vào chính hộp thư nên đây là thư kỹ thuật quay về, không phải bằng chứng khách hàng bên ngoài đã trả lời.
9. Trên FE: mở/sửa/lưu Response 25 → tạo Follow-up **14**, ghi mục tiêu → ghi nhận kết quả. DB chuyển done/awaiting, needs_next=false.
10. Trên FE: mở Phản hồi của Response 25 → gửi **một email phản hồi kỹ thuật** tới cùng hộp thư; API lưu response_email_delivery=sent và lịch sử email. Tổng cộng lượt này gửi **hai email kỹ thuật**, không gửi tới bên thứ ba.
11. IMAP tự tạo Response **26** từ thư thứ hai, đúng campaign 13/NV001; bộ phân loại nhận câu “Tôi quan tâm…” thành interested. Worker tự chuyển Follow-up 14 sang done/responded, worker_error=null. Không sửa trực tiếp outcome hoặc thời gian DB để ép kết quả.
12. Brave: mở Xem kết quả của Follow-up 14, tải lại trang, URL vẫn giữ followupId=14 và hiển thị “Có phản hồi · Văn Trường · RSP-25”.

13. Trưởng phòng mở chi tiết tài khoản → Kiểm tra IMAP; API xác nhận 201/connected=true. Sau bản sửa cuối, kiểm tra bổ sung bằng Chrome headless trên public thật ở 1440×1024: đăng nhập bằng form cả hai vai trò, màn Follow-up giữ đúng bản ghi và ba mốc lịch sử, màn tài khoản gửi có Cập nhật tài khoản và font sidebar chỉ đậm ở mục active; không có pageerror. Kiểm tra này không dùng mock API. Ảnh `public-final-employee-1440.png` và `public-final-manager-1440.png` phản ánh bản cuối; ảnh Brave trước đó ghi lại các bước đang thực hiện.

## Kiểm tra tự động và dữ liệu

- FE build/lint đạt, 24 test FE đạt. BE build đạt, 230 test/19 suite đạt.
- PostgreSQL local tách biệt: migration → seed → HTTP smoke đạt; database tạm được dọn.
- DOM fixtures tại 1440×1024: **29 nhóm kiểm tra**, gồm mở 60 route canonical, không có pageerror. Có thêm hồi quy form tạo mới không ID, cập nhật tài khoản từ danh sách, chữ đậm sidebar, xóa lỗi preview, cập nhật trạng thái gửi và thời điểm xác định kết quả. Đây là fixtures, không đánh đồng với mọi trạng thái public.
- Public FE → API → Neon: **78 assertion đạt**, không có failure; hai vai trò, phiên đăng nhập, phân quyền, Contact/duyệt, Template, campaign, preview không commit draft, phiên bản đã preview, Response, Follow-up và CRUD tài khoản gửi. Fixture CRUD được dọn theo ID và email/tên kiểm tra chính xác, không dọn dữ liệu cũ.
- Sau deploy 996ae72, kiểm tra bổ sung worker public bằng hai Response thủ công và một Follow-up riêng: worker tự xác định Có phản hồi và ghi mốc kết quả riêng. Các fixture này không phát sinh email, đã xóa theo ID và định danh kiểm tra. Bằng chứng: `public-result-time.json`.
- Các bản ghi của hành trình email thật (danh sách 18/19, chiến dịch 13, Response 25/26, Follow-up 14) được giữ để người dùng đối chiếu. Không tạo thêm lịch tiếp tự động cho Follow-up 14.

Ảnh Brave và JSON đọc DB/API nằm trong `.context-cache/code-figma-audit/`: `public-create-fixed.png`, `public-search-confirmed.png`, `public-manager-approval.png`, `public-followup-responded.png`, `public-manager-sender-list-fixed.png`, `public-e2e-db.json`, `verify-public-result.json`, `dom-results.json`. Cache có thể chứa dữ liệu vận hành, không đưa toàn bộ cache lên Git.

## Giới hạn

Không tuyên bố đã thao tác riêng mọi trạng thái trong 257 frame hoặc giống từng pixel. Nhánh không phản hồi/hết lượt và các lỗi giả lập được kiểm tra bằng unit/DOM/PostgreSQL tạm; không chờ hết nhiều ngày trên public, không đổi thời gian bản ghi thật để ép trạng thái. Thử nghiệm email ở đây dùng chính hộp thư được phép nên chưa thay thế một lượt trả lời từ khách hàng độc lập.

Render Free vẫn có thể ngủ và ngừng timer, Google OAuth Testing vẫn có giới hạn vòng đời cấp quyền. Kết quả trên chứng minh các luồng đã chạy trong lượt này, không bảo đảm vận hành liên tục 24/7 hoặc chịu tải.
