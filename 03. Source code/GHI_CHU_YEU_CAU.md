# Ghi chú yêu cầu trước khi phát triển

Ghi chú này tổng hợp tài liệu trong `01. Thu thập yêu cầu` và `02. Phân tích và thiết kế hệ thống`, rồi đối chiếu với BPMN TOBE V5SI. Đây là bản ghi nguồn, chưa phải quyết định triển khai hoặc thay thế tài liệu gốc. Những điểm khác nhau giữa các nguồn được giữ riêng ở cuối file.

## Nguồn đã đọc

- **PV1:** [Biên Bản Phỏng Vấn](<../01. Thu thập yêu cầu/Biên Bản Phỏng Vấn.docx>) và [KỊCH BẢN PHỎNG VẤN 1](<../01. Thu thập yêu cầu/KỊCH BẢN PHỎNG VẤN 1.docx>). Kịch bản chứa câu hỏi; câu trả lời được lấy từ biên bản.
- **PV2:** [Biên bản phỏng vấn lần 2](<../01. Thu thập yêu cầu/Biên bản phỏng vấn lần 2(15_09).docx>) và [Kịch bản phỏng vấn lần 2](<../01. Thu thập yêu cầu/Kịch bản phỏng vấn lần 2.docx>). Kịch bản không được coi là yêu cầu đã chốt nếu biên bản không xác nhận.
- **BS:** [Câu hỏi bổ sung và câu trả lời](<../01. Thu thập yêu cầu/Câu hỏi bổ sung các yêu cầu về nghiệp vụ và hiệu năng hệ thống.xlsx>), sheet `Câu trả lời biểu mẫu 1`, các ô `B2:L2` (dấu thời gian tại `A2`: 01/11/2026).
- **SRS:** [Tài liệu đặc tả yêu cầu và thiết kế hệ thống](<../02. Phân tích và thiết kế hệ thống/tài liệu phân tích và thiết kế hệ thống.docx>), các mục 1–8.
- **DRAW:** [Sơ đồ draw.io](<../02. Phân tích và thiết kế hệ thống/Untitled Diagram.drawio>) có 4 trang, chủ yếu thể hiện các use case tìm kiếm và kiểm tra Contact; các trang có nội dung lặp lại.
- **BPMN:** [BPMN TOBE V5SI](<.context-cache/02. Phân tích và thiết kế hệ thống/BPMN TOBE V5SI.drawio.xml>) có 5 trang: `Process Tổng` và 4 subprocess. Đây là bản XML draw.io được BA chỉ định để đối chiếu luồng; các chi tiết chưa thể hiện trong sơ đồ vẫn phải tra SRS/BS.
- **VIDEO:** [Phỏng vấn lần 1](<../01. Thu thập yêu cầu/Video phỏng vấn lần 1.mp4>) (17 phút 08 giây) và [phỏng vấn lần 2](<../01. Thu thập yêu cầu/Video phỏng vấn lần 2.mov>) (14 phút 58 giây). Đã trích âm thanh toàn bộ để đối chiếu; bản phiên âm tự động tiếng Việt có nhiều đoạn sai/khó nghe nên không dùng làm căn cứ xác nhận chi tiết mới. Các yêu cầu dưới đây dựa vào biên bản và bảng trả lời đã ghi thành văn bản. Chưa kiểm tra toàn bộ hình ảnh từng khung hình của video.

## Bối cảnh và phạm vi

