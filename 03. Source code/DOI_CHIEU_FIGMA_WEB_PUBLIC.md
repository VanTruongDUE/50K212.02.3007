# Đối chiếu Figma với web public — 15/11/2026

## Cập nhật sửa mã cục bộ sau đối chiếu

Đã sửa các sai lệch cấu trúc đã xác nhận trong lượt audit bên dưới. **Chưa commit, push hoặc deploy các sửa đổi này; kết luận về bản public c179922 bên dưới là bằng chứng trước sửa.** Figma không bị chỉnh sửa.

| Nhóm | Sửa đổi |
|---|---|
| Hàng nút form Response / Follow-up | Nút chính trước, Hủy sau, cùng nhóm bên phải; rộng 240px, cao 44px, gap 16px trên desktop. Footer form không có nền thừa. Các thanh Contact/Chiến dịch vẫn chia trái–phải và có nền theo thiết kế. |
| Lịch sử Response | Nút về chi tiết nằm bên phải, kiểu primary; không còn nằm bên trái trong thanh nền rộng. |
| Soạn phản hồi | Khôi phục ô chọn mẫu từ API email-templates, bố cục hai cột và nút Hủy. Chỉ dùng mẫu văn bản không chứa khối ảnh/biến chưa được API phản hồi hỗ trợ. Giữ tài khoản gửi, tiêu đề và kênh SMS đã chốt cho nghiệp vụ thật. |
| Trình soạn email chiến dịch | Khôi phục thanh năm bước ở bước 2; hai cột editor/công cụ; footer Xem trước/Lưu nội dung. Lưu thành mẫu nằm gọn trong công cụ. Sửa tải trực tiếp editor để nạp subject/body đã lưu, không ghi đè lựa chọn bố cục trống khi đi từ trong ứng dụng. |
| Kiểm tra / xác nhận Contact | Bổ sung nguồn, thời gian, bốn thống kê và tiêu chí. BE trả nullable provenance từ đúng search job gắn với list/owner; không dựng số không hợp lệ/trùng bằng Contact đã được lọc. Danh sách không có lịch sử tìm kiếm hiển thị dấu — cho thống kê không biết. |
| Xác nhận / tiếp tục chiến dịch | Dùng reviewed_at của từng danh sách đã duyệt, không dùng confirmed_at của nhân viên. Khôi phục dòng thời điểm hoàn tất dự kiến; hiển thị Chưa xác định vì BE chưa có mô hình dự báo đáng tin cậy. |
| Ẩn Response / Follow-up | Xác nhận gọn ở giữa, có tên/mã đối tượng, nút xác nhận và Hủy; bỏ bước hỏi lại thừa ở Follow-up. Giữ kiểm tra điều kiện ẩn ở FE và BE, không xóa vật lý. |
| Trưởng phòng | Thanh Lưu/Hủy tách khỏi form tài khoản, nút rộng 160px; giữ SMTP/OAuth/IMAP và quota 100 email/3 ngày. Validation tiếng Việt ngay dưới ô lỗi. Kết quả duyệt/không đạt có bảng Thông tin/Giá trị và thời điểm kiểm tra. |
| Cột Contact | Cố định tỉ lệ bốn cột, cho email dài xuống dòng, không đẩy các cột còn lại ra khỏi khung. |

Kiểm chứng đã chạy:

