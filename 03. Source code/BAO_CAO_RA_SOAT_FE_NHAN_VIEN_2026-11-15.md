# Rà soát FE Nhân viên với Figma — 15/11/2026

Trạng thái cập nhật: **BA đã yêu cầu sửa lại FE theo Figma; đã sửa các sai lệch bên dưới, không sửa Figma**. Hai đánh giá A/B ban đầu được thực hiện độc lập; A chốt nhận xét trước khi đọc kết quả detector của B. Phạm vi là bản đăng nhập thật dùng API, hai trang Figma local `Trường` và `Đức + Huy`. Không yêu cầu khớp từng pixel.

## Sau khi sửa

- Khôi phục form Response/Follow-up hai cột, khoảng cách nhóm trường, nút Hủy; giữ footer trong viewport 1440 × 1024 và 1366 × 900.
- Khôi phục năm ô chọn Filter Template, giữ giá trị đang lưu kể cả lựa chọn nhiều giá trị cũ. Lỗi tải dùng màn thông báo riêng với nút tải lại, không hiện nhầm danh sách rỗng.
- Khôi phục popup thông tin chiến dịch theo Figma, gồm tiêu đề email, tài khoản gửi, lịch bắt đầu và thông tin tạm dừng; nhãn người nhận `sent` được hiển thị `Đã gửi`.
- Sidebar trở về 240 px; danh sách Response cuộn riêng trong bảng với header sticky, các nút Thêm/Ẩn luôn ngoài vùng cuộn.
- Response từ chối email mở cảnh báo đúng nguyên nhân, giữ đường quay lại bản ghi. Response hợp lệ vẫn giữ lựa chọn khi lập lịch.
- Ô Lý do/Ghi chú trạng thái được lưu cùng transaction lịch sử bằng migration bổ sung 022; không đổi quy tắc chuyển trạng thái BE.
- FE build/lint đạt. Test riêng hỗ trợ ghi chú BE 5/5 đạt, build/ESLint BE đạt; ghi/đọc PostgreSQL được kiểm tra trong transaction rollback. Sau kiểm tra hồi quy theo chỉ đạo tiếp theo của BA: toàn bộ BE **182/182 test, 13 suite đạt**, HTTP e2e **3/3 đạt**. Test phân loại trước đó bị đổi nhầm dữ liệu đầu vào khi thay chữ UI: đã khôi phục câu ngừng nhận rõ ràng `Vui lòng xóa tôi khỏi danh sách gửi email` và thêm trường hợp mơ hồ `Ẩn` → `other`; không nới quy tắc tự chặn Contact.
- Bộ `test:smoke:local` đạt. Lượt đo bổ sung đạt 149 kiểm tra HTTP, kiểm tra ghi/đọc ghi chú và từ chối ghi chú quá dài không làm thay đổi trạng thái/lịch sử. Script được giới hạn Follow-up theo ID fixture và vô hiệu hóa worker/gửi SMTP thật trước khởi tạo, tránh tác động dữ liệu hoặc gửi thư ngoài dự kiến.
- Gmail thật qua OAuth: SMTP `verify` và IMAP `verify-inbox` đều trả `connected: true`. Không gửi email mới, không chạy tìm kiếm tốn credit trong lượt kiểm tra này. Bằng chứng kết nối ở `.context-cache/backend-regression-2026-11-15/gmail-connection.json`.
- Bằng chứng sau sửa nằm tại `.context-cache/fe-review-2026-11-15/after/` và `A/after-*`. Có kiểm tra thêm sidebar Trưởng phòng để phát hiện ảnh hưởng của độ rộng dùng chung.
- Phần còn lại của báo cáo lưu lại kết quả rà trước sửa. Các câu hỏi cũ được thay bằng chỉ đạo sửa FE giống Figma của BA; không còn chờ duyệt các mục đó.
- Mức tương đồng thị giác BA yêu cầu là bám bố cục/nội dung/trạng thái ở mức tốt, khoảng 90% theo kỳ vọng sử dụng; đây không phải điểm số ảnh đã đo. Chỉ chỉnh các sai lệch xác nhận được, không viết lại màn đã đúng hoặc thay quy tắc BE để chạy theo dữ liệu mẫu Figma.
- Đã chạy thao tác ghi thật từ FE rồi đọc lại API/PostgreSQL: tạo/sửa Template (giữ lựa chọn nhiều giá trị), tạo Response → cập nhật trạng thái kèm ghi chú → lịch sử, lập Follow-up → lưu ghi chú, tạo chiến dịch chưa gửi → popup Xem → sửa tên/mô tả. Danh sách Contact riêng cho bài kiểm tra được tạo/xác nhận/duyệt qua API với hai phiên Nhân viên và Trưởng phòng trước khi tạo chiến dịch trên FE. PATCH chiến dịch trả 200 và dữ liệu đọc lại khớp. Không phát hiện lỗi tích hợp trên các đường đi này.
- Sáu bản ghi thử riêng của hành trình UI đã được dọn theo ID chính xác, kiểm tra lại đều còn 0; không dọn bằng tiền tố chung hoặc xóa dữ liệu cũ. [Báo cáo hành trình UI thật](.context-cache/fe-review-2026-11-15/integration-after/A-integration-report.md).
- Đã dùng `agent-desktop` mở cửa sổ Brave riêng của dự án, điều hướng màn Kiểm tra danh sách Contact của Trưởng phòng và chụp trạng thái thực trên desktop. Không đăng xuất phiên có sẵn của người dùng và không thao tác gửi tin nhắn trên các tab khác.

