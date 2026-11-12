# Đối chiếu FE với Figma — trang Đức + Huy

## Cập nhật sau khi nối API (12/11/2026)

- Figma UI MCP Bridge đã kết nối lại và đã đọc trực tiếp các frame đại diện ở cả ba trang `Trường`, `Đức + Huy`, `Nhi + Thảo`. Bản FE chạy cùng PostgreSQL và BE thật ở viewport 1440 px; đã chụp 14 màn chính (9 Nhân viên, 5 Trưởng phòng), so trực quan các màn tiêu chí, Filter Template, xuất Contact, Chiến dịch, Response, Follow-up và tài khoản gửi. Không dùng tiêu chí khớp từng pixel.
- Đã sửa các hồi quy xác nhận: Filter Template tách danh sách và form tạo/sửa, áp dụng Template giữ tiêu chí đã chọn; xuất Contact dùng bốn lựa chọn ngang và bắt buộc chọn định dạng; tiêu đề danh sách Response/Follow-up giữ đúng Figma với breadcrumb một cấp theo BA; form Gmail/SMTP hai cột; kết quả lọc người nhận nằm cùng bố cục bước chọn Contact. Đường dẫn cha `Tìm kiếm Contact` trở về Thiết lập tiêu chí. Danh sách Response và Follow-up có trạng thái rỗng/lỗi tải cùng nút thử lại.
- Kiểm tra tương tác trên Chromium: đăng nhập cả hai role, chọn Template thứ hai rồi sửa, áp dụng Template, tạo Template qua API rồi dọn bản ghi kiểm thử, xuất CSV và tải tệp, tạo chiến dịch → lọc → chọn lại và dọn bản nháp kiểm thử, mô phỏng lỗi tải Response/Follow-up rồi thử lại; không có lỗi JavaScript hoặc cuộn ngang ở các bước này. FE build/lint đạt; BE smoke với PostgreSQL thật đạt, 6 unit test và 3 HTTP e2e test đạt.
- Kiểm tra cài đặt BE trên cơ sở dữ liệu mới đã tìm ra ký tự thừa `ko` trước `ALTER` trong migration `012_followup_details.sql`. Đã sửa và chạy lại `test:migrations:local`: toàn bộ migration áp dụng được trên PostgreSQL trống; cơ sở dữ liệu kiểm thử tạm được dọn sau khi kiểm tra.
- **Chưa thể kết luận toàn bộ FE sau nối BE đã khớp Figma.** Audit trực tiếp 109 URL đại diện cho 196 frame cũ không có lỗi JavaScript/cuộn ngang. URL trạng thái demo cũ hiện được đưa về màn nghiệp vụ đang dùng API thay vì màn `Chức năng`; chúng **không tái tạo thông báo lỗi/rỗng Figma chỉ bằng URL**. Trạng thái lỗi thật hiển thị từ phản hồi API trên màn nghiệp vụ. 25 URL cao hơn viewport 1024 px (bao gồm các biến thể cùng màn và các frame Figma vốn cao hơn 1024); phải đối chiếu với chiều cao frame riêng trước khi coi là lỗi. Lượt này chưa so ảnh từng trạng thái của toàn bộ 196 frame và các frame Trưởng phòng; không dùng số 196/196 của bản FE demo làm kết luận cho bản đã nối API.

- Giao diện thực tế khi đăng nhập dùng `LiveFlows.tsx`; các bảng 121 frame bên dưới là kết quả rà bản FE demo trước khi nối API, không phải trạng thái kiểm chứng mới của bản chạy thật.
- Đã đưa lại bố cục nhiều bước của Chiến dịch, danh sách/chi tiết/lịch sử Response, danh sách/kết quả/ghi chú Follow-up và các màn kiểm tra của Trưởng phòng, đồng thời giữ dữ liệu API. Màn Soạn phản hồi đã trở lại lưới hai cột; SMS chỉ ghi nhận thao tác gửi ngoài hệ thống theo quyết định BA. Tạo lịch Follow-up đi đến màn thành công riêng sau khi API lưu.
- Playwright ở 1440 × 1024 mở 43 route Nhân viên và 15 route Trưởng phòng: không gặp màn dự phòng hoặc lỗi JavaScript; đã thao tác trực tiếp các nhánh Response, Follow-up, duyệt danh sách và tài khoản gửi. Backend smoke với PostgreSQL thật đạt. Đây là kiểm tra luồng chính, chưa xác nhận 196/196 ảnh Figma của bản API.
- Ở lượt kiểm tra đầu ngày 12/11, Figma UI MCP Bridge chưa kết nối; phần trên ghi kết quả sau khi đã kết nối lại. Các màn có nhiều nội dung như Trình soạn thảo email vẫn có thể cuộn dọc ở viewport 1024 px; phải dùng chiều cao frame tương ứng để đánh giá. Bản API chưa được xác nhận khớp toàn bộ 121 frame.

Ngày rà soát: 10/11/2026. Phạm vi: chỉ trang `Đức + Huy`; không tính trang Trưởng phòng. Figma được đọc qua MCP, không chỉnh sửa.

## Cập nhật FE sau rà soát

- Theo yêu cầu BA, breadcrumb của hai màn danh sách mở từ mục chính chỉ hiện một cấp: `Response` và `Follow-up`. Tiêu đề bên dưới vẫn là `Quản lý Response` và `Quản lý lịch Follow-up`; màn chi tiết giữ breadcrumb hai cấp để quay về danh sách. Đây là ngoại lệ chủ động so với chữ trong frame Figma của hai màn danh sách.

- Cập nhật 11/11 sau lượt chạy toàn bộ luồng nhân viên: 196/196 trạng thái/route trong hai trang Trường và Đức + Huy mở được ở viewport bằng đúng kích thước frame Figma, không có lỗi JavaScript hoặc cuộn ngang/dọc toàn trang. Với #49 và #115, trạng thái được mở bằng thao tác ở dòng Chiến dịch tương ứng; #89–90 được kiểm tra sau khi chọn tài khoản. Chi tiết ảnh của 31 frame từng tràn chiều cao nằm ở `DOI_CHIEU_ANH_196_FRAME_2026-11-11.md`.
- BA chốt **“Xóa Response” là nhãn giao diện, dữ liệu chỉ ẩn khỏi danh sách làm việc**. Đã đổi nhãn nút/hộp thoại/xác nhận theo Figma và chạy thử cả trường hợp xóa thành công, bị chặn. Không xóa bản ghi khỏi dữ liệu FE cục bộ.