- Dự án là ứng dụng web cho phòng Marketing Công ty V5, phục vụ tìm kiếm dữ liệu doanh nghiệp B2B, quản lý Contact, chiến dịch email, Response và Follow-up (PV1, PV2, SRS §1–3).
- Hiện trạng: Apollo Search đã được dùng để tìm email; chưa gửi hàng loạt trong hệ thống. Nhân viên gửi qua Gmail, kiểm tra các hộp thư riêng và tổng hợp phản hồi vào Excel. Tìm kiếm/lọc trùng, tài khoản Apollo và proxy còn thủ công; chưa có phân quyền rõ ràng (PV1, PV2).
- Người dùng nêu trong tài liệu: Nhân viên Marketing, Trưởng phòng Marketing; phần phạm vi còn ghi Trưởng nhóm và Admin nhưng chưa có ma trận quyền chi tiết (PV1, SRS §1.3 và §3.1).
- Tích hợp được nêu: Apollo Search, Google Search/Web, Gmail/Outlook; xuất sang tệp và có phương án Google Sheet/CRM nếu tích hợp được (SRS §1.3, §4.3–4.4). Chưa có dịch vụ, tài khoản thử nghiệm hoặc giao thức tích hợp cụ thể.
- Phần ngoài phạm vi của SRS: A/B testing mẫu email, tự động chuyển Response khi nhân viên nghỉ, và nghiệp vụ ngoài phòng Marketing (SRS §1.3.5; PV2).

## Luồng nghiệp vụ từ tài liệu yêu cầu

1. Nhân viên thiết lập tiêu chí thủ công hoặc từ Filter Template, rồi tìm Contact qua Apollo hoặc Google (SRS UC2–UC3; DRAW).
2. Hệ thống chuẩn hóa dữ liệu nguồn, loại email thiếu/sai/không sử dụng được và trùng, lưu Contact mới cùng lịch sử tìm kiếm; nhân viên kiểm tra và xác nhận danh sách Contact (SRS UC3–UC4).
3. Nhân viên tạo chiến dịch từ danh sách đã xác nhận. Hệ thống lọc người nhận và gửi Trưởng phòng duyệt. Nếu không đạt, Trưởng phòng trả về cùng lý do; chỉ sau khi duyệt mới chuẩn bị nội dung (SRS UC5.1, UC12; BS E2).
4. Nhân viên chọn hoặc soạn email, xem trước, chọn tài khoản gửi, đặt lịch, xem lại và xác nhận. Hệ thống gửi theo lịch, kể cả khi người dùng đã đóng trình duyệt hoặc đăng xuất (PV2, SRS UC5; BS L2).
5. Hệ thống gom Response về hộp thư chung theo chiến dịch, phân công xử lý, ghi lịch sử tương tác và nhắc Follow-up. Việc gửi Follow-up vẫn cần nhân viên kiểm tra và thực hiện; hệ thống chỉ tự tạo lịch/nhắc việc (PV2, SRS UC7–UC10; BS G2).

## Quy tắc và dữ liệu đã ghi nhận

### Contact và chiến dịch

- Một bộ tiêu chí tìm kiếm cần ít nhất một điều kiện hợp lệ. Lịch sử phải ghi người thực hiện, thời điểm, nguồn, tiêu chí và số lượng Contact tiếp nhận, không hợp lệ, trùng, mới (SRS BR-UC2, BR-UC3).
- Danh sách Contact được nhân viên đánh giá `Đạt yêu cầu` hoặc `Chưa đạt yêu cầu`; chỉ danh sách đạt mới có thể chuyển thành `Đã xác nhận` để chọn vào chiến dịch (SRS UC4).
- Quy trình tạo chiến dịch có 5 bước nghiệp vụ: chọn danh sách khách hàng, chọn/soạn mẫu email, chọn tài khoản gửi, đặt lịch, xem lại và xác nhận (PV2; SRS UC5 tách thêm bước duyệt danh sách và xem trước).
- Một chiến dịch cần ít nhất một Contact hợp lệ; email trùng giữa các danh sách chỉ giữ một lần, Contact đã từ chối nhận email bị loại. Tên chiến dịch tối đa 100 ký tự và không trùng chiến dịch chưa kết thúc (SRS UC5.1).
- BS `B2`: nhận unsubscribe qua cả liên kết trong email và nội dung phản hồi; chặn Contact đó khỏi **mọi** chiến dịch về sau. SRS UC5.2 yêu cầu liên kết unsubscribe cố định trong email; mô hình dữ liệu có `Contact.daTuChoi` và `LichSuTuChoiEmail`.
- BS `C2`: cùng một Contact phải cách ít nhất **7 ngày** giữa hai lần gửi, tính chung mọi tài khoản và chiến dịch. Quy tắc này chưa thấy trong BR/UC gửi của SRS.
- Chỉ chiến dịch chưa gửi email nào mới được xóa hoàn toàn. Chiến dịch đã gửi một phần/hoàn thành cần giữ lịch sử để tra cứu; SRS UC6.3 cấm xóa chiến dịch đã gửi và UC6.2/6.4 cho tạm dừng, tiếp tục chỉ với người nhận `Chưa gửi` (BS `I2`; SRS UC6).