## Bằng chứng và độ bao phủ

- Đọc mới danh mục và xuất ảnh 75 + 121 = 196 frame từ Figma local; đã xem toàn bộ ở dạng contact sheet, không phải kiểm tra chữ nhỏ toàn bộ ảnh ở độ phân giải gốc.
- Đã xem 50 ảnh route Nhân viên dùng API ở 1440 × 1024. Agent B mở cùng 50 URL ở cả 1440 × 1024 và 1366 × 900, lưu 100 ảnh cùng DOM/URL/nút/đo tràn. Không dùng `preview` để thay cho bản tích hợp.
- 39 cặp frame/màn chính được đánh dấu đã đối chiếu trực quan trong [ledger 196 frame](.context-cache/fe-review-2026-11-15/A/coverage-196.md). **Không có kết luận 196/196 trạng thái FE đạt.** Các biến thể chưa tái hiện có ghi riêng.
- 6 frame UI Draft đầu trang và 3 frame Trưởng phòng được giữ trong danh mục nhưng loại khỏi nghiệm thu Nhân viên. Bảng trạng thái component cũng không được coi là một route riêng.
- Xem ảnh đầy đủ các cặp form Response, Follow-up, Filter Template, thông tin chiến dịch; kiểm tra thêm đường vào Follow-up từ Response hợp lệ và Response từ chối nhận email.
- Kiểm tra hộp thoại Ẩn Response: mở, Escape đóng và focus trở về nút mở. Mô phỏng lỗi GET 503 tại trình duyệt cho Response/Follow-up/Template, không gây lỗi máy chủ thật. Thử lại Response/Follow-up đã khôi phục dữ liệu API.
- Không ghi nhận pageerror hoặc cuộn ngang toàn trang trong 100 lần mở route. Điều này không chứng minh toàn bộ hành động nghiệp vụ đã chạy đúng.
- Không gửi email, chạy tìm kiếm SerpAPI, lưu/xóa/ẩn/duyệt hay lên lịch chiến dịch. POST preview tự chạy khi vào màn đã bị hàng rào kiểm tra chặn; lỗi do chặn này không được tính thành lỗi sản phẩm.

## Các điểm chờ duyệt