- FE build và lint đạt; 9 kiểm thử điều hướng/validation đạt.
- BE: 18 suite, 224 test đạt; build đạt.
- Chrome local dùng API fixture: **36 route × hai viewport 1440×1024 / 1366×900 = 72 lượt**, không lỗi JavaScript và không cuộn ngang. Có assert kích thước/gap/thứ tự cặp nút form; thử chọn mẫu, Hủy, nạp lại email đã lưu, Xem trước, PATCH Response/trạng thái/ghi chú và xác nhận ẩn. Các request ghi trong lượt UI này được chặn vào fixture, không gửi thư hoặc thay đổi dữ liệu production.
- Đã so trực quan 16 cặp ảnh với PNG Figma xuất trực tiếp trong lượt audit, cùng các ảnh kiểm tra bổ sung sau sửa. Đây không phải xác nhận mọi trạng thái của toàn bộ 257 frame.
- Chạy controller build mới với **PostgreSQL Neon thật, chỉ SELECT**: danh sách Contact của nhân viên, chi tiết danh sách, danh sách của trưởng phòng, chi tiết chiến dịch kèm thời điểm duyệt đều đạt. Không ghi DB hoặc thay schema.
- Bằng chứng: `.context-cache/public-figma-fix/browser-results.json`, ảnh `1440-*.png` / `1366-*.png`, `comparison-*.png`, `database-read-results.json`.

Giới hạn còn lại: chưa kiểm lại bản public sau deploy; không gửi SMTP/đồng bộ IMAP hoặc gọi Search trong lượt sửa giao diện. Chưa tái hiện toàn bộ trạng thái lỗi dịch vụ của 257 frame. Các phần đã chốt khác Figma như Arial, sidebar phân nhóm, ẩn thay xóa, SMTP/OAuth/IMAP và quota 3 ngày vẫn được giữ; vì vậy không cam kết giống từng pixel.

## Kết luận bản public trước sửa

**Web public chưa giống đầy đủ form trong Figma.** Màu nền, khung ứng dụng, nhiều lưới cột và các bước chính được giữ, nhưng một số màn còn khác cấu trúc form, thiếu điều khiển hoặc phần tổng hợp, và có trạng thái lỗi hiển thị khác thiết kế. Đây là sai khác nhìn thấy qua ảnh và thao tác, không chỉ là lệch vài pixel.

Nguồn thiết kế: file `Màn hình giao diện_Nhóm2`, đọc trực tiếp qua Figma UI MCP. Đích kiểm tra: https://v5-marketing.vercel.app, bản sửa điều hướng `c179922`. Lượt này chỉ kiểm tra và ghi báo cáo; không sửa FE/BE/Figma hoặc triển khai thay đổi mới.

## Cách kiểm tra và giới hạn bằng chứng

- Đã đọc mới danh mục **257 frame**: Trường75, Đức + Huy121, Nhi + Thảo61. Danh mục có bản nháp, bảng trạng thái, thanh tên UC và frame trùng chức năng;257 không có nghĩa257 màn độc lập.
- Hai đánh giá độc lập, theo design-taste-frontend/app screens, Impeccable và ui-ux-pro-max. Figma và quyết định BA là chuẩn; không dùng bộ màu/font/bố cục do skill gợi ý để thay thế.
- Ảnh public được chụp từ bản đăng nhập dùng API thật, không dùng preview/demo/local làm bằng chứng public. Kích thước viewport theo frame, chủ yếu1440×1024; các frame cao dùng đúng chiều cao tương ứng. Có kiểm tra phụ1366×900 nhưng không coi đó là breakpoint Figma mới.
- Đối chiếu cả ảnh và DOM: thứ tự trường, loại control, số cột, chiều rộng, cỡ chữ, chiều cao input, khoảng cách, vị trí nút; không chấm phần trăm giống khi không có phép đo phù hợp.
- Nhân viên có41 lượt chụp public và39 frame Figma đại diện được xuất mới; Trưởng phòng có34 quan sát public và55 PNG Figma chức năng được xuất mới. Đây là số lần quan sát/ảnh tham chiếu, **không phải75 trạng thái public khác nhau đều khớp**.
- Ledger độc lập A:37 frame đối chiếu ảnh,2 thiếu counterpart hợp lệ,157 chỉ đọc metadata. Chủ phiên bổ sung ảnh đăng nhập đã chờ tải xong, xử lý được1 trong2 counterpart còn thiếu; frame lịch sử tìm kiếm vẫn chưa có dữ liệu public tương ứng. Có thêm2 lượt bấm đường vào thực tế (Xem chiến dịch/Ẩn Follow-up). Không cộng các lượt chụp trùng thành số màn đã đạt.
- Với Trưởng phòng:25 frame có cùng trạng thái chức năng đã xem,3 trạng thái validation xem một phần,27 trạng thái chưa tái hiện;6 thanh tên UC không phải màn ứng dụng. Chi tiết từng frame trong báo cáo B bên dưới.
- Các trạng thái chưa mở được như lỗi kết nối dịch vụ, lỗi lưu, gửi thất bại, chuỗi tự động hoặc dữ liệu rỗng toàn tài khoản không bị đánh dấu đạt. Lượt này không gửi email, không gọi Search tiêu credit và không gây lỗi giả trên production.