### Nội dung, tài khoản và lịch gửi

- Nội dung lấy từ mẫu là bản sao, không sửa mẫu gốc. Tiêu đề email tối đa 150 ký tự; biến cá nhân hóa phải thuộc danh sách hỗ trợ. SRS nêu logo PNG/JPG/SVG tối đa 2 MB, tối đa 3 PDF đính kèm, mỗi tệp tối đa 10 MB; phải xem trước sau lần sửa cuối (SRS UC5.2–5.2.1).
- Mỗi chiến dịch dùng một tài khoản gửi hoạt động do Trưởng phòng cấu hình. Khi tài khoản bị khóa/hạn chế, dừng chiến dịch và báo người phụ trách; không tự chuyển sang tài khoản khác (PV2, SRS UC5.3, UC11, UC13).
- BS `D2`: đề xuất hạn mức ban đầu **100 email/3 ngày cho từng tài khoản**, cảnh báo tại **80%**, cho Trưởng phòng cấu hình riêng; không đặt một giới hạn theo giờ cứng chung cho mọi tài khoản.
- SRS UC5.3–5.5 lại tính hạn mức theo **ngày**, không cho chọn tài khoản đã dùng từ 80% giới hạn ngày, giữ chỗ hạn mức khi xác nhận; UC11 và bảng `TaiKhoanGui` còn yêu cầu giới hạn theo giờ lớn hơn 0. Đây là điểm cần thống nhất trước khi xây bộ lập lịch.
- SRS UC5.4 nêu giờ GMT+7, hẹn trước ít nhất 15 phút và tối đa 90 ngày; mặc định 50 email/giờ trong khung 08:00–17:00; phần chưa gửi chuyển sang ngày kế tiếp. Chiến dịch chưa xác nhận không được gửi (SRS UC5.4–5.5).

### Response và Follow-up

- PV2 muốn hộp thư chung có tên chiến dịch; nhãn `Quan tâm`, `Từ chối`, `Cần thêm thông tin`, đồng thời xử lý riêng out-of-office, bounce và unsubscribe. Bounce bị loại khỏi các chiến dịch sau; out-of-office không làm Contact thành không hợp lệ (PV2; BS `H2`).
- BS `F2` tách **loại phản hồi** khỏi **trạng thái xử lý**: `Mới`, `Đang xử lý`, `Đã phản hồi`, `Đã chốt nhu cầu`. Response đã chốt không cho nhân viên sửa thông tin cũ; trao đổi tiếp được ghi như tương tác mới.
- SRS UC7–UC8 giới hạn xem Response theo người phụ trách/quyền; có thể thêm Response ngoại tuyến; chỉ sửa Response `Mới` hoặc `Đang xử lý`; ẩn có điều kiện và không xóa dữ liệu. SRS UC8.2 nêu bộ loại/trạng thái khác PV2 và BS, cần thống nhất.
- BS `G2`: nhắc sau **2 ngày làm việc** chưa có phản hồi; có thể tự tạo lịch Follow-up, đề xuất tối đa **3 lần**, cách nhau **2 ngày làm việc**; hệ thống không tự gửi email Follow-up. SRS UC8–UC10 cho cấu hình thời gian chờ/số lần/khoảng cách, tự tạo lịch tiếp theo và giới hạn một lịch `Chờ thực hiện` cho mỗi Response.
- PV2 yêu cầu thông báo ngay cho người được phân công qua email và trong hệ thống; tự động bàn giao khi nhân viên nghỉ được để giai đoạn sau (PV2 §6.8).