| Mã | Mức | Màn / frame Figma | Sai lệch đã xác nhận | Đề xuất để BA duyệt |
|---|---|---|---|---|
| 1 | P1 | Cập nhật trạng thái Response — `43:6297` | Thiếu ô **Lý do / Ghi chú**. Trạng thái mới đang bị khóa ở bước tiếp theo, trong khi thiết kế có lựa chọn. | Khôi phục ô ghi chú và lưu lịch sử. Riêng lựa chọn trạng thái cần đối chiếu quy tắc chuyển trạng thái trước khi đổi. |
| 2 | P1 | Response → Tạo Follow-up khi đã từ chối email — `99:32137` | RSP-357 chuyển sang form chọn Response trống thay vì giải thích không thể tạo Follow-up qua Email. RSP-356 hợp lệ vẫn giữ lựa chọn; không phải mọi Response đều mất ngữ cảnh. | Hiện đúng nguyên nhân, giữ ngữ cảnh bản ghi và đường quay lại; không tự mở thêm kênh chưa được duyệt. |
| 3 | P1 | Filter Template lỗi tải — `54:8583` | Khi GET lỗi, FE vừa báo lỗi vừa ghi **Chưa có Filter Template**, không có **Tải lại Template**. | Phân biệt lỗi tải với danh sách rỗng, thêm hành động tải lại theo thiết kế. |
| 4 | P2 | Tạo/Cập nhật Filter Template — `16:271`, `16:322` | Năm trường phân loại đang là input tự do, Figma có ô chọn: chức vụ, ngành, khu vực, quy mô, trạng thái email. | Khôi phục danh sách chọn theo các lựa chọn hiện có; từ khóa vẫn nhập tự do và bảo toàn dữ liệu đang lưu. |
| 5 | P2 | Thêm Response — `43:6301` | Figma nhóm trường hai cột; FE xếp một cột và textarea lớn, làm form dài. | Căn lại hai cột trên desktop, giữ cỡ chữ dễ đọc và vị trí nút đã được BA chốt. |
| 6 | P2 | Tạo Follow-up — `43:6299` | Form dài khoảng 1170 px ở viewport cao 1024; thiếu nút Hủy, nhóm trường khác bố cục hai cột. | Gom nhóm hai cột, cân chiều cao và bổ sung Hủy. Không sao chép các giá trị mẫu Figma để thay quy tắc nghiệp vụ đang dùng. |
| 7 | P2 | Chiến dịch → Xem — `327:241792`, `327:242358` | FE mở trang chi tiết có bảng người nhận; Figma mở hộp thoại tổng quan có tiêu đề email, tài khoản gửi, thời điểm bắt đầu. FE tổng quan thiếu tiêu đề email/tài khoản gửi. | BA chọn khôi phục hộp thoại hay giữ trang chi tiết và bổ sung thông tin. Không tự xóa trang chi tiết hiện có. |
| 8 | P2 | Danh sách Response — `43:6174` | Dữ liệu thật 19 hàng làm trang cao khoảng 1568 px, thanh Thêm/Ẩn ở y≈1452, phải cuộn để thao tác. | BA chọn phân trang hoặc cuộn riêng phần bảng để thao tác còn trong khung desktop; không ẩn bớt dữ liệu. |
| 9 | P3 | Chi tiết chiến dịch | Trạng thái người nhận hiện mã tiếng Anh `sent`. | Hiển thị nhãn tiếng Việt tương ứng, giữ nguyên giá trị API. |

Ảnh đối chiếu: [ghi chú Response](.context-cache/fe-review-2026-11-15/A/comparison-A1.png), [Template](.context-cache/fe-review-2026-11-15/A/comparison-A2.png), [Thêm Response](.context-cache/fe-review-2026-11-15/A/comparison-A3.png), [Follow-up](.context-cache/fe-review-2026-11-15/A/comparison-A4.png), [Xem chiến dịch](.context-cache/fe-review-2026-11-15/A/comparison-A5.png), [từ chối Email](.context-cache/fe-review-2026-11-15/A/comparison-A6.png). [Ảnh lỗi tải Template](.context-cache/fe-review-2026-11-15/B/error-templates.png).

## Khác biệt thị giác cần quyết định, không tự coi là lỗi