## Những phần đã giữ được form chính

| Phần | Bằng chứng và đánh giá |
|---|---|
| Đăng nhập ban đầu | Figma156:31985 và public1440×1024: form tại x136/y304,432×332; input và nút432×44; khối ảnh688×976 tại x728/y24. Font Arial24/32 cho tiêu đề và16/24 cho control. Đã chờ ảnh tải xong trước khi so. Form chính khớp rất sát. |
| Shell ứng dụng | Sidebar240px, topbar64px, vùng nội dung bắt đầu x272, thẻ rộng1136px ở viewport1440px. Màu nền/surface/border chính khớp token Figma. |
| Filter Template | Tạo/cập nhật vẫn có tên toàn chiều ngang và lưới ba cột tiêu chí. Khác tên/giá trị dữ liệu không bị coi là lỗi. |
| Tạo chiến dịch/lọc người nhận | Còn thanh5 bước, hai khối thông tin/danh sách, kết quả lọc và thanh xác nhận. Cần chỉnh mật độ và khoảng cách, không phải dựng lại toàn bộ màn. |
| Lịch gửi/xác nhận chiến dịch | Giữ các nhóm trường lịch và lưới tổng hợp chính. Không coi việc fixture chưa chọn sender/chưa có lịch là trường giao diện bị mất. |
| Trưởng phòng kiểm tra Contact | Có4 số tổng hợp, bảng Contact và các hành động Không đạt/Quay lại/Duyệt. Cần cân lại tiêu đề, cột và thông tin kết quả. |

## Sai khác cần ưu tiên