## Phi chức năng, giao diện và thiết kế dữ liệu

- BS `J2`: các thao tác mở danh sách, xem và cập nhật dữ liệu nên phản hồi trong khoảng **3 giây**; tìm Contact, kiểm tra danh sách và xuất dữ liệu có thể lâu hơn nhưng cần trạng thái đang xử lý. BS `L2`: lịch gửi vẫn chạy khi người dùng offline, mục tiêu khôi phục sự cố khoảng **4 giờ làm việc**. SRS §5 mới ghi các yêu cầu hiệu năng và bảo trì ở mức định tính.
- PV2 ưu tiên giao diện gọn: menu `Email Campaign`, tab `Email Campaign` và `Response Email`, mở vào tab Chiến dịch; từ chiến dịch đi thẳng đến Response tương ứng. Các thao tác phụ trong menu ba chấm, xóa có xác nhận, tạm dừng dễ thấy. Dashboard cần lọc tuần/tháng và theo dõi chiến dịch, Response chưa xử lý, tỉ lệ phản hồi (PV2 §6.1–6.3).
- SRS §8 ánh xạ use case với khoảng 81 màn hình và các trạng thái nhập liệu, rỗng, lỗi, kết quả. Các màn hình chính bao phủ đăng nhập, tìm Contact, danh sách Contact, tạo/quản lý chiến dịch, Response, Follow-up và tài khoản gửi. Chưa thấy màn hình hoặc UC riêng cho Dashboard trong SRS.
- SRS §2 đề xuất ứng dụng web theo kiến trúc client–server 3 tầng; chưa chốt framework, dịch vụ chạy nền hoặc hệ quản trị cơ sở dữ liệu. SRS §7 mô tả 36 bảng logic/vật lý, dùng kiểu `NVARCHAR`, `DATETIME2`, `BIT`; các nhóm chính là người dùng/quyền, tiêu chí/lịch sử tìm kiếm, doanh nghiệp/Contact/danh sách, chiến dịch/người nhận/nội dung/lịch gửi/hạn mức, Response, Follow-up và lịch sử từ chối.

## Những điểm cần BA xác nhận trước khi code phần liên quan