- Đợt chỉnh ngày 10/11: so lại frame Danh sách chiến dịch (`327:241209`, 1440 × 1267), Chọn danh sách contact (`327:251508`, 1440 × 1024) và Thiết lập lịch gửi (`327:257674`, 1440 × 1030). Bảng chiến dịch gốc đã giảm header về 48 px, điều chỉnh chiều cao 9 hàng và khung nút thao tác theo frame; màn chọn Contact không còn nút Hủy ngoài thiết kế và thanh hành động nằm ngay dưới thẻ. Ở màn lịch gửi, panel nằm y≈477 và thanh hành động y≈906, gần tọa độ Figma y=476 và y=906; ngày/giờ ban đầu để trống, phải nhập đủ trước khi tính lịch. Đã xác nhận qua DOM tại 1440 × 1030 và 1280 × 900 là không cuộn ngang; nút tính lịch báo lỗi khi thiếu ngày/giờ, hộp thông tin chiến dịch mở được từ danh sách. Ảnh chụp trình duyệt của màn lịch gửi chưa lấy được trong lượt này nên đối chiếu hình ảnh bên trong panel vẫn cần làm tiếp.
- Kiểm tra FE bổ sung ngày 10/11: 62 route/trạng thái của Chiến dịch, Response và Follow-up đều mở được, không rơi vào trang “Không tìm thấy màn hình” hoặc cuộn ngang ở 1440 × 1024; 21 màn chính cũng không cuộn ngang ở 1280 × 900. Đã thao tác luồng chiến dịch đã duyệt → chọn mẫu → xem trước → lưu nội dung → chọn tài khoản → tính/lưu lịch → xác nhận; tên chiến dịch và nội dung mẫu được giữ đúng qua các bước. Đã sửa lỗi thông báo của Chiến dịch còn xuất hiện khi chuyển sang Response.
- **Đánh giá hiện tại: chưa thể coi FE đã ổn hoàn toàn.** Đã có route demo cho các frame từng thiếu và các luồng chính có thể thao tác, nhưng bảng 90 frame “Có một phần” vẫn cần đối chiếu từng trạng thái ở 1440 × 1024 và sửa các sai khác. Số 90/31 bên dưới là mốc trước đợt sửa, không phải số lỗi còn lại hôm nay.
- Cập nhật 11/11: khối Hình ảnh trong trình soạn thảo đã kéo vào vùng nhập và hiện khung giữ chỗ khi xem trước. Mẫu Thư mời sự kiện nạp nội dung theo frame; BA chốt hai mẫu chưa có nội dung chi tiết trong Figma mở trình soạn thảo trống để người dùng nhập. Lịch sử mẫu `Đã phản hồi` mở bằng URL trạng thái Figma riêng; đi từ bản ghi RSP-031 `Mới` trong danh sách không tự gán các lần gửi cũ.
- So lại ảnh 1440 × 1024: Quản lý Response đặt header bảng khoảng y=329 và cuối bảng khoảng y=818, sát frame Figma tương ứng y≈328 và y≈815. Trình soạn thảo có thanh hành động y≈1311 trên trang cao 1427 px, gần frame y≈1306 trên frame cao 1430 px. Thiết lập lịch gửi có panel y≈477–890 và thanh hành động y≈906, khớp vùng bố cục frame. Bộ chọn ngày/giờ gốc của trình duyệt vẫn hiển thị định dạng theo locale của máy.
- Kết quả Follow-up mở trực tiếp nay hiển thị Việt Tín/RSP-033 `Có phản hồi`; đã sửa dòng tiêu đề, bỏ badge, đổi thứ tự nút. Ở 1440 × 1024, panel tóm tắt y=264–540, lịch sử y=572–908 và nút y=940–984, sát frame Figma.
- Soạn phản hồi giữ lưới hai cột và dữ liệu mẫu; khoảng cách trường được thu lại để panel y=264–561 ở 1440 × 1024, sát frame y≈265–560.
- Chi tiết Response RSP-031 `Mới` hiển thị “Chưa có phản hồi gửi đi” và lịch Follow-up `Chờ thực hiện` như frame. Bốn nút hành động được trải đều trên desktop; URL `response-history` mở riêng hai dòng Email/SMS mẫu theo quyết định của BA.
- Các điểm cần kiểm chứng tiếp: trạng thái lỗi mạng/lưu dữ liệu chỉ mô phỏng; chưa so ảnh đủ 121 frame và chưa chạy kiểm tra truy cập bằng bàn phím cho toàn bộ luồng. Do đó chưa thể bàn giao FE như bản khớp 100% Figma.
- Đã sửa riêng màn Trình soạn thảo và Xem trước email theo frame: hiển thị CTA trong nội dung mẫu, tách email khỏi nền preview, đánh dấu đã xem khi đóng preview; đã sửa khung và thứ tự nút của màn tạo Follow-up thành công. Đã thêm dữ liệu mẫu/thông báo cho 7 frame nhập liệu lỗi của Response và Follow-up (`response-add--invalid`, `response-edit--invalid`, `response-reply--invalid`, `response-status--invalid`, `followup-create--missing-goal`, `followup-create--time-error`, `followup-create--parameter-error`).
- Đã chạy luồng Follow-up từ danh sách → chọn Response Việt Tín → nhập mục tiêu → tạo lịch thành công. Nút “Xem hồ sơ / Lập lịch” nay mở danh sách Response để chọn bản ghi thay vì luôn chọn An Phú đã có lịch chờ; “Tạo lịch khác” cũng quay về nơi chọn Response.
- Đã đối chiếu lại riêng màn Quản lý Response ở 1440 × 1024: tăng chiều cao header/hàng, xuống dòng ngày giờ và hiển thị trạng thái bằng chữ như frame. Khung bảng hiện kết thúc đúng vùng khoảng 816 px của frame; đây là đối chiếu trực quan, chưa phải kiểm định pixel tự động.
- Đã chỉnh tương tự màn Quản lý lịch Follow-up ở 1440 × 1024: chiều cao bảng, trạng thái chữ thường và thanh thao tác cuối; bỏ nút trái không có trong frame. Hai màn danh sách vẫn dùng dữ liệu FE cục bộ.
- Đã chỉnh danh sách chiến dịch gốc ở 1440 px: bảng 9 hàng có chiều cao và cách xuống dòng thao tác gần frame 1267 px; nút Xóa có viền cảnh báo. Kiểm tra lại ở 1280, 1366 và 1440 px: bảng không gây cuộn ngang toàn trang. Phần nội dung/hành vi từng hộp thoại chiến dịch vẫn cần so riêng.
- Kiểm tra trình duyệt mới: 7 route lỗi nhập liệu, preview và màn thành công ở 1280 × 800 đều có nội dung và không gây cuộn ngang toàn trang; đã so ảnh màn thành công/lỗi Follow-up, Trình soạn thảo và Xem trước email với Figma ở 1440 × 1024. `npm run build` và `npm run lint` đều qua sau sửa. Các route lỗi máy chủ vẫn chỉ là mô phỏng do chưa có BE.
- Đã bổ sung bản FE demo cho **31 frame từng được ghi là “Chưa có”** ở bảng kiểm bên dưới. Các route dùng cú pháp `?screen=<tên-route>` để BA mở trực tiếp trạng thái lỗi/rỗng khi chưa có BE. Những lỗi phụ thuộc mạng hoặc máy chủ là trạng thái mô phỏng, không phải kết quả gọi API thật.
- Đã thêm màn xác nhận tạo Follow-up, bố cục email trống, form tên người gửi, thông tin tạm dừng/tiếp tục và các chi tiết trong thẻ xác nhận chiến dịch. Xóa Follow-up nay giữ bản ghi với trạng thái `Đã xóa`; phản hồi hỗ trợ Email/SMS; email được gắn với từng chiến dịch và chặn biến không được hỗ trợ.
- Đã chạy `npm run build`, `npm run lint`; mở 31 route trạng thái ở 1366 × 900, 19 màn đại diện ở 1280 × 800 và so ảnh trực quan các màn chính ở 1440 × 1024. Các màn đã kiểm tra không tạo cuộn ngang toàn trang ở hai độ rộng desktop này.
- **Bảng 121 frame bên dưới là ảnh chụp kết quả rà soát trước đợt chỉnh sửa này**. Nhãn “Chưa có” trong bảng được giữ để truy nguyên khoảng trống ban đầu; xem bảng route mới ngay dưới đây để biết phần đã bổ sung. Chưa xác nhận toàn bộ 121 frame khớp pixel/trạng thái bằng trình duyệt.