| Ưu tiên | Màn/Frame | Sai khác đã quan sát | Hướng sửa form, giữ nghiệp vụ đã chốt |
|---|---|---|---|
| Cao | Soạn phản hồi —43:6300 | Figma có lưới2×2 gồm Kênh gửi/Người nhận/Mẫu phản hồi/Nội dung. Public thiếu bộ chọn Mẫu phản hồi, thêm tài khoản gửi/tiêu đề và đưa textarea xuống toàn chiều ngang; không có Hủy tại form. | Khôi phục nhóm trường và bố cục theo Figma, bố trí các trường gửi thật bổ sung hợp lý; không xóa trường SMTP cần cho BE. Bổ sung đường Hủy rõ ràng. |
| Cao | Kiểm tra/xác nhận danh sách Contact —16:436,16:472,16:496 | Public rút gọn phần trên bảng; nguồn/thời điểm tìm,4 số tổng hợp và phần tiêu chí/tóm tắt của frame không được thể hiện đủ trong các màn tương ứng. Không giải thích bằng số hàng dữ liệu khác nhau. | Khôi phục phần tổng hợp đúng bước, dùng dữ liệu thật; giữ đường Xem toàn bộ đã yêu cầu. |
| Cao | Trình soạn email —327:254324 | Public thiếu thanh5 bước phía trên editor, trong khi frame có; public thêm khối Lưu thành mẫu bên dưới làm màn dài và thay nhịp bố cục. | Giữ thư viện logo/upload/PDF/biến cá nhân hóa hiện có; sắp lại thanh bước, hai cột editor/công cụ và vùng hành động. Khối lưu mẫu cần vị trí được BA thống nhất. |
| Cao | Thêm/cập nhật tài khoản gửi —486:9432,9491,10387,10446 | Public chỉ có Lưu trong form mở rộng, không còn Hủy và thanh hành động như thiết kế. Form public cao1098px ở viewport1440×1024, nút lưu xuống sát/dưới đáy màn. | Giữ Gmail OAuth/SMTP/IMAP/hạn mức3 ngày; bố trí lại các nhóm trường và hành động để form cân đối, có Hủy. Không quay về hạn mức ngày/giờ cũ. |
| Vừa | Validation tài khoản gửi —231:34002,486:9557,10512 | Thử bỏ trống/email sai kích hoạt validation native của trình duyệt, có câu tiếng Anh; chưa hiện lỗi inline/callout tiếng Việt như Figma. Dữ liệu nhập được giữ. | Hiện lỗi theo control/callout đã thiết kế; giữ validation BE và khả năng sửa tiếp. Không coi đây là lỗi lưu hoặc lỗi xác thực SMTP. |
| Vừa | Kết quả Trưởng phòng duyệt/không đạt —486:8984,9025,9937,9978 | Đã thấy trạng thái và nhận xét thật nhưng thiếu thời điểm người duyệt; bố cục summary chuyển thành danh sách mô tả khác frame. | Khôi phục nhóm kết quả, người duyệt/thời điểm/nhận xét từ API; không dùng thời gian mẫu. |
| Vừa | Xác nhận chiến dịch —327:258992 | Lưới4thẻ vẫn còn, nhưng không có dòng Thời điểm duyệt trong thẻ người nhận; lịch gửi đổi dòng Thời điểm hoàn tất dự kiến thành Khung giờ gửi. | Khôi phục thông tin phục vụ bước xác nhận khi API có dữ liệu; không suy đoán thời điểm duyệt hoặc hoàn tất. Sender/lịch đang trống ở fixture chưa hoàn tất không bị coi là mất control. |
| Vừa | Mật độ và cột bảng Trưởng phòng | H2 trong frame24/32, public20/28; nội dung bắt đầu sớm hơn20px; header bảng16/24 so với public14/21. Email dài kéo rộng cột, dồn Chức vụ/Doanh nghiệp. | Chốt một hệ kích thước desktop cân đối và phân bổ cột có chủ đích. Không biến lệch1–3px thành lỗi ưu tiên. |
| Cần đối chiếu quyết định BA | Khách hàng ở Thêm/Sửa Response | Figma dùng bộ chọn khách hàng, public dùng input văn bản. | Là khác loại control, không chỉ khác CSS. Cần bảo toàn khả năng ghi nhận phản hồi ngoại tuyến khi chốt control phù hợp. |
| Cần đối chiếu quyết định BA | Ẩn Follow-up —213:67270 | Đã bấm thực tế từ kết quả Follow-up sang Ẩn: public mở trang tổng hợp rộng và thanh hành động, frame dùng xác nhận nhỏ đặt giữa trang. | Thống nhất cách trình bày xác nhận, giữ tên khách hàng/đối tượng và điều kiện Ẩn. Không kết luận có lỗi xóa dữ liệu. |

## Những khác biệt không tự coi là lỗi phải hoàn tác