1. **BPMN và thứ tự bước:** quy trình duyệt danh sách diễn ra sau khi tạo bản nháp chiến dịch trong SRS, trong khi BS `E2` diễn đạt là kiểm tra danh sách trước khi nhân viên sử dụng để tạo chiến dịch. Cần chốt điểm chuyển trạng thái và người chịu trách nhiệm.
2. **Hạn mức tài khoản:** 100 email/3 ngày có phải hạn mức chính không; có thêm hạn mức ngày/giờ riêng không; 80% chỉ cảnh báo hay đồng thời cấm chọn tài khoản; hạn mức dành cho lịch đã đặt được tính thế nào.
3. **Chặn gửi lại:** quy tắc 7 ngày từ BS `C2` cần đưa vào kiểm tra người nhận/lịch gửi; xác định thời điểm bắt đầu tính và xử lý khi Contact có nhiều địa chỉ email.
4. **Response:** thống nhất các loại phản hồi và trạng thái xử lý giữa PV2, BS `F2` và SRS UC8.2; xác định cách nhận diện unsubscribe từ nội dung trả lời và cách xử lý phản hồi đến sau khi đã chốt.
5. **Follow-up:** xác định 3 lần/2 ngày làm việc là mặc định hay cố định, cách tính ngày làm việc và xử lý out-of-office; một số màn hình SRS minh họa `2/2` lượt.
6. **Phân quyền và Dashboard:** ma trận quyền đầy đủ cho Nhân viên, Trưởng phòng, Trưởng nhóm, Admin; phạm vi dữ liệu giữa nhân viên; Dashboard là phần phải triển khai giai đoạn nào.
7. **Tích hợp và kỹ thuật:** quyền truy cập/API thực tế của Apollo, Google Search, Gmail/Outlook, Google Sheet/CRM/SMS; cơ chế gửi và nhận email, tài khoản thử nghiệm, công nghệ và môi trường triển khai.
8. **Yêu cầu đo được:** 3 giây áp dụng cho bao nhiêu dữ liệu/người dùng đồng thời; 4 giờ làm việc là mục tiêu khôi phục cho loại sự cố nào. BS `K2` chưa cho số quy mô tương lai cụ thể.
9. **Thiết kế dữ liệu:** `LanTimKiem.maBoTieuChi` được đánh dấu `UNIQUE` dù Filter Template/bộ tiêu chí được mô tả là tái sử dụng; `TaiKhoanGui.gioiHanGio` bắt buộc dù BS `D2` không muốn một mức giờ cố định. Cần rà lại ràng buộc trước migration.
10. **Lịch sử tài liệu:** kịch bản phỏng vấn lần 2 ghi lịch ngày 16/09/2026, biên bản ghi buổi diễn ra 15/09/2026; cần xác nhận nếu dùng ngày này trong báo cáo.

## Đối chiếu BPMN TOBE V5SI

Đã đọc đủ 5 trang từ XML draw.io. `Process Tổng` nối tuần tự: bắt đầu chiến dịch Marketing → tìm kiếm/quản lý Contact → tạo/gửi Email Campaign → tiếp nhận/xử lý Response → Follow-up → kết thúc chiến dịch. Đây là luồng khái quát, không mặc định mọi chiến dịch đều phải có Response hoặc Follow-up mới được kết thúc.

| Trang | Luồng chính và vai trò thể hiện | Điểm cần giữ khi triển khai |
| --- | --- | --- |
| `Sub Process 1` | Trưởng phòng bắt đầu đợt tìm Contact, phân công nhân viên; nhân viên xác định đối tượng, dùng Filter Template hoặc nhập tiêu chí, chọn Google/Apollo, nhận và làm sạch dữ liệu, lưu lịch sử/Contact, kiểm tra rồi xác nhận danh sách. Dữ liệu chưa đạt quay lại chọn phương thức tìm kiếm. | Lưu người được phân công, nguồn/tiêu chí/kết quả tìm kiếm và trạng thái xác nhận danh sách; sơ đồ không nêu điều kiện chi tiết để đánh giá dữ liệu đạt. |
| `Sub - Process 2` | Nhân viên tạo chiến dịch, chọn danh sách; hệ thống lọc email trùng và khách đã từ chối. Nếu còn Contact hợp lệ, Trưởng phòng kiểm tra chất lượng danh sách; không đạt thì trả về chọn lại danh sách. Sau đó nhân viên soạn/xem trước email, chọn tài khoản, kiểm tra hạn mức, đặt lịch, xem lại và xác nhận. Có nhánh tạm dừng, tài khoản bị khóa/spam và chuyển dữ liệu tới Response Inbox. | Duyệt danh sách nằm **sau khi tạo chiến dịch và lọc Contact, trước khi soạn email**. Cần lưu lý do trả về nếu theo SRS UC12; BPMN chỉ ghi thông báo không đủ yêu cầu. |
| `Sub Process 3` | Hệ thống nhận/lưu/phân loại Response; nhánh cần xử lý thủ công chuyển cho nhân viên; nhánh còn lại cập nhật trạng thái đã xử lý. Có bước xử lý Response và tạo/lập lịch Follow-up, nhưng một số đoạn nối không ghi rõ đầu/cuối và điều kiện. | Không suy ra bộ loại Response, trạng thái xử lý, quy tắc unsubscribe/bounce/out-of-office hay điều kiện tạo Follow-up chỉ từ sơ đồ. Dùng PV2/BS/SRS và chốt các điểm khác nhau trước khi code. |
| `Sub Process 4` | Nhân viên xem khách hàng/phản hồi, thiết lập lịch và tạo yêu cầu Follow-up; hệ thống kiểm tra, lưu, đến hạn thì nhắc; nhân viên thực hiện. Có nhánh ghi nhận phản hồi, hết thời gian chờ, lập lịch tiếp và báo cáo hiệu suất cho Trưởng phòng. | Người **thực hiện Follow-up là nhân viên**, hệ thống nhắc việc. Điều kiện hết thời gian chờ, số lần tiếp và thời điểm lập lịch chưa có giá trị cụ thể trong sơ đồ. |