| Frame trước đây còn thiếu | Route FE demo |
| --- | --- |
| #18 Chuỗi Follow-up: tạo lịch tiếp theo thất bại | `followup-chain--create-failed` |
| #29 Gửi phản hồi thất bại | `response-reply--send-error` |
| #31–32 Không tìm thấy hoặc lỗi tải hồ sơ | `followup-list--missing-record`, `followup-list--load-error` |
| #36–37 Lưu trạng thái/ghi chú thất bại | `followup-result--save-error`, `followup-note--save-error` |
| #39, #42, #44, #47–48, #53 Chiến dịch rỗng hoặc thao tác thất bại/bị chặn | `campaign-list--empty`, `campaign-list--detail-error`, `campaign-list--pause-error`, `campaign-list--delete-error`, `campaign-list--cannot-delete`, `campaign-list--edit-forbidden` |
| #60–61 Tiếp tục gửi bị chặn hoặc thất bại | `campaign-resume--quota-error`, `campaign-resume--send-error` |
| #67, #69–70 Danh sách Contact rỗng, lọc hết, lưu thất bại | `campaign-contacts--no-lists`, `campaign-filtered--zero`, `campaign-filtered--save-error` |
| #76 Bố cục email trống | `campaign-layouts` |
| #81–82 Biến email sai, lưu nội dung thất bại | `campaign-editor--variable-error`, `campaign-editor--save-error` |
| #86–87 Xem trước email lỗi biến/thao tác | `campaign-preview--variable-error`, `campaign-preview--render-error` |
| #91–93 Hết tài khoản, tên người gửi sai, lưu thất bại | `campaign-sender--no-accounts`, `campaign-sender--invalid-name`, `campaign-sender--save-error` |
| #99 Lưu lịch gửi thất bại | `campaign-schedule--save-error` |
| #106–109, #111 Xác nhận lỗi lưu/dữ liệu/lịch/tóm tắt và sửa thông tin chung | `campaign-confirm--save-error`, `campaign-confirm--needs-attention`, `campaign-confirm--invalid-schedule`, `campaign-confirm--summary-error`, `campaign-confirm--edit-general` |

Màn #19 xác nhận thêm Follow-up có route `followup-success`. Danh sách chiến dịch trước khi có Webinar dùng `campaign-list--base`; danh sách có chiến dịch đã duyệt dùng `campaign-list`.

## Kết luận ngắn của lượt rà soát ban đầu

- Đã lấy danh mục và bản tóm tắt cấu trúc/văn bản của **121/121 frame** Figma bằng `get_page_nodes` và `scan_design`.
- **90 frame có màn, hộp thoại hoặc hành vi FE tương ứng nhưng mới khớp một phần**; **31 frame chưa có trạng thái/màn FE tương ứng**. `Có một phần` không có nghĩa là đúng pixel hoặc đúng toàn bộ nghiệp vụ.
- Đã so ảnh ở viewport 1440 × 1024 cho **11 cặp màn chính**: `Quản lý Response`, `Soạn phản hồi`, `Tạo lịch Follow-up`, `Kết quả Follow-up`, `Chọn danh sách contact`, `Danh sách chiến dịch`, `Trình soạn thảo email`, `Xem trước email`, `Chọn tài khoản gửi`, `Thiết lập lịch gửi`, `Xác nhận chiến dịch`. Cả 11 cặp còn sai khác trực quan hoặc nội dung; đây chưa phải kiểm tra pixel tự động.
- Phần FE hiện dùng dữ liệu demo cục bộ; các trạng thái lỗi phụ thuộc API vẫn cần được thiết kế/hiện thực ở FE trước khi nối BE.

## Các sai khác ưu tiên