- Sidebar FE rộng 280 px, Figma 240 px. Nội dung vì vậy bắt đầu ở x312 thay vì x272 tại viewport 1440. Do BA từng yêu cầu desktop không nhỏ và thống nhất kích thước, đây là lựa chọn cần xác nhận, không tự hoàn tác về 240.
- Card danh sách Response bắt đầu cao hơn Figma khoảng 20 px, radius 8 thay vì 12. Đây là tinh chỉnh nhỏ, không phải lỗi chức năng hoặc lý do viết lại toàn bộ shell.
- Giữ các thay đổi đã chốt: breadcrumb một cấp ở màn chính Response/Follow-up, mô tả dưới tiêu đề, thông báo toast, thứ tự nút đã duyệt, responsive và font dễ đọc. Dữ liệu thật khác tên/số lượng/ngày mẫu không phải lỗi.

## Đánh giá tổng thể

Giao diện vẫn nhận diện rõ V5 Marketing, thống nhất DarkBlue/Arial và có điều hướng nghiệp vụ. Các bước chiến dịch và phần tóm tắt hỗ trợ người dùng kiểm tra trước khi gửi. Những điểm yếu tập trung ở form bị kéo dài, mất affordance chọn giá trị và một số trạng thái lỗi/chặn chưa diễn đạt đúng nguyên nhân.

Đánh giá heuristic của A là 23/40, chỉ áp dụng cho phạm vi đã xem, không phải chứng nhận toàn bộ sản phẩm. Điểm đáng chú ý: kiểm soát/quay lại 2/4, nhất quán 2/4, nhận biết thay vì ghi nhớ 2/4; trạng thái hệ thống và ngôn ngữ nghiệp vụ 3/4. Người mới dễ hiểu nhầm form Follow-up trống là mất dữ liệu; nhân viên xử lý nhiều Response phải cuộn xa để tới thao tác.

Detector chỉ chạy một lần, có một cảnh báo `overused-font` tại Arial. Đây là false positive với brief vì Figma dùng Arial; **không đề xuất đổi font**.

## Nhật ký kiểm tra

- Target `frontend/src/LiveFlows.tsx`, slug `frontend-src-liveflows-tsx`; không có ignore list được áp dụng.
- Native Chrome MCP bị khóa profile; dùng Chrome Playwright context riêng, không đóng trình duyệt của người dùng. Kiểm tra chạy headless, ảnh lưu trong thư mục bằng chứng; không tuyên bố có overlay đang hiển thị cho người dùng.
- Overlay detector được thử trên bốn route; server cổng 8400 đã dừng với `--keep-inject`, browser kiểm tra đã đóng. Script/ảnh bằng chứng được giữ có chủ đích, không chèn mã vào source.
- So SHA-256 các file trực tiếp trong `frontend/src` trước/sau: 14/14 không thay đổi trong lượt rà. Không sửa Figma; chỉ điều hướng trang để đọc.
- BE phục vụ rà giao diện có tạm vô hiệu hóa worker gửi thư/nhắc việc/đồng bộ hộp thư **trong bộ nhớ của tiến trình kiểm tra**, không thay đổi mã nguồn. Không dùng phiên này để kết luận các worker đã được kiểm thử.
- [Đánh giá A](.context-cache/fe-review-2026-11-15/A/assessment.md), [đánh giá B](.context-cache/fe-review-2026-11-15/B/assessment-B.md), [ledger trình duyệt](.context-cache/fe-review-2026-11-15/B/browser-ledger.json).

## Chờ quyết định

1. BA duyệt các mã 1–9 nào để sửa? Có thể duyệt toàn bộ, chỉ 1–3 trước, hoặc liệt kê mã cụ thể.
2. Với mã 7: dùng hộp thoại tổng quan như Figma hay giữ trang chi tiết và bổ sung thông tin? Với mã 8: phân trang hay cuộn riêng bảng? Sidebar giữ 280 hay trở về 240?

Chưa xác nhận toàn bộ biến thể lỗi/thành công/loading/validation bằng thao tác live. Không thực hiện sửa chữa nào trước khi BA duyệt.