### Khác biệt hoặc chỗ chưa rõ sau khi đọc BPMN

1. **Duyệt danh sách:** BPMN củng cố luồng tạo bản nháp trước khi Trưởng phòng duyệt; BS `E2` diễn đạt kiểm tra danh sách trước khi dùng để tạo chiến dịch. Cần chốt trạng thái bản nháp, phạm vi phê duyệt (danh sách gốc hay danh sách người nhận đã lọc) và nội dung lý do từ chối.
2. **Hạn mức gửi:** BPMN có nhánh `Gần đạt ngưỡng giới hạn gửi?` → cảnh báo **và yêu cầu chọn tài khoản khác**. BS `D2` nêu cảnh báo ở 80%, còn SRS có quy tắc cấm chọn từ 80% hạn mức ngày. Cần chốt ngưỡng, đơn vị thời gian và cảnh báo có chặn gửi hay không.
3. **Thay tài khoản giữa chiến dịch:** Khi tài khoản bị khóa/spam, BPMN tạm dừng, báo Nhân viên và Trưởng phòng; Trưởng phòng có thể chọn tài khoản dự phòng hoặc thêm tài khoản mới rồi gửi tiếp. PV2/SRS nêu một tài khoản gửi cho mỗi chiến dịch và không tự chuyển tài khoản. Sơ đồ cho thấy **thao tác có quyết định của Trưởng phòng**, nhưng cần chốt có cho thay tài khoản sau khi gửi một phần và cách giữ lịch sử từng email.
4. **Tạo lịch Follow-up:** BPMN 3–4 diễn đạt cả bước tạo/lập lịch sau Response lẫn nhân viên thiết lập lịch/yêu cầu. BS `G2` cho hệ thống tự tạo lịch và nhắc, nhân viên tự thực hiện. Cần chốt ai tạo lịch đầu tiên, ai tạo lịch kế tiếp và quyền sửa lịch.
5. **Các nhánh còn thiếu thông số:** BPMN không định nghĩa quy tắc chặn gửi lại 7 ngày, hạn mức 100 email/3 ngày, thời gian Follow-up 2 ngày làm việc/tối đa 3 lần, định nghĩa loại/trạng thái Response, hoặc điều kiện kết thúc chiến dịch. Không coi việc thiếu trong BPMN là hủy bỏ các yêu cầu đã ghi ở BS/SRS.
6. **Báo cáo hiệu suất:** `Sub Process 4` có bước lập báo cáo và Trưởng phòng đánh giá, nhưng chưa có nội dung/chỉ số, chu kỳ hay màn hình tương ứng. Cần xác định phạm vi trước khi triển khai.

Chưa tạo source code hoặc chốt quy tắc nghiệp vụ chỉ dựa trên BPMN. Những mục cần BA xác nhận ở phần trên vẫn còn hiệu lực, trừ khi đã được nêu rõ trong phần đối chiếu này.