1. **P1 — Xóa lịch Follow-up:** FE loại hẳn lịch khỏi mảng; Figma xác nhận lịch chuyển sang `Đã xóa` và giữ dữ liệu. Đã tái hiện trên trình duyệt với RSP-031.
2. **P1 — Biến email:** FE chấp nhận `{{Chuc vu}}` và hiện nguyên văn trong preview, không báo lỗi; Figma có hai frame lỗi biến (#81, #86). Đã tái hiện trên trình duyệt.
3. **P1 — Sai dữ liệu giữa chiến dịch:** mở chiến dịch `Bản tin khách hàng tháng 11` từ danh sách, chọn tài khoản và `Gửi ngay` rồi sang xác nhận vẫn thấy tiêu đề email mẫu của `Webinar bảo mật dữ liệu 2026`. Đã tái hiện trên trình duyệt; dữ liệu nội dung hiện dùng chung thay vì gắn với chiến dịch.
4. **P1 — Kênh phản hồi SMS:** UC8.1 yêu cầu chọn Email hoặc SMS; FE hiện chỉ có option Email và chỉ kiểm tra địa chỉ email.
5. **P1 — Nhóm trạng thái chưa có:** 31 frame, gồm lỗi gửi phản hồi/lưu ghi chú, chiến dịch rỗng, hết tài khoản gửi, lỗi lưu lịch và xác nhận, kiểm tra lại lịch/tài khoản.
6. **P1 — Tạm dừng/tiếp tục gửi:** hộp tạm dừng thiếu số đã/chưa gửi và lý do; màn tiếp tục gửi dùng tóm tắt chung, không thể hiện 420 Contact `Chưa gửi` của frame.
7. **P2 — Độ khớp trực quan:** bảng Response ở FE có hàng thấp hơn và badge dạng pill; form Follow-up hẹp hơn Figma; form Soạn phản hồi một cột thay vì hai cột; màn đặt lịch có nút radio bị phóng lớn; màn xác nhận thiếu ảnh xem trước email trong thẻ; danh sách chiến dịch có hành động chật và dòng cuối khác frame gốc.
8. **P2 — Nội dung demo:** lịch sử phản hồi/trạng thái ban đầu thiếu các dòng mẫu trong Figma; Kết quả Follow-up đang là An Phú/RSP-031 `Chờ thực hiện` thay vì Việt Tín/RSP-033 `Có phản hồi`; mở trực tiếp Trình soạn thảo và Xem trước email cho nội dung rỗng thay vì bản mẫu trong frame; thư viện email cho nhiều mẫu nhưng đều chèn cùng nội dung; khối kéo thả hiện chỉ thêm nhãn văn bản.

## Điểm cần BA xác nhận

- Frame tạm dừng (#43) đồng thời ghi lý do `(bắt buộc)` và `Không bắt buộc, tối đa 250 ký tự`. Đặc tả UC6.2 ghi **không bắt buộc**; BA cần đồng bộ lại Figma nếu muốn FE khớp cả thiết kế lẫn đặc tả.
- Đã chốt ngày 11/11: dùng nhãn `Xóa Response` trên FE; thao tác là ẩn bản ghi khỏi danh sách, giữ dữ liệu gốc. Cảnh báo và xác nhận đều theo quyết định này.
- Frame từ chối Email (#17) nói An Phú/RSP-031 đã từ chối, nhưng dữ liệu mẫu của màn Quản lý Response gắn RSP-031 là `Cần xử lý`. Cần chốt dữ liệu minh họa nhất quán.
- BA chốt ngày 11/11: giữ RSP-031 `Mới` ở màn danh sách Response và giữ bản lịch sử mẫu đã phản hồi ở màn lịch sử riêng. Đây là hai trạng thái minh họa theo từng frame, không phải lịch sử nhất quán của một bản ghi thực.

## Chú giải

- **Có một phần:** có màn/hành vi FE gần với frame; còn sai khác hoặc chưa kiểm tra đủ để xác nhận khớp hoàn toàn.
- **Chưa có:** không tìm thấy màn/trạng thái FE tương ứng trong luồng hiện tại.

## Đối chiếu ảnh các màn chính

| Màn | Sai khác thấy trong ảnh ở 1440 × 1024 |
| --- | --- |
| Quản lý Response | Hàng bảng FE cao hơn; badge trạng thái dạng pill khác frame. |
| Soạn phản hồi | Figma đặt bốn trường trong lưới hai cột, có mẫu và nội dung điền sẵn; FE xếp một cột, mẫu mặc định `Không dùng mẫu`, nội dung trống. |
| Tạo lịch Follow-up | Form FE hẹp hơn và bố cục trường/nút khác frame. |
| Kết quả Follow-up | Frame là Việt Tín/RSP-033, trạng thái `Có phản hồi`, 2 mốc lịch sử; FE mở trực tiếp là An Phú/RSP-031, `Chờ thực hiện`, 1 mốc lịch sử và thêm nút Xóa. |
| Chọn danh sách contact | Bố cục và nội dung danh sách còn khác frame; các trạng thái liên quan nằm ở hàng #64–#72. |
| Danh sách chiến dịch | Cột hành động FE chật; hàng cuối và trạng thái khác frame gốc. |
| Trình soạn thảo email | Frame có tiêu đề, thân thư, nút và tài liệu mẫu; FE mở trực tiếp để trống tiêu đề/thân thư và hiển thị vùng nhập lớn hơn. |
| Xem trước email | Frame có email hoàn chỉnh với tiêu đề, lời chào, CTA; FE mở trực tiếp chỉ thấy logo dạng chữ, tên tệp và liên kết từ chối. |
| Chọn tài khoản gửi | Bảng FE còn khác cỡ chữ, chiều cao hàng và đường phân cách. |
| Thiết lập lịch gửi | Nút radio FE bị phóng lớn; form hẹp hơn và giá trị ngày/giờ khác frame. |
| Xác nhận chiến dịch | FE thiếu ảnh xem trước email trong thẻ, thông tin duyệt và một số chi tiết người nhận; bố cục thưa hơn frame. |

Các kết quả “mở trực tiếp” chỉ mô tả trạng thái FE khi truy cập URL của màn; chưa kết luận mọi đường đi đến màn đều như vậy.

## Danh mục 121 frame

### Response và Follow-up

| # | Node Figma | Frame | FE | Đối chiếu cụ thể |
| ---: | --- | --- | --- | --- |
| 1 | `43:6174` | Quản lý Response | Có một phần | response-list: bảng và điều hướng có; hàng thấp hơn, badge trạng thái khác Figma. |
| 2 | `43:6297` | Cập nhật trạng thái | Có một phần | response-status: có chọn trạng thái và ghi chú; không nạp ghi chú mẫu. |
| 3 | `43:6298` | Kết quả Follow-up | Có một phần | followup-result: Figma là Việt Tín/RSP-033 `Có phản hồi` với 2 mốc lịch sử; FE mở trực tiếp là An Phú/RSP-031 `Chờ thực hiện` với 1 mốc và nút Xóa. |
| 4 | `43:6299` | Tạo lịch Follow-up | Có một phần | followup-create: có form; mục tiêu trống, bố cục trường và vị trí nút khác Figma. |
| 5 | `43:6300` | Soạn phản hồi | Có một phần | response-reply: có form Email nhưng xếp một cột thay vì lưới hai cột; mẫu/nội dung chưa được nạp sẵn khi mở trực tiếp. Chưa có lựa chọn SMS như đặc tả UC8.1. |
| 6 | `43:6301` | Thêm Response | Có một phần | response-add: có form và kiểm tra cơ bản; lưu cục bộ. |
| 7 | `43:6302` | Quản lý lịch Follow-up | Có một phần | followup-list: có bảng và điều hướng; dữ liệu/hàng chưa đối chiếu trọn vẹn. |
| 8 | `43:6303` | Chi tiết Response | Có một phần | response-detail: có thông tin và liên kết lịch sử; dữ liệu mẫu chưa đủ mọi nhánh. |
| 9 | `43:6304` | Ghi chú kết quả | Có một phần | followup-note: có form và lưu cục bộ. |
| 10 | `47:7604` | Lịch sử phản hồi đã gửi | Có một phần | response-history: chỉ có dòng sau thao tác demo; thiếu các dòng Email/SMS mẫu. |
| 11 | `47:7735` | Lịch sử trạng thái Response | Có một phần | response-status-history: lưu lần đổi trạng thái demo; thiếu các mốc lịch sử mẫu. |
| 12 | `60:6324` | Cập nhật Response | Có một phần | response-edit: có form, giới hạn Mới/Đang xử lý. |
| 13 | `99:32133` | Quản lý Response · Danh sách trống | Có một phần | response-empty: có trạng thái; thiếu hành động Điều chỉnh bộ lọc. |
| 14 | `99:32134` | Quản lý Response · Lỗi tải dữ liệu | Có một phần | response-load-error: có trạng thái; thiếu hành động Về danh sách. |
| 15 | `99:32135` | Chi tiết Response · Không có quyền truy cập | Có một phần | response-access-denied: có trạng thái xem trước; chưa có phân quyền thật. |
| 16 | `99:32136` | Tạo lịch Follow-up · Lịch Follow-up đã tồn tại | Có một phần | followup-duplicate: có trạng thái; giữ form khi quay lại. |
| 17 | `99:32137` | Tạo lịch Follow-up · Khách hàng từ chối Email | Có một phần | followup-optout: có trạng thái; câu chữ không gắn An Phú/RSP-031 như Figma. |
| 18 | `99:32138` | Chuỗi Follow-up · Tạo lịch tiếp theo thất bại | Chưa có | Chưa có màn lỗi tự tạo lịch Follow-up tiếp theo. |
| 19 | `99:32139` | Tạo lịch Follow-up · Tạo thành công | Có một phần | followup-list: chỉ có thông báo thành công, chưa có màn FU-0142. |
| 20 | `99:32140` | Kết quả Follow-up · Không có phản hồi | Có một phần | followup-result: có trạng thái Không phản hồi mẫu; chưa có màn hết lượt 2/2. |
| 21 | `170:59855` | Tạo lịch Follow-up · Thiếu thông tin bắt buộc | Có một phần | followup-create: kiểm tra trường trống; hiển thị lỗi khác frame. |
| 22 | `170:59966` | Tạo lịch Follow-up · Thời gian không hợp lệ | Có một phần | followup-create: kiểm tra thời gian quá khứ; chưa có bản lỗi riêng. |
| 23 | `212:66195` | Quản lý Response · Không thể xóa | Có một phần | response-list: lỗi điều kiện ẩn nằm trong hộp thoại, không có màn Không thể xóa. |
| 24 | `213:66320` | Thêm Response · Thông tin không hợp lệ | Có một phần | response-add: kiểm tra email/điện thoại/nội dung; thông báo khác frame. |
| 25 | `213:66349` | Cập nhật Response · Thông tin không hợp lệ | Có một phần | response-edit: kiểm tra dữ liệu; thông báo khác frame. |
| 26 | `213:66516` | Cập nhật Response · Không thể chỉnh sửa | Có một phần | response-detail: nút sửa bị vô hiệu hóa; không có màn giải thích Không thể chỉnh sửa. |
| 27 | `213:66599` | Quản lý Response · Xác nhận xóa | Có một phần | response-list: có hộp thoại Ẩn; chi tiết xác nhận khác Figma. |
| 28 | `213:66682` | Soạn phản hồi · Thông tin không hợp lệ | Có một phần | response-reply: có lỗi inline khi thiếu dữ liệu. |
| 29 | `213:66786` | Soạn phản hồi · Gửi phản hồi thất bại | Chưa có | Chưa có trạng thái gửi phản hồi thất bại và giữ bản nháp. |
| 30 | `213:66890` | Cập nhật trạng thái · Chuyển trạng thái không hợp lệ | Có một phần | response-status: giới hạn option hợp lệ; trạng thái lỗi chuyển sai không có đường đi thông thường. |
| 31 | `213:66988` | Quản lý lịch Follow-up · Không tìm thấy khách hàng hoặc Response | Chưa có | Chưa có màn không tìm thấy khách hàng/Response. |
| 32 | `213:67071` | Quản lý lịch Follow-up · Lỗi tải thông tin khách hàng | Chưa có | Chưa có màn lỗi tải thông tin khách hàng. |
| 33 | `213:67154` | Tạo lịch Follow-up · Thông số không hợp lệ | Có một phần | followup-create: kiểm tra số nguyên dương; trình bày khác frame. |
| 34 | `213:67270` | Quản lý lịch Follow-up · Xác nhận xóa | Có một phần | followup-list/result: có xác nhận xóa nhưng FE loại hàng; Figma ghi chuyển Đã xóa. |
| 35 | `213:67353` | Quản lý lịch Follow-up · Không thể xóa | Có một phần | followup-list: hộp thoại vẫn có thể mở cho lịch đã hoàn tất; chỉ chặn khi xác nhận. |
| 36 | `213:67436` | Kết quả Follow-up · Lưu trạng thái thất bại | Chưa có | Chưa có trạng thái lỗi lưu kết quả Follow-up. |
| 37 | `213:67519` | Ghi chú kết quả · Lưu ghi chú thất bại | Chưa có | Chưa có trạng thái lỗi lưu ghi chú. |

### Quản lý và tiếp tục chiến dịch

| # | Node Figma | Frame | FE | Đối chiếu cụ thể |
| ---: | --- | --- | --- | --- |
| 38 | `327:241209` | Danh sách chiến dịch | Có một phần | campaign-list: có danh sách và các thao tác; hành động trong ô chật, dòng cuối FE là Webinar đã duyệt thay cho Bản tin tháng 10 hoàn thành trong frame gốc. |
| 39 | `327:241718` | Danh sách chiến dịch - Chưa có chiến dịch | Chưa có | Chưa có trạng thái danh sách chiến dịch trống. |
| 40 | `327:241792` | Thông tin tổng quát | Có một phần | campaign-list: có hộp Thông tin chiến dịch; thiếu một số trường và nút Xác nhận. |
| 41 | `327:242358` | Thông tin tổng quát - Chiến dịch đã tạm dừng | Có một phần | campaign-list: cùng hộp thông tin; thiếu thời điểm/lý do tạm dừng. |
| 42 | `327:242936` | Danh sách chiến dịch - Không tải được thông tin | Chưa có | Chưa có trạng thái tải thông tin chiến dịch thất bại. |
| 43 | `327:243452` | Danh sách chiến dịch - Hộp thoại tạm dừng | Có một phần | campaign-list: có hộp tạm dừng; thiếu số đã/chưa gửi và lý do. |
| 44 | `327:244006` | Danh sách chiến dịch - Tạm dừng thất bại | Chưa có | Chưa có trạng thái tạm dừng thất bại; FE luôn đổi trạng thái. |
| 45 | `327:244574` | Danh sách chiến dịch - Tạm dừng thành công | Có một phần | campaign-list: đổi badge và hiện thông báo cục bộ. |
| 46 | `327:245090` | Danh sách chiến dịch - Hộp thoại xóa | Có một phần | campaign-list: có hộp xóa; thiếu tên cụ thể và cảnh báo không thể khôi phục. |
| 47 | `327:245643` | Danh sách chiến dịch - Xóa thất bại | Chưa có | Chưa có trạng thái xóa thất bại; FE luôn xóa nếu progress bắt đầu 0/. |
| 48 | `327:246210` | Danh sách chiến dịch - Không thể xóa | Chưa có | Chưa có màn Không thể xóa cho chiến dịch đang gửi; nút xóa bị ẩn. |
| 49 | `327:246726` | Danh sách chiến dịch - Xóa thành công | Có một phần | campaign-list: xóa hàng và hiện thông báo cục bộ. |
| 50 | `327:247194` | Danh sách chiến dịch - Chọn mục sửa | Có một phần | campaign-list: có hộp chọn mục sửa; lựa chọn và bước xác nhận khác Figma. |
| 51 | `327:247782` | Danh sách chiến dịch - Sửa thông tin chung | Có một phần | campaign-list: có hộp sửa tên/mô tả. |
| 52 | `327:248338` | Danh sách chiến dịch - Thông tin chung không hợp lệ | Có một phần | campaign-list: có lỗi inline tên trống/trùng; trình bày khác frame. |
| 53 | `327:248894` | Danh sách chiến dịch - Không được phép sửa | Chưa có | Chưa có trạng thái Không được phép sửa. |
| 54 | `327:249410` | Chọn/soạn mẫu email - Sửa chiến dịch đã tạm dừng | Có một phần | campaign-editor: dùng lại form chung; thiếu dữ liệu/chế độ sửa chiến dịch tạm dừng. |
| 55 | `327:249622` | Chọn tài khoản gửi - Sửa chiến dịch đã tạm dừng | Có một phần | campaign-sender: dùng lại bảng chung; không thể hiện ngữ cảnh tạm dừng. |
| 56 | `327:249775` | Thiết lập lịch gửi - Sửa chiến dịch đã tạm dừng | Có một phần | campaign-schedule: dùng lại form chung; không thể hiện ngữ cảnh tạm dừng. |
| 57 | `327:249944` | Tiếp tục gửi - Xem lại trước khi gửi tiếp | Có một phần | campaign-resume: dùng lại màn xác nhận; thiếu 420 người Chưa gửi, lý do dừng. |
| 58 | `327:250110` | Tiếp tục gửi - Xem nội dung email | Có một phần | campaign-resume: có hộp xem email nhưng không có nội dung theo chiến dịch tạm dừng. |
| 59 | `327:250305` | Tiếp tục gửi - Đã xem nội dung | Có một phần | campaign-resume: bật xác nhận sau khi mở hộp xem; nội dung vẫn dùng dữ liệu chung. |
| 60 | `327:250471` | Tiếp tục gửi - Không đủ hạn mức | Chưa có | Chưa có trạng thái Không đủ hạn mức khi tiếp tục gửi. |
| 61 | `327:250645` | Tiếp tục gửi - Thao tác thất bại | Chưa có | Chưa có trạng thái tiếp tục gửi thất bại. |
| 62 | `327:250818` | Xác nhận chiến dịch - Đã gửi một phần | Có một phần | campaign-resume: có màn xác nhận dùng chung; không theo dõi từng người nhận Chưa gửi. |
| 63 | `327:250992` | Danh sách chiến dịch - Tiếp tục gửi thành công | Có một phần | campaign-list: đổi trạng thái/hiện thông báo sau Tiếp tục gửi. |

### Tạo chiến dịch, email và xem trước

| # | Node Figma | Frame | FE | Đối chiếu cụ thể |
| ---: | --- | --- | --- | --- |
| 64 | `327:251508` | Chọn danh sách contact | Có một phần | campaign-contacts: có form tên, mô tả và danh sách. |
| 65 | `327:251653` | Chọn danh sách contact - Đã nhập thông tin | Có một phần | campaign-contacts: form giữ dữ liệu đã nhập. |
| 66 | `327:251810` | Chọn danh sách contact - Thông tin không hợp lệ | Có một phần | campaign-contacts: có kiểm tra tên trống/trùng/danh sách; câu chữ khác frame. |
| 67 | `327:251956` | Chọn danh sách contact - Không có danh sách khả dụng | Chưa có | Chưa có trạng thái không có danh sách Contact đã xác nhận. |
| 68 | `327:252065` | Chọn danh sách contact - Kết quả lọc | Có một phần | campaign-filtered: có số mẫu 915/115/800 khi chọn đủ ba danh sách; các tổ hợp khác hiện —. |
| 69 | `327:252240` | Chọn danh sách contact - Không còn contact hợp lệ | Chưa có | Chưa có trạng thái không còn Contact hợp lệ sau lọc. |
| 70 | `327:252416` | Chọn danh sách contact - Lưu thất bại | Chưa có | Chưa có trạng thái lưu/gửi kiểm tra thất bại. |
| 71 | `327:252598` | Chọn danh sách contact - Đã gửi kiểm tra | Có một phần | campaign-list: có trạng thái Chờ kiểm tra; thiếu màn xác nhận gửi kiểm tra riêng. |
| 72 | `327:252719` | Chọn danh sách contact - Danh sách bị trả về | Có một phần | campaign-contacts: có ghi chú trả về cố định; chưa theo dữ liệu yêu cầu duyệt. |
| 73 | `327:252879` | Danh sách chiến dịch - Chờ kiểm tra danh sách | Có một phần | campaign-list: hiển thị dòng Chờ kiểm tra danh sách. |
| 74 | `327:253435` | Danh sách chiến dịch - Danh sách đã duyệt | Có một phần | campaign-list: có dòng Danh sách đã duyệt mẫu. |
| 75 | `327:253992` | Chọn/soạn mẫu email - Thư viện mẫu | Có một phần | campaign-email: có bảng thư viện; các mẫu hiện chèn cùng một nội dung demo. |
| 76 | `327:254169` | Chọn/soạn mẫu email - Bố cục trống | Chưa có | Chưa có bước chọn Bố cục trống 1/2/3. |
| 77 | `327:254324` | Chọn/soạn mẫu email - Trình soạn thảo | Có một phần | campaign-editor: mở trực tiếp để trống tiêu đề/thân thư thay vì nội dung mẫu Figma; khối kéo thả chỉ chèn nhãn văn bản, chưa là khối email. |
| 78 | `327:254579` | Chọn/soạn mẫu email - Đã xem trước | Có một phần | campaign-editor: có cờ đã xem trước; lưu mới cho đi tiếp. |
| 79 | `327:254834` | Chọn/soạn mẫu email - Logo hoặc tệp không hợp lệ | Có một phần | campaign-editor: có kiểm tra tên/size tệp; chỉ lưu tên tệp, không xử lý file. |
| 80 | `327:255096` | Chọn/soạn mẫu email - Thông tin không hợp lệ | Có một phần | campaign-editor: kiểm tra tiêu đề/nội dung; một số thông báo chưa đúng bố cục Figma. |
| 81 | `327:255358` | Chọn/soạn mẫu email - Biến lỗi | Chưa có | Chưa kiểm tra biến cá nhân hóa ngoài danh sách hỗ trợ. |
| 82 | `327:255621` | Chọn/soạn mẫu email - Lưu thất bại | Chưa có | Chưa có trạng thái lưu nội dung thất bại. |
| 83 | `327:255883` | Xem trước email - Chế độ máy tính | Có một phần | campaign-preview: có chế độ máy tính và thay biến mẫu khi có nội dung; mở trực tiếp chỉ thấy logo dạng chữ, tên tệp và liên kết từ chối, thiếu nội dung email của frame. |
| 84 | `327:255996` | Xem trước email - Chế độ điện thoại | Có một phần | campaign-preview: có chế độ điện thoại bằng khung hẹp. |
| 85 | `327:256109` | Xem trước email - Contact khác | Có một phần | campaign-preview: đổi được Nguyễn Thu Hà/Lê Quốc Bảo. |
| 86 | `327:256222` | Xem trước email - Biến lỗi | Chưa có | Chưa có trạng thái lỗi biến trong bản xem trước. |
| 87 | `327:256344` | Xem trước email - Thao tác thất bại | Chưa có | Chưa có trạng thái tạo bản xem trước thất bại. |

### Tài khoản gửi, lịch gửi và xác nhận

| # | Node Figma | Frame | FE | Đối chiếu cụ thể |
| ---: | --- | --- | --- | --- |
| 88 | `327:256420` | Chọn tài khoản gửi | Có một phần | campaign-sender: có bảng và chọn tài khoản; hàng, cỡ chữ và đường phân cách chưa khớp ảnh Figma. |
| 89 | `327:256587` | Chọn tài khoản gửi - Tài khoản đủ điều kiện | Có một phần | campaign-sender: tài khoản mẫu đủ điều kiện có thể chọn. |
| 90 | `327:256789` | Chọn tài khoản gửi - Tài khoản không đủ điều kiện | Có một phần | campaign-sender: khóa một dòng dùng 85% hạn mức; chưa tính theo dữ liệu thực. |
| 91 | `327:256966` | Chọn tài khoản gửi - Hết tài khoản | Chưa có | Chưa có trạng thái hết tài khoản đủ điều kiện. |
| 92 | `327:257096` | Chọn tài khoản gửi - Tên người gửi không hợp lệ | Chưa có | Chưa có trường/kiểm tra Tên người gửi. |
| 93 | `327:257298` | Chọn tài khoản gửi - Lưu thất bại | Chưa có | Chưa có trạng thái lưu lựa chọn tài khoản thất bại. |
| 94 | `327:257507` | Chọn tài khoản gửi - Mở từ danh sách | Có một phần | campaign-sender: mở từ danh sách bằng màn chung, không có dữ liệu riêng 500 người. |
| 95 | `327:257674` | Thiết lập lịch gửi | Có một phần | campaign-schedule: có hẹn giờ/gửi ngay và trường ngày giờ; nút radio bị phóng lớn, form hẹp hơn và ngày/giờ mặc định khác frame Figma. |
| 96 | `327:257885` | Thiết lập lịch gửi - Lịch dự kiến | Có một phần | campaign-schedule: có thông báo lịch dự kiến, không tính thời điểm hoàn tất cụ thể. |
| 97 | `327:258111` | Thiết lập lịch gửi - Gửi ngay | Có một phần | campaign-schedule: có lựa chọn Gửi ngay. |
| 98 | `327:258337` | Thiết lập lịch gửi - Thông tin không hợp lệ | Có một phần | campaign-schedule: chặn lịch ngoài 15 phút–90 ngày; không kiểm tra đủ hạn mức/lịch nền. |
| 99 | `327:258548` | Thiết lập lịch gửi - Lưu thất bại | Chưa có | Chưa có trạng thái lưu lịch thất bại. |
| 100 | `327:258781` | Thiết lập lịch gửi - Mở từ danh sách | Có một phần | campaign-schedule: mở từ danh sách bằng màn chung, dùng số/tài khoản fallback. |
| 101 | `327:258992` | Xác nhận chiến dịch - Chưa xem nội dung | Có một phần | campaign-confirm: chặn nút cho đến khi mở hộp xem nội dung; thiếu ảnh xem trước email trong thẻ, trường người duyệt/thời điểm duyệt và bố cục theo frame. |
| 102 | `327:259215` | Xác nhận chiến dịch - Xem nội dung email | Có một phần | campaign-confirm: có hộp xem email; chưa cá nhân hóa đúng mọi chiến dịch. |
| 103 | `327:259467` | Xác nhận chiến dịch - Bốn phần hợp lệ | Có một phần | campaign-confirm: cho xác nhận sau xem nội dung; chỉ kiểm tra FE. |
| 104 | `327:259690` | Xác nhận chiến dịch - Xác nhận cuối | Có một phần | campaign-confirm: có hộp xác nhận, thiếu số email/thời điểm hoàn tất dự kiến. |
| 105 | `327:259956` | Xác nhận chiến dịch - Xác nhận cuối - gửi ngay | Có một phần | campaign-confirm: hộp xác nhận Gửi ngay dùng chung, thiếu tóm tắt riêng. |
| 106 | `327:260222` | Xác nhận chiến dịch - Lưu thất bại | Chưa có | Chưa có trạng thái lưu/xác nhận chiến dịch thất bại. |
| 107 | `327:260502` | Xác nhận chiến dịch - Cần xử lý | Chưa có | Chưa có trạng thái Cần xử lý khi dữ liệu tóm tắt sai. |
| 108 | `327:260727` | Xác nhận chiến dịch - Lịch hoặc tài khoản không còn hợp lệ | Chưa có | Chưa kiểm tra lại lịch hoặc tài khoản tại thời điểm xác nhận. |
| 109 | `327:260957` | Xác nhận chiến dịch - Không tải được tóm tắt | Chưa có | Chưa có trạng thái không tải được tóm tắt. |
| 110 | `327:261110` | Xác nhận chiến dịch - Chọn mục sửa | Có một phần | campaign-confirm: có hộp Chỉnh sửa; thiếu mục Thông tin chung. |
| 111 | `327:261412` | Xác nhận chiến dịch - Sửa thông tin chung | Chưa có | Chưa có hộp sửa Thông tin chung từ màn xác nhận. |
| 112 | `327:261682` | Chọn/soạn mẫu email - Chế độ sửa | Có một phần | campaign-editor: dùng form soạn thảo chung cho chế độ sửa. |
| 113 | `327:261894` | Chọn tài khoản gửi - Chế độ sửa | Có một phần | campaign-sender: dùng bảng chung cho chế độ sửa. |
| 114 | `327:262047` | Thiết lập lịch gửi - Chế độ sửa | Có một phần | campaign-schedule: dùng form chung cho chế độ sửa. |
| 115 | `327:262216` | Xác nhận chiến dịch - Mở từ danh sách | Có một phần | campaign-confirm: mở từ danh sách; dữ liệu chiến dịch được điền bằng fallback. |
| 116 | `327:262437` | Danh sách chiến dịch - Xác nhận thành công | Có một phần | campaign-list: có badge/thông báo thành công demo sau xác nhận. |
| 117 | `327:263001` | Danh sách chiến dịch - Xác nhận thành công - gửi ngay | Có một phần | campaign-list: có badge Đang gửi demo khi chọn Gửi ngay. |
| 118 | `327:263565` | Xác nhận chiến dịch - Đã gửi một phần - Xem nội dung email | Có một phần | campaign-resume: có hộp xem email dùng chung, không theo 420 người còn lại. |
| 119 | `327:263762` | Xác nhận chiến dịch - Đã gửi một phần - Đã xem nội dung | Có một phần | campaign-resume: có cờ đã xem; dữ liệu còn lại không được theo dõi. |
| 120 | `327:263942` | Xác nhận chiến dịch - Đã gửi một phần - Xác nhận cuối | Có một phần | campaign-resume: có hộp cuối chung; thiếu 420 Contact Chưa gửi và lịch dự kiến. |
| 121 | `327:264139` | Danh sách chiến dịch - Xác nhận thành công - đã gửi một phần | Có một phần | campaign-list: đổi trạng thái demo; chưa có gửi tiếp thực tế. |

## Phương pháp và giới hạn

- Danh mục và bản tóm tắt đã đọc đủ 121 frame; 11 cặp màn chính được so ảnh trực quan trong lượt rà soát này. Frame Trình soạn thảo email cao 1430 px nên ảnh Figma đầy đủ chỉ được so với phần đầu viewport FE cao 1024 px. Chưa đọc cây node chi tiết, kiểm tra pixel, hover/focus và từng trạng thái lỗi cho toàn bộ 121 frame.
- Trạng thái FE được kiểm tra trong `frontend/src/NextFlows.tsx`, `frontend/src/nextFlows.css` và điều hướng `frontend/src/App.tsx`; chưa có API nên các nhánh lỗi mạng không thể phát sinh tự nhiên.
- Đã xác minh riêng bằng trình duyệt ba sai khác về biến email, xóa lịch Follow-up và dữ liệu email sai chiến dịch. Không sửa mã nguồn hay Figma trong lần đối chiếu này.