- Arial và việc thống nhất/làm rõ chữ desktop theo yêu cầu trước đây; không đổi sang Inter chỉ vì một phiên bản frame dùng Inter.
- Breadcrumb một cấp ở chức năng chính, các cụm con sidebar tài khoản gửi, logo về Trang chủ, popup tài khoản/đăng xuất.
- Nhãn Ẩn Response; quy ước hành động phá hủy bên trái và nút khác bên phải, ngoại lệ thứ tự thao tác trong từng dòng bảng và wrap theo chiều rộng.
- Gmail OAuth/SMTP/IMAP, gửi ngay, hạn mức100 email/3 ngày, SMS ghi nhận thủ công, lý do tạm dừng không bắt buộc tối đa250ký tự.
- Tên người/chiến dịch, số hàng, số Contact hoặc nội dung email thật khác mẫu Figma. Dữ liệu dài có thể làm lộ vấn đề phân bổ cột, nhưng không được yêu cầu thay bằng dữ liệu mẫu để ảnh giống hơn.
- Một route chi tiết mở trực tiếp bằng URL không nhất thiết là hộp thoại mở từ nút Xem. Chỉ so màn sau đúng hành động; không kết luận mất modal từ khác biệt URL đơn thuần.

## Ảnh và báo cáo chi tiết

- [Form Soạn phản hồi: Figma trái / public phải](.context-cache/public-figma-2026-11-15/root/pair-reply.png).
- [Kiểm tra Contact: Figma trái / public phải](.context-cache/public-figma-2026-11-15/root/pair-check.png).
- [Thêm tài khoản gửi: cặp ảnh1440×1024](.context-cache/public-figma-2026-11-15/B/pair-add.png).
- [Trưởng phòng xem danh sách Contact: cặp ảnh1440×1024](.context-cache/public-figma-2026-11-15/B/pair-review-detail.png).
- [Các bước Chiến dịch](.context-cache/public-figma-2026-11-15/A/campaign-pairs-live.png).
- [Báo cáo độc lập B và ledger61frame](.context-cache/public-figma-2026-11-15/B/PUBLIC_FIGMA_EVIDENCE_B.md).
- [Báo cáo độc lập A và danh mục196frame](PUBLIC_FIGMA_DESIGN_A.md).

Đã kiểm tra lại bằng nút **Xem** trên danh sách chiến dịch: public có modal Thông tin chiến dịch với đủ6dòng, URL vẫn ở campaign-list. Nhận định ban đầu từ route campaign-detail mở trực tiếp đã được loại; không yêu cầu sửa lại phần modal đang đúng.

Các đường ảnh nằm trong cache cục bộ được Git bỏ qua; không phải tài liệu đã xuất bản trên website. Báo cáo này không chứng nhận khớp257/257trạng thái hoặc giống90%/100%pixel. Các trường hợp form lệch nêu trên đủ để kết luận chưa đạt yêu cầu giữ đầy đủ form Figma; cần sửa theo từng nhóm và chụp lại sau sửa.

## Dọn dữ liệu và bàn giao

- Đã dọn đúng ID/owner các bản ghi của lượt kiểm tra:9Response,1campaign chưa gửi,4danh sách/4Contact,2Filter Template và3Follow-up/lịch sử liên quan. Transaction có23kiểm tra an toàn; sau commit kiểm tra6nhóm fixture đều còn0bản ghi.
- Campaign3, Response3, Follow-up3, list3 và Gmail sender1 có sẵn vẫn còn nguyên. Không gửi email hoặc tạo lịch chiến dịch để gửi tự động.
- FE/BE không bị chỉnh sửa trong lượt audit; source vẫn ở commitc179922. Hai đánh giá độc lập và ảnh đối chiếu là tài liệu cục bộ, chưa commit/push.
- Thứ tự sửa đề xuất: Soạn phản hồi → Kiểm tra/xác nhận Contact → Editor/xác nhận Chiến dịch → Tài khoản gửi/kết quả duyệt của Trưởng phòng → mật độ/cột/trạng thái lỗi. Sau mỗi nhóm cần so lại đúng frame và chạy luồng API đang có.

Questions skipped: lượt này yêu cầu kiểm tra trước; các lựa chọn sửa giao diện và điều chỉnh thiết kế được để lại cho BA duyệt trên danh sách sai khác cụ thể, không tự sửa hoặc thêm nghiệp vụ.
