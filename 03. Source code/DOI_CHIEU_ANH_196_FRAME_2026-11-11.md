# Đối chiếu ảnh 196 frame Figma và FE nhân viên

Ngày kiểm tra: 11/11/2026. Figma: trang **Trường** (75 frame) và **Đức + Huy** (121 frame). Không sửa Figma. Phạm vi là giao diện FE và trạng thái demo; chưa kiểm thử BE/API.

Trang Trường có cả các frame đăng nhập/trang chính của Trưởng phòng (#67–69). Chúng vẫn được tính để đủ 75 frame theo yêu cầu đối chiếu ảnh; kết quả này không mở rộng phạm vi hoàn thiện role Trưởng phòng.

## Kiểm tra lại 31 ảnh từng tràn chiều cao và luồng FE

Ngày 11/11/2026, mở lại đúng **31 frame từng có ảnh FE cao hơn frame Figma** ở viewport 1440 px và chiều cao bằng frame; chụp lại ảnh FE, đo `scrollHeight`/`scrollWidth` sau khi trang tải ổn định và so với ảnh Figma. Các trạng thái phụ thuộc thao tác được mở đúng cách: xóa Chiến dịch ở #49, mở “Thư cảm ơn đối tác 2026” ở #115, chọn tài khoản ở #89–90 và chuyển sang xem điện thoại ở #84. Kết quả **31/31 không còn cuộn dọc hoặc ngang ở kích thước frame tương ứng**. Lượt mở rộng **196/196 frame** cũng không gặp lỗi render, JavaScript hoặc cuộn toàn trang ở kích thước frame tương ứng.

| Nhóm frame từng tràn | Frame đã đo lại | Kết quả |
| --- | --- | --- |
| Trường | #15 | Vừa frame 1024 px |
| Response và Follow-up | #4, #8, #21, #22, #33 | Vừa frame 1024 px; lỗi form hiện tại trường và dưới form, tự hết khi sửa giá trị |
| Danh sách Chiến dịch | #40–53, #63, #121 | Vừa chiều cao từng frame, gồm trạng thái xóa thành công #49 |
| Trình soạn email | #54, #112 | Vừa frame 1316 px; bỏ thanh bước không có ở hai frame này |
| Chờ duyệt và xem trước | #71, #84 | Vừa frame 1024 px; #84 đã chuyển sang bản xem điện thoại |
| Chọn tài khoản gửi | #88, #90, #94 | Vừa frame 1024 px; thông tin người gửi chỉ xuất hiện sau khi chọn tài khoản đủ điều kiện |
| Lịch gửi và xác nhận | #98, #115 | Vừa frame 1054/1066 px; #115 dùng đúng dữ liệu chiến dịch “Thư cảm ơn đối tác 2026” |

Sai khác màu ảnh trung bình trên **31 cặp** giảm từ **9,90 xuống 8,04 MAE** khi chụp lại trạng thái tương ứng. Đây là chỉ số tham khảo để ưu tiên rà soát; một số frame danh sách vẫn khác dữ liệu hoặc vi chi tiết so với Figma, nên không diễn giải 31/31 là khớp từng pixel. Ảnh mới `current31-*.png` và mã kiểm tra `compare31.py`, `smoke196.py`, `full_flow_audit.py` nằm trong thư mục tạm nêu bên dưới.

Đã chạy thao tác liên tục: đăng nhập, chọn/kiểm tra tiêu chí, tìm kiếm, xác nhận và xuất Contact; tạo Template, xem lịch sử và danh sách; tạo Chiến dịch, chọn mẫu/soạn/xem trước email, chọn tài khoản đủ/không đủ điều kiện, lập lịch, xác nhận, tạm dừng và tiếp tục gửi; tạo/sửa/Email/SMS/cập nhật trạng thái/lịch sử/**Xóa Response**; tạo, ghi chú, xóa và chặn xóa Follow-up. Các nhánh này không phát sinh lỗi JavaScript. BA đã chốt nhãn **“Xóa Response”** trong Figma, còn hành vi FE là **ẩn bản ghi khỏi danh sách**, giữ dữ liệu gốc.

Giới hạn: frame Figma cao 1316–1478 px vẫn cần cuộn trên màn desktop có vùng hiển thị thấp hơn chính frame đó; lần đo này chứng minh FE không cao **hơn** frame, không chứng minh mọi màn đều nằm gọn trong viewport 1024 px. Các trạng thái máy chủ/lỗi mạng vẫn là mô phỏng FE và không có API.

## Cách kiểm tra

- Đọc danh sách frame trực tiếp từ Figma UI MCP: `Trường` có 75, `Đức + Huy` có 121. Xuất ảnh từng frame ở tỷ lệ 35% để đo cùng một nguồn.
- Chạy FE bằng Chromium, đặt viewport rộng 1440 px và cao đúng bằng từng frame Figma; chụp 196 ảnh. Với các hộp thoại, trang 2–5, radio, hover/focus và trạng thái sau thao tác, thực hiện hành động tương ứng trước khi chụp. Một số trạng thái chỉ mở được qua route demo `?screen=`.
- Đưa hai ảnh về cùng kích thước, làm mờ 3 × 3 px để giảm nhiễu răng cưa chữ rồi tính sai khác màu trung bình (`MAE`, thang 0–255) và tỷ lệ pixel lệch hơn 22 đơn vị (`Δ%`). Số đo giúp **xếp thứ tự rà soát**, không chứng minh đúng nghiệp vụ, nội dung hoặc đạt chuẩn pixel-perfect. Ảnh Figma xuất ở 35% và cách render font khác trình duyệt cũng góp phần vào sai số.
- Ngưỡng trong bảng: `nhẹ` MAE ≤ 5; `cần rà` 5–10; `lệch rõ` > 10. Đây là ngưỡng phân loại ảnh, **không phải đánh giá frame đã đạt**. Kết luận thực tế dựa thêm vào việc xem ảnh các nhóm có sai khác cao và kiểm tra luồng.
- Dữ liệu và ảnh chụp nằm trong thư mục tạm `C:\Users\PREDATOR\AppData\Local\Temp\v5si-figma-audit-2026-11-11` (`manifest.json`, `metrics.csv`, `figma-*.png`, `fe-*.png`, `sheet-*.jpg`). Thư mục tạm có thể bị hệ điều hành dọn; bảng kết quả dưới đây được lưu trong repo.

## Kết luận kiểm tra ban đầu

**Trước lượt sửa này, FE nhân viên chưa đạt mức khớp toàn bộ Figma.** Đã có ảnh FE cho 196/196 frame và không thấy cuộn ngang trong 121 trạng thái Đức + Huy được chụp; tuy vậy, 47 frame có MAE > 10 (1 ở Trường, 46 ở Đức + Huy). Đây là dấu hiệu ưu tiên kiểm tra, không phải số lỗi được xác nhận. 31 ảnh FE dài hơn chiều cao frame Figma, cần rà liệu chỉ là trang có cuộn hay nội dung sai kích thước.

### Các chênh lệch đã xác nhận trước lượt sửa bằng ảnh/luồng

1. **Chiến dịch, chọn Contact — #68–70:** Figma hiển thị kết quả lọc và các cảnh báo ngay trong bước chọn danh sách; FE chuyển sang trang kết quả riêng. Hành trình và bố cục khác thiết kế.
2. **Chiến dịch, xác nhận và tiếp tục gửi — #57–63, #101–111, #118–121:** thẻ tóm tắt, số liệu, trạng thái, nút hành động và nội dung hộp xem email chưa khớp. Hộp email #58, #102, #118 lệch nhiều nhất (MAE khoảng 22–24); các thông báo lỗi/hạn mức chưa ở đúng vị trí và mức nhấn thị giác.
3. **Chiến dịch, danh sách và hộp thoại — #40–53, #116–117:** hộp tạm dừng/xóa/sửa và thông báo thành công/thất bại còn dùng cấu trúc hoặc chữ khác Figma; cảnh báo “Không thể xóa” có màu/trạng thái khác; dữ liệu các hàng và hành động khác frame.
4. **Response — #23, #27:** Figma dùng tên “Xóa”, FE hiện là “Ẩn Response”. Đây là mâu thuẫn giữa tên frame và đặc tả UC7.4; không đổi nghiệp vụ chỉ để khớp nhãn. Các hộp thoại vẫn cần đồng bộ sau khi BA chốt tên hành động.
5. **Follow-up — #34–35:** hộp xác nhận xóa và lỗi xóa có nội dung, kích thước và bố cục khác frame.
6. **Email — #84, #86:** chế độ xem điện thoại còn khác tỷ lệ/khung nội dung; cảnh báo biến lỗi chưa giống Figma.
7. **Trường — #52:** đây là frame tổng hợp nhiều trạng thái tương tác trong một khung 1440 × 1160, không phải một màn đơn có route FE tương ứng. Ảnh FE được chụp trên màn Thiết lập tiêu chí để so tham chiếu, nên MAE 13,18 **không được coi là lỗi của một màn cụ thể**. Trạng thái hover/focus/loading/disabled phải kiểm tra từng thành phần tương ứng.
8. **Trường — #71–75:** phân trang Contact đã thao tác được, nhưng cỡ chữ, khoảng cách và đường kẻ bảng khác ảnh Figma. Đường phân cách được BA yêu cầu trong các lượt trước, nên cần giữ quyết định này khi cân chỉnh.

### Giới hạn của lượt này

- 196 cặp đều được chụp và tính sai khác; đã xem trực quan các cặp lệch lớn và các trạng thái tiêu biểu, **chưa có kiểm định bằng mắt từng pixel của mọi cặp**. Bảng dưới là bằng chứng đo cho từng frame, không phải 196 dấu “đạt”.
- Lỗi mạng, gửi và quyền hiện được FE mô phỏng bằng dữ liệu/route demo; ảnh không chứng minh quy trình thật sẽ phát sinh trạng thái đúng lúc khi nối BE.
- Tên và dữ liệu mẫu Figma có mâu thuẫn ở một số frame. Quyết định trước của BA được giữ: RSP-031 “Mới” ở danh sách và lịch sử “Đã phản hồi” ở màn riêng; hai mẫu email chưa có nội dung trong Figma mở trình soạn thảo trống.

## Kết quả sau khi sửa FE

Đối chiếu lại ngày 11/11/2026 với 46 frame màn hình Đức + Huy từng có MAE > 10. Mỗi trạng thái được mở bằng route demo hoặc thao tác tương ứng; Chromium được đặt rộng 1440 px, cao bằng frame Figma. Ảnh Figma là bản xuất trước khi bridge ngắt kết nối. Ảnh FE mới và verified-metrics.csv nằm trong cùng thư mục tạm đã ghi ở phần Cách kiểm tra.

**46/46 frame màn hình xuống MAE ≤ 10**, cao nhất **9,95**. Đây là kết quả đo ảnh ở tỷ lệ xuất 35%, không phải cam kết khớp từng pixel hay chứng minh toàn bộ nghiệp vụ. Các thay đổi tập trung vào kết quả lọc Contact tại chỗ, màn gửi kiểm tra, nội dung và vị trí thông báo, kích thước hộp thoại, lớp phủ nền, bản xem email trên điện thoại, xác nhận/tiếp tục gửi, cùng trạng thái xóa Response và Follow-up.

| # Đức + Huy | Frame | MAE trước | MAE sau |
| ---: | --- | ---: | ---: |
| 23 | 212:66195 | 14.87 | 2.25 |
| 27 | 213:66599 | 14.47 | 2.35 |
| 34 | 213:67270 | 13.77 | 2.03 |
| 35 | 213:67353 | 14.06 | 2.13 |
| 40 | 327:241792 | 11.52 | 4.46 |
| 41 | 327:242358 | 12.09 | 4.78 |
| 42 | 327:242936 | 10.56 | 8.58 |
| 43 | 327:243452 | 12.34 | 4.66 |
| 44 | 327:244006 | 12.73 | 5.27 |
| 45 | 327:244574 | 10.24 | 5.07 |
| 46 | 327:245090 | 11.36 | 4.15 |
| 47 | 327:245643 | 11.80 | 4.70 |
| 48 | 327:246210 | 10.68 | 8.64 |
| 49 | 327:246726 | 10.66 | 5.42 |
| 50 | 327:247194 | 11.78 | 4.72 |
| 51 | 327:247782 | 12.47 | 4.64 |
| 52 | 327:248338 | 12.42 | 4.43 |
| 53 | 327:248894 | 10.76 | 8.67 |
| 57 | 327:249944 | 14.97 | 8.58 |
| 58 | 327:250110 | 24.27 | 7.65 |
| 59 | 327:250305 | 15.54 | 8.64 |
| 60 | 327:250471 | 16.47 | 8.66 |
| 61 | 327:250645 | 16.60 | 8.66 |
| 62 | 327:250818 | 16.15 | 9.03 |
| 63 | 327:250992 | 11.39 | 8.47 |
| 69 | 327:252240 | 10.32 | 7.16 |
| 70 | 327:252416 | 10.65 | 7.22 |
| 71 | 327:252598 | 10.93 | 4.36 |
| 84 | 327:255996 | 12.26 | 5.61 |
| 86 | 327:256222 | 14.71 | 7.48 |
| 101 | 327:258992 | 11.95 | 8.64 |
| 102 | 327:259215 | 22.60 | 8.43 |
| 103 | 327:259467 | 12.60 | 8.70 |
| 104 | 327:259690 | 13.22 | 7.60 |
| 105 | 327:259956 | 13.27 | 7.66 |
| 106 | 327:260222 | 13.99 | 8.24 |
| 107 | 327:260502 | 11.53 | 9.25 |
| 108 | 327:260727 | 12.85 | 9.95 |
| 110 | 327:261110 | 13.45 | 8.27 |
| 111 | 327:261412 | 14.13 | 8.52 |
| 116 | 327:262437 | 10.43 | 5.93 |
| 117 | 327:263001 | 10.57 | 6.36 |
| 118 | 327:263565 | 24.18 | 7.62 |
| 119 | 327:263762 | 15.52 | 8.61 |
| 120 | 327:263942 | 14.51 | 7.21 |
| 121 | 327:264139 | 11.44 | 8.24 |

Frame Trường #52 (56:9043) là bảng tổng hợp nhiều trạng thái button, input và ô chọn trong một khung, không có route màn hình đơn tương ứng. Vì vậy MAE 13,18 từ phép ghép với trang Thiết lập tiêu chí không phải lỗi của một màn cụ thể và không thể dùng để chấm cùng 46 frame trên. Kiểm tra tương tác trên route criteria: button đổi màu nền khi hover (rgb(45,108,223) → rgb(65,127,232)), focus bàn phím có viền, input focus có shadow, và trạng thái criteria-checking vô hiệu hóa button đang xử lý.

Kiểm tra kỹ thuật sau sửa: npm run build, npm run lint, git diff --check đều đạt; 6 route Chiến dịch chính không cuộn ngang ở viewport 1366 và 1440 px. Không sửa Figma hoặc BE/API. Ảnh đối chiếu lưu trong thư mục tạm có thể bị hệ điều hành xóa; bảng MAE ở đây là bản ghi bền vững trong repo.

## Bảng từng frame

**Cột “Cách chụp”:** `tương tác` là đã thực hiện hành động trên FE trước khi chụp; `route` là mở route/trạng thái demo. `MAE` và `Δ%` chỉ phản ánh ảnh. “—” trong ghi chú có nghĩa là không xác nhận thêm sai khác cụ thể qua rà soát trực quan, không có nghĩa là đã đạt 100%.

| Trang | # | Frame Figma | Tên trạng thái | FE `?screen=` | Cách chụp | MAE | Δ% | Mức ảnh | Ghi chú |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | --- | --- |
| Trường | 1 | `16:20` | Thiết lập tiêu chí & nguồn | `criteria` | route | 4.19 | 6.2% | nhẹ | — |
| Trường | 2 | `16:46` | Filter Template | `templates` | route | 4.00 | 5.9% | nhẹ | — |
| Trường | 3 | `16:64` | Kết quả tìm kiếm | `results` | route | 7.06 | 9.2% | cần rà | — |
| Trường | 4 | `16:88` | Kiểm tra & xác nhận Contact | `check` | route | 6.26 | 8.9% | cần rà | — |
| Trường | 5 | `16:112` | Xuất danh sách Contact | `export` | route | 3.61 | 5.5% | nhẹ | — |
| Trường | 6 | `16:130` | Lịch sử tìm kiếm | `history` | route | 6.37 | 7.8% | cần rà | — |
| Trường | 7 | `16:188` | Thiết lập tiêu chí | `criteria` | route | 4.07 | 6.0% | nhẹ | — |
| Trường | 8 | `16:241` | Filter Template | `templates` | route | 4.00 | 5.9% | nhẹ | — |
| Trường | 9 | `16:271` | Tạo Filter Template | `template-create` | route | 6.32 | 7.4% | cần rà | — |
| Trường | 10 | `16:322` | Cập nhật Filter Template | `template-edit` | route | 6.35 | 7.4% | cần rà | — |
| Trường | 11 | `16:373` | Kiểm tra bộ tiêu chí | `review` | route | 3.87 | 5.0% | nhẹ | — |
| Trường | 12 | `16:403` | Kết quả tìm kiếm | `results` | route | 6.80 | 8.9% | cần rà | — |
| Trường | 13 | `16:436` | Kiểm tra danh sách Contact | `check` | route | 6.33 | 9.5% | cần rà | — |
| Trường | 14 | `16:472` | Xác nhận danh sách Contact | `confirm` | route | 4.27 | 6.8% | nhẹ | — |
| Trường | 15 | `16:496` | Danh sách đã xác nhận | `confirmed` | route | 7.08 | 9.7% | cần rà | — |
| Trường | 16 | `16:529` | Xuất danh sách Contact | `export` | route | 3.61 | 5.5% | nhẹ | — |
| Trường | 17 | `16:560` | Lịch sử tìm kiếm | `history` | route | 2.77 | 4.3% | nhẹ | — |
| Trường | 18 | `16:589` | Chi tiết lần tìm kiếm | `history-detail` | route | 4.47 | 7.0% | nhẹ | — |
| Trường | 19 | `16:626` | Đang tìm kiếm Contact | `searching` | route | 1.61 | 2.7% | nhẹ | — |
| Trường | 20 | `16:645` | Không tìm thấy Contact phù hợp | `search-empty` | route | 2.05 | 3.6% | nhẹ | — |
| Trường | 21 | `16:664` | Tìm kiếm không thành công | `search-error` | route | 2.02 | 3.2% | nhẹ | — |
| Trường | 22 | `16:683` | Điều chỉnh tiêu chí | `criteria-adjust` | route | 4.97 | 6.6% | nhẹ | — |
| Trường | 23 | `16:731` | Không thể truy cập dữ liệu | `data-unavailable` | route | 2.02 | 3.6% | nhẹ | — |
| Trường | 24 | `16:750` | Xuất dữ liệu thành công | `export-success` | route | 1.93 | 3.5% | nhẹ | — |
| Trường | 25 | `16:770` | Chưa có Filter Template | `template-empty` | route | 1.75 | 3.0% | nhẹ | — |
| Trường | 26 | `16:789` | Chưa có lịch sử tìm kiếm | `history-empty` | route | 2.35 | 3.4% | nhẹ | — |
| Trường | 27 | `16:808` | Không thể lưu thay đổi | `save-error` | route | 1.80 | 2.9% | nhẹ | — |
| Trường | 28 | `16:827` | Không thể tải dữ liệu | `load-error` | route | 1.92 | 3.4% | nhẹ | — |
| Trường | 29 | `16:846` | Danh sách chưa đạt yêu cầu | `check-rejected` | route | 2.23 | 4.1% | nhẹ | — |
| Trường | 30 | `16:865` | Xuất dữ liệu không thành công | `export-error` | route | 1.95 | 3.5% | nhẹ | — |
| Trường | 31 | `18:3126` | Xuất CSV | `export` | tương tác | 4.02 | 5.8% | nhẹ | — |
| Trường | 32 | `18:3162` | Xuất XLSX | `export` | tương tác | 4.03 | 5.8% | nhẹ | — |
| Trường | 33 | `18:3198` | Xuất JSON | `export` | tương tác | 4.03 | 5.8% | nhẹ | — |
| Trường | 34 | `18:3234` | Xuất XML | `export` | tương tác | 4.03 | 5.8% | nhẹ | — |
| Trường | 35 | `38:6251` | Tiêu chí đang chọn | `criteria-adjust` | route | 4.84 | 7.1% | nhẹ | — |
| Trường | 36 | `54:7783` | Đang kiểm tra tiêu chí | `criteria-checking` | route | 4.36 | 6.6% | nhẹ | — |
| Trường | 37 | `54:7848` | Từ khóa không hợp lệ | `criteria-invalid` | route | 4.77 | 7.3% | nhẹ | — |
| Trường | 38 | `54:7913` | Đang ghi nhận tiêu chí | `review-recording` | route | 4.11 | 5.6% | nhẹ | — |
| Trường | 39 | `54:7968` | Thiết lập thành công | `review-success` | route | 3.88 | 5.0% | nhẹ | — |
| Trường | 40 | `54:8023` | Ghi nhận tiêu chí thất bại | `review-error` | route | 3.96 | 5.2% | nhẹ | — |
| Trường | 41 | `54:8078` | Tên Template trùng | `template-name-duplicate` | route | 7.16 | 8.4% | cần rà | Thông báo lỗi Template còn lệch vị trí/bố cục |
| Trường | 42 | `54:8138` | Thiếu tên Template | `template-name-missing` | route | 7.14 | 8.4% | cần rà | Thông báo lỗi Template còn lệch vị trí/bố cục |
| Trường | 43 | `54:8198` | Lưu Template thất bại | `template-save-error` | route | 6.47 | 7.7% | cần rà | Thông báo lỗi Template còn lệch vị trí/bố cục |
| Trường | 44 | `54:8258` | Đã tạo Template | `template-created` | route | 4.11 | 5.5% | nhẹ | — |
| Trường | 45 | `54:8313` | Apollo không khả dụng | `apollo-unavailable` | route | 5.26 | 4.5% | cần rà | — |
| Trường | 46 | `54:8343` | Apollo không có kết quả | `apollo-empty` | route | 5.28 | 4.4% | cần rà | — |
| Trường | 47 | `54:8373` | Xác nhận thất bại | `confirm-error` | route | 4.45 | 7.2% | nhẹ | — |
| Trường | 48 | `54:8475` | Lưu đánh giá thất bại | `check-save-error` | route | 6.65 | 9.8% | cần rà | — |
| Trường | 49 | `54:8553` | Lỗi tải lịch sử | `history-load-error` | route | 5.30 | 4.4% | cần rà | — |
| Trường | 50 | `54:8583` | Lỗi tải Template | `template-load-error` | route | 5.28 | 4.4% | cần rà | — |
| Trường | 51 | `54:8613` | Đang xuất CSV | `export-loading` | route | 4.28 | 6.5% | nhẹ | — |
| Trường | 52 | `56:9043` | Trạng thái tương tác | `criteria` | route | 13.18 | 13.8% | lệch rõ | Frame tổng hợp; không có route tương ứng |
| Trường | 53 | `56:9111` | Sửa từ khóa · Focus | `criteria-adjust` | tương tác | 5.21 | 8.3% | cần rà | — |
| Trường | 54 | `56:9526` | Chưa kiểm tra được tiêu chí | `criteria-check-error` | route | 4.46 | 6.5% | nhẹ | — |
| Trường | 55 | `156:31985` | Đăng nhập · Ban đầu | `login` | route | 1.04 | 0.4% | nhẹ | — |
| Trường | 56 | `156:32011` | Đăng nhập · Đã nhập thông tin | `login` | route | 1.05 | 0.5% | nhẹ | — |
| Trường | 57 | `156:32037` | Đăng nhập · Thiếu email và mật khẩu | `login` | route | 1.15 | 0.5% | nhẹ | — |
| Trường | 58 | `156:32063` | Đăng nhập · Thiếu email | `login` | route | 1.09 | 0.5% | nhẹ | — |
| Trường | 59 | `156:32089` | Đăng nhập · Email sai định dạng | `login` | route | 1.13 | 0.6% | nhẹ | — |
| Trường | 60 | `156:32115` | Đăng nhập · Thiếu mật khẩu | `login` | route | 1.12 | 0.5% | nhẹ | — |
| Trường | 61 | `156:32141` | Đăng nhập · Sai email hoặc mật khẩu | `login` | route | 1.20 | 0.6% | nhẹ | — |
| Trường | 62 | `156:32167` | Đăng nhập · Không xác định được quyền | `login` | route | 1.27 | 0.6% | nhẹ | — |
| Trường | 63 | `156:32193` | Đăng nhập · Đang đăng nhập | `login` | route | 1.97 | 1.9% | nhẹ | — |
| Trường | 64 | `156:32219` | Đăng nhập · Focus trường Email | `login` | tương tác | 1.15 | 0.7% | nhẹ | — |
| Trường | 65 | `156:32245` | Đăng nhập · Hover nút Đăng nhập | `login` | tương tác | 1.91 | 1.7% | nhẹ | — |
| Trường | 66 | `156:32271` | Trang chính · Nhân viên Marketing · Đăng nhập thành công | `home` | route | 0.88 | 1.4% | nhẹ | — |
| Trường | 67 | `156:32370` | Trang chính · Trưởng phòng Marketing · Đăng nhập thành công | `home` | route | 0.90 | 1.5% | nhẹ | — |
| Trường | 68 | `156:32406` | Đã nhập thông tin · Trưởng phòng Marketing | `login` | route | 1.07 | 0.5% | nhẹ | — |
| Trường | 69 | `156:32430` | Đang đăng nhập · Trưởng phòng Marketing | `login` | route | 1.98 | 1.9% | nhẹ | — |
| Trường | 70 | `156:32481` | Đăng nhập · Focus nút Đăng nhập | `login` | tương tác | 1.37 | 0.9% | nhẹ | — |
| Trường | 71 | `372:12675` | Toàn bộ Contact · Trang 1 / 5 | `all-contacts` | tương tác | 5.99 | 8.8% | cần rà | Phân trang chạy; chữ/khoảng cách/đường kẻ bảng khác |
| Trường | 72 | `372:13640` | Toàn bộ Contact · Trang 2 / 5 | `all-contacts` | tương tác | 7.25 | 11.3% | cần rà | Phân trang chạy; chữ/khoảng cách/đường kẻ bảng khác |
| Trường | 73 | `372:14009` | Toàn bộ Contact · Trang 3 / 5 | `all-contacts` | tương tác | 8.09 | 12.1% | cần rà | Phân trang chạy; chữ/khoảng cách/đường kẻ bảng khác |
| Trường | 74 | `372:14378` | Toàn bộ Contact · Trang 4 / 5 | `all-contacts` | tương tác | 8.39 | 12.3% | cần rà | Phân trang chạy; chữ/khoảng cách/đường kẻ bảng khác |
| Trường | 75 | `372:14747` | Toàn bộ Contact · Trang 5 / 5 | `all-contacts` | tương tác | 5.72 | 8.9% | cần rà | Phân trang chạy; chữ/khoảng cách/đường kẻ bảng khác |
| Đức + Huy | 1 | `43:6174` | Quản lý Response | `response-list` | route | 4.58 | 6.2% | nhẹ | — |
| Đức + Huy | 2 | `43:6297` | Cập nhật trạng thái | `response-status` | route | 5.78 | 5.9% | cần rà | — |
| Đức + Huy | 3 | `43:6298` | Kết quả Follow-up | `followup-result` | route | 4.43 | 5.7% | nhẹ | — |
| Đức + Huy | 4 | `43:6299` | Tạo lịch Follow-up | `followup-create` | route | 7.78 | 8.4% | cần rà | — |
| Đức + Huy | 5 | `43:6300` | Soạn phản hồi | `response-reply` | route | 3.88 | 4.9% | nhẹ | — |
| Đức + Huy | 6 | `43:6301` | Thêm Response | `response-add` | route | 5.15 | 6.1% | cần rà | — |
| Đức + Huy | 7 | `43:6302` | Quản lý lịch Follow-up | `followup-list` | route | 4.55 | 6.3% | nhẹ | — |
| Đức + Huy | 8 | `43:6303` | Chi tiết Response | `response-detail` | route | 3.61 | 5.0% | nhẹ | — |
| Đức + Huy | 9 | `43:6304` | Ghi chú kết quả | `followup-note` | route | 5.24 | 5.6% | cần rà | — |
| Đức + Huy | 10 | `47:7604` | Lịch sử phản hồi đã gửi | `response-history` | route | 4.39 | 5.5% | nhẹ | — |
| Đức + Huy | 11 | `47:7735` | Lịch sử trạng thái Response | `response-status-history` | route | 4.66 | 5.6% | nhẹ | — |
| Đức + Huy | 12 | `60:6324` | Cập nhật Response | `response-edit` | route | 5.64 | 7.1% | cần rà | — |
| Đức + Huy | 13 | `99:32133` | Quản lý Response · Danh sách trống | `response-empty` | route | 3.35 | 4.8% | nhẹ | — |
| Đức + Huy | 14 | `99:32134` | Quản lý Response · Lỗi tải dữ liệu | `response-load-error` | route | 2.33 | 3.6% | nhẹ | — |
| Đức + Huy | 15 | `99:32135` | Chi tiết Response · Không có quyền truy cập | `response-access-denied` | route | 2.20 | 3.5% | nhẹ | — |
| Đức + Huy | 16 | `99:32136` | Tạo lịch Follow-up · Lịch Follow-up đã tồn tại | `followup-duplicate` | route | 2.52 | 4.0% | nhẹ | — |
| Đức + Huy | 17 | `99:32137` | Tạo lịch Follow-up · Khách hàng từ chối Email | `followup-optout` | route | 2.44 | 3.9% | nhẹ | — |
| Đức + Huy | 18 | `99:32138` | Chuỗi Follow-up · Tạo lịch tiếp theo thất bại | `followup-chain--create-failed` | route | 2.22 | 3.5% | nhẹ | — |
| Đức + Huy | 19 | `99:32139` | Tạo lịch Follow-up · Tạo thành công | `followup-success` | route | 2.65 | 4.1% | nhẹ | — |
| Đức + Huy | 20 | `99:32140` | Kết quả Follow-up · Không có phản hồi | `followup-result` | route | 9.44 | 9.6% | cần rà | — |
| Đức + Huy | 21 | `170:59855` | Tạo lịch Follow-up · Thiếu thông tin bắt buộc | `followup-create--missing-goal` | route | 8.76 | 11.3% | cần rà | — |
| Đức + Huy | 22 | `170:59966` | Tạo lịch Follow-up · Thời gian không hợp lệ | `followup-create--time-error` | route | 8.73 | 11.2% | cần rà | — |
| Đức + Huy | 23 | `212:66195` | Quản lý Response · Không thể xóa | `response-list` | tương tác | 14.87 | 10.9% | lệch rõ | Figma Xóa, FE Ẩn Response; hộp thoại khác |
| Đức + Huy | 24 | `213:66320` | Thêm Response · Thông tin không hợp lệ | `response-add--invalid` | route | 7.68 | 10.5% | cần rà | — |
| Đức + Huy | 25 | `213:66349` | Cập nhật Response · Thông tin không hợp lệ | `response-edit--invalid` | route | 7.91 | 11.2% | cần rà | — |
| Đức + Huy | 26 | `213:66516` | Cập nhật Response · Không thể chỉnh sửa | `response-edit` | route | 7.56 | 9.0% | cần rà | — |
| Đức + Huy | 27 | `213:66599` | Quản lý Response · Xác nhận xóa | `response-list` | tương tác | 14.47 | 11.2% | lệch rõ | Figma Xóa, FE Ẩn Response; hộp thoại khác |
| Đức + Huy | 28 | `213:66682` | Soạn phản hồi · Thông tin không hợp lệ | `response-reply--invalid` | route | 7.10 | 9.9% | cần rà | — |
| Đức + Huy | 29 | `213:66786` | Soạn phản hồi · Gửi phản hồi thất bại | `response-reply--send-error` | route | 7.09 | 9.8% | cần rà | — |
| Đức + Huy | 30 | `213:66890` | Cập nhật trạng thái · Chuyển trạng thái không hợp lệ | `response-status--invalid` | route | 8.05 | 10.0% | cần rà | — |
| Đức + Huy | 31 | `213:66988` | Quản lý lịch Follow-up · Không tìm thấy khách hàng hoặc Response | `followup-list--missing-record` | route | 2.58 | 4.2% | nhẹ | — |
| Đức + Huy | 32 | `213:67071` | Quản lý lịch Follow-up · Lỗi tải thông tin khách hàng | `followup-list--load-error` | route | 2.38 | 3.7% | nhẹ | — |
| Đức + Huy | 33 | `213:67154` | Tạo lịch Follow-up · Thông số không hợp lệ | `followup-create--parameter-error` | route | 9.46 | 11.0% | cần rà | — |
| Đức + Huy | 34 | `213:67270` | Quản lý lịch Follow-up · Xác nhận xóa | `followup-list` | tương tác | 13.77 | 10.6% | lệch rõ | Hộp xóa lịch khác bố cục/nội dung |
| Đức + Huy | 35 | `213:67353` | Quản lý lịch Follow-up · Không thể xóa | `followup-list` | tương tác | 14.06 | 10.7% | lệch rõ | Hộp xóa lịch khác bố cục/nội dung |
| Đức + Huy | 36 | `213:67436` | Kết quả Follow-up · Lưu trạng thái thất bại | `followup-result--save-error` | route | 2.32 | 3.7% | nhẹ | — |
| Đức + Huy | 37 | `213:67519` | Ghi chú kết quả · Lưu ghi chú thất bại | `followup-note--save-error` | route | 8.29 | 9.3% | cần rà | — |
| Đức + Huy | 38 | `327:241209` | Danh sách chiến dịch | `campaign-list--base` | route | 4.54 | 6.8% | nhẹ | — |
| Đức + Huy | 39 | `327:241718` | Danh sách chiến dịch - Chưa có chiến dịch | `campaign-list--empty` | route | 1.87 | 2.9% | nhẹ | — |
| Đức + Huy | 40 | `327:241792` | Thông tin tổng quát | `campaign-list` | tương tác | 11.52 | 7.8% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 41 | `327:242358` | Thông tin tổng quát - Chiến dịch đã tạm dừng | `campaign-list` | tương tác | 12.09 | 9.4% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 42 | `327:242936` | Danh sách chiến dịch - Không tải được thông tin | `campaign-list--detail-error` | route | 10.56 | 16.8% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 43 | `327:243452` | Danh sách chiến dịch - Hộp thoại tạm dừng | `campaign-list` | tương tác | 12.34 | 9.2% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 44 | `327:244006` | Danh sách chiến dịch - Tạm dừng thất bại | `campaign-list--pause-error` | route | 12.73 | 10.6% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 45 | `327:244574` | Danh sách chiến dịch - Tạm dừng thành công | `campaign-list` | tương tác | 10.24 | 13.8% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 46 | `327:245090` | Danh sách chiến dịch - Hộp thoại xóa | `campaign-list` | tương tác | 11.36 | 8.3% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 47 | `327:245643` | Danh sách chiến dịch - Xóa thất bại | `campaign-list--delete-error` | route | 11.80 | 10.2% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 48 | `327:246210` | Danh sách chiến dịch - Không thể xóa | `campaign-list--cannot-delete` | route | 10.68 | 20.0% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 49 | `327:246726` | Danh sách chiến dịch - Xóa thành công | `campaign-list` | tương tác | 10.66 | 13.9% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 50 | `327:247194` | Danh sách chiến dịch - Chọn mục sửa | `campaign-list` | tương tác | 11.78 | 8.1% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 51 | `327:247782` | Danh sách chiến dịch - Sửa thông tin chung | `campaign-list` | tương tác | 12.47 | 11.3% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 52 | `327:248338` | Danh sách chiến dịch - Thông tin chung không hợp lệ | `campaign-list` | tương tác | 12.42 | 11.3% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 53 | `327:248894` | Danh sách chiến dịch - Không được phép sửa | `campaign-list--edit-forbidden` | route | 10.76 | 20.0% | lệch rõ | Hộp thoại/thông báo/bảng chiến dịch khác frame |
| Đức + Huy | 54 | `327:249410` | Chọn/soạn mẫu email - Sửa chiến dịch đã tạm dừng | `campaign-editor` | route | 9.30 | 13.3% | cần rà | Mở trực tiếp còn dùng nội dung mẫu Webinar |
| Đức + Huy | 55 | `327:249622` | Chọn tài khoản gửi - Sửa chiến dịch đã tạm dừng | `campaign-sender` | route | 8.20 | 9.0% | cần rà | — |
| Đức + Huy | 56 | `327:249775` | Thiết lập lịch gửi - Sửa chiến dịch đã tạm dừng | `campaign-schedule` | route | 7.46 | 8.8% | cần rà | — |
| Đức + Huy | 57 | `327:249944` | Tiếp tục gửi - Xem lại trước khi gửi tiếp | `campaign-resume` | route | 14.97 | 13.6% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 58 | `327:250110` | Tiếp tục gửi - Xem nội dung email | `campaign-resume` | tương tác | 24.27 | 16.8% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 59 | `327:250305` | Tiếp tục gửi - Đã xem nội dung | `campaign-resume` | tương tác | 15.54 | 13.7% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 60 | `327:250471` | Tiếp tục gửi - Không đủ hạn mức | `campaign-resume--quota-error` | route | 16.47 | 18.0% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 61 | `327:250645` | Tiếp tục gửi - Thao tác thất bại | `campaign-resume--send-error` | route | 16.60 | 14.5% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 62 | `327:250818` | Xác nhận chiến dịch - Đã gửi một phần | `campaign-resume` | route | 16.15 | 14.2% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 63 | `327:250992` | Danh sách chiến dịch - Tiếp tục gửi thành công | `campaign-list` | tương tác | 11.39 | 15.0% | lệch rõ | Tóm tắt, trạng thái hoặc modal tiếp tục gửi chưa khớp |
| Đức + Huy | 64 | `327:251508` | Chọn danh sách contact | `campaign-contacts` | route | 3.81 | 5.2% | nhẹ | — |
| Đức + Huy | 65 | `327:251653` | Chọn danh sách contact - Đã nhập thông tin | `campaign-contacts` | tương tác | 4.87 | 8.4% | nhẹ | — |
| Đức + Huy | 66 | `327:251810` | Chọn danh sách contact - Thông tin không hợp lệ | `campaign-contacts` | tương tác | 4.98 | 6.5% | nhẹ | — |
| Đức + Huy | 67 | `327:251956` | Chọn danh sách contact - Không có danh sách khả dụng | `campaign-contacts--no-lists` | route | 3.02 | 4.5% | nhẹ | — |
| Đức + Huy | 68 | `327:252065` | Chọn danh sách contact - Kết quả lọc | `campaign-filtered` | route | 9.35 | 14.4% | cần rà | Figma kết quả lọc ngay trong bước chọn; FE trang riêng |
| Đức + Huy | 69 | `327:252240` | Chọn danh sách contact - Không còn contact hợp lệ | `campaign-filtered--zero` | route | 10.32 | 16.5% | lệch rõ | Figma kết quả lọc ngay trong bước chọn; FE trang riêng |
| Đức + Huy | 70 | `327:252416` | Chọn danh sách contact - Lưu thất bại | `campaign-filtered--save-error` | route | 10.65 | 16.2% | lệch rõ | Figma kết quả lọc ngay trong bước chọn; FE trang riêng |
| Đức + Huy | 71 | `327:252598` | Chọn danh sách contact - Đã gửi kiểm tra | `campaign-list` | tương tác | 10.93 | 11.7% | lệch rõ | Trạng thái danh sách/contact còn khác |
| Đức + Huy | 72 | `327:252719` | Chọn danh sách contact - Danh sách bị trả về | `campaign-contacts` | tương tác | 7.58 | 11.4% | cần rà | Trạng thái danh sách/contact còn khác |
| Đức + Huy | 73 | `327:252879` | Danh sách chiến dịch - Chờ kiểm tra danh sách | `campaign-list` | route | 4.64 | 7.0% | nhẹ | — |
| Đức + Huy | 74 | `327:253435` | Danh sách chiến dịch - Danh sách đã duyệt | `campaign-list` | route | 4.54 | 6.7% | nhẹ | — |
| Đức + Huy | 75 | `327:253992` | Chọn/soạn mẫu email - Thư viện mẫu | `campaign-email` | route | 4.24 | 5.8% | nhẹ | — |
| Đức + Huy | 76 | `327:254169` | Chọn/soạn mẫu email - Bố cục trống | `campaign-layouts` | route | 5.06 | 7.0% | cần rà | — |
| Đức + Huy | 77 | `327:254324` | Chọn/soạn mẫu email - Trình soạn thảo | `campaign-editor` | route | 5.57 | 8.0% | cần rà | — |
| Đức + Huy | 78 | `327:254579` | Chọn/soạn mẫu email - Đã xem trước | `campaign-editor` | tương tác | 5.52 | 7.8% | cần rà | — |
| Đức + Huy | 79 | `327:254834` | Chọn/soạn mẫu email - Logo hoặc tệp không hợp lệ | `campaign-editor` | route | 6.55 | 8.6% | cần rà | — |
| Đức + Huy | 80 | `327:255096` | Chọn/soạn mẫu email - Thông tin không hợp lệ | `campaign-editor` | tương tác | 9.28 | 12.9% | cần rà | — |
| Đức + Huy | 81 | `327:255358` | Chọn/soạn mẫu email - Biến lỗi | `campaign-editor--variable-error` | route | 7.02 | 10.0% | cần rà | — |
| Đức + Huy | 82 | `327:255621` | Chọn/soạn mẫu email - Lưu thất bại | `campaign-editor--save-error` | route | 6.80 | 9.3% | cần rà | — |
| Đức + Huy | 83 | `327:255883` | Xem trước email - Chế độ máy tính | `campaign-preview` | route | 5.96 | 8.0% | cần rà | — |
| Đức + Huy | 84 | `327:255996` | Xem trước email - Chế độ điện thoại | `campaign-preview` | tương tác | 12.26 | 11.1% | lệch rõ | Preview điện thoại khác tỷ lệ và khung |
| Đức + Huy | 85 | `327:256109` | Xem trước email - Contact khác | `campaign-preview` | tương tác | 5.85 | 7.8% | cần rà | — |
| Đức + Huy | 86 | `327:256222` | Xem trước email - Biến lỗi | `campaign-preview--variable-error` | route | 14.71 | 13.8% | lệch rõ | Cảnh báo biến lỗi và preview khác |
| Đức + Huy | 87 | `327:256344` | Xem trước email - Thao tác thất bại | `campaign-preview--render-error` | route | 4.74 | 9.3% | nhẹ | — |
| Đức + Huy | 88 | `327:256420` | Chọn tài khoản gửi | `campaign-sender` | route | 6.84 | 7.8% | cần rà | — |
| Đức + Huy | 89 | `327:256587` | Chọn tài khoản gửi - Tài khoản đủ điều kiện | `campaign-sender` | route | 7.86 | 8.7% | cần rà | — |
| Đức + Huy | 90 | `327:256789` | Chọn tài khoản gửi - Tài khoản không đủ điều kiện | `campaign-sender` | route | 8.31 | 14.6% | cần rà | Cảnh báo tài khoản không đủ điều kiện khác |
| Đức + Huy | 91 | `327:256966` | Chọn tài khoản gửi - Hết tài khoản | `campaign-sender--no-accounts` | route | 5.06 | 12.4% | cần rà | — |
| Đức + Huy | 92 | `327:257096` | Chọn tài khoản gửi - Tên người gửi không hợp lệ | `campaign-sender--invalid-name` | route | 7.81 | 9.3% | cần rà | — |
| Đức + Huy | 93 | `327:257298` | Chọn tài khoản gửi - Lưu thất bại | `campaign-sender--save-error` | route | 8.94 | 11.0% | cần rà | — |
| Đức + Huy | 94 | `327:257507` | Chọn tài khoản gửi - Mở từ danh sách | `campaign-sender` | route | 6.80 | 7.8% | cần rà | — |
| Đức + Huy | 95 | `327:257674` | Thiết lập lịch gửi | `campaign-schedule` | route | 4.30 | 5.8% | nhẹ | — |
| Đức + Huy | 96 | `327:257885` | Thiết lập lịch gửi - Lịch dự kiến | `campaign-schedule` | tương tác | 6.40 | 8.0% | cần rà | — |
| Đức + Huy | 97 | `327:258111` | Thiết lập lịch gửi - Gửi ngay | `campaign-schedule` | tương tác | 7.40 | 8.5% | cần rà | — |
| Đức + Huy | 98 | `327:258337` | Thiết lập lịch gửi - Thông tin không hợp lệ | `campaign-schedule` | tương tác | 5.36 | 7.4% | cần rà | — |
| Đức + Huy | 99 | `327:258548` | Thiết lập lịch gửi - Lưu thất bại | `campaign-schedule--save-error` | route | 7.79 | 8.7% | cần rà | — |
| Đức + Huy | 100 | `327:258781` | Thiết lập lịch gửi - Mở từ danh sách | `campaign-schedule` | route | 4.35 | 5.9% | nhẹ | — |
| Đức + Huy | 101 | `327:258992` | Xác nhận chiến dịch - Chưa xem nội dung | `campaign-confirm` | route | 11.95 | 12.7% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 102 | `327:259215` | Xác nhận chiến dịch - Xem nội dung email | `campaign-confirm` | tương tác | 22.60 | 15.9% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 103 | `327:259467` | Xác nhận chiến dịch - Bốn phần hợp lệ | `campaign-confirm` | tương tác | 12.60 | 13.0% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 104 | `327:259690` | Xác nhận chiến dịch - Xác nhận cuối | `campaign-confirm` | tương tác | 13.22 | 11.2% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 105 | `327:259956` | Xác nhận chiến dịch - Xác nhận cuối - gửi ngay | `campaign-confirm` | tương tác | 13.27 | 11.3% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 106 | `327:260222` | Xác nhận chiến dịch - Lưu thất bại | `campaign-confirm--save-error` | route | 13.99 | 14.2% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 107 | `327:260502` | Xác nhận chiến dịch - Cần xử lý | `campaign-confirm--needs-attention` | route | 11.53 | 12.6% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 108 | `327:260727` | Xác nhận chiến dịch - Lịch hoặc tài khoản không còn hợp lệ | `campaign-confirm--invalid-schedule` | route | 12.85 | 13.6% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 109 | `327:260957` | Xác nhận chiến dịch - Không tải được tóm tắt | `campaign-confirm--summary-error` | route | 4.54 | 10.1% | nhẹ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 110 | `327:261110` | Xác nhận chiến dịch - Chọn mục sửa | `campaign-confirm` | tương tác | 13.45 | 11.8% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 111 | `327:261412` | Xác nhận chiến dịch - Sửa thông tin chung | `campaign-confirm--edit-general` | tương tác | 14.13 | 14.5% | lệch rõ | Tóm tắt, trạng thái hoặc modal xác nhận chưa khớp |
| Đức + Huy | 112 | `327:261682` | Chọn/soạn mẫu email - Chế độ sửa | `campaign-editor` | route | 9.17 | 13.1% | cần rà | Mở trực tiếp còn dùng nội dung mẫu Webinar |
| Đức + Huy | 113 | `327:261894` | Chọn tài khoản gửi - Chế độ sửa | `campaign-sender` | route | 8.48 | 8.8% | cần rà | — |
| Đức + Huy | 114 | `327:262047` | Thiết lập lịch gửi - Chế độ sửa | `campaign-schedule` | route | 7.41 | 8.7% | cần rà | — |
| Đức + Huy | 115 | `327:262216` | Xác nhận chiến dịch - Mở từ danh sách | `campaign-confirm` | route | 8.39 | 10.6% | cần rà | — |
| Đức + Huy | 116 | `327:262437` | Danh sách chiến dịch - Xác nhận thành công | `campaign-list` | tương tác | 10.43 | 14.0% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
| Đức + Huy | 117 | `327:263001` | Danh sách chiến dịch - Xác nhận thành công - gửi ngay | `campaign-list` | tương tác | 10.57 | 13.9% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
| Đức + Huy | 118 | `327:263565` | Xác nhận chiến dịch - Đã gửi một phần - Xem nội dung email | `campaign-resume` | tương tác | 24.18 | 16.6% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
| Đức + Huy | 119 | `327:263762` | Xác nhận chiến dịch - Đã gửi một phần - Đã xem nội dung | `campaign-resume` | tương tác | 15.52 | 13.7% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
| Đức + Huy | 120 | `327:263942` | Xác nhận chiến dịch - Đã gửi một phần - Xác nhận cuối | `campaign-resume` | tương tác | 14.51 | 13.6% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
| Đức + Huy | 121 | `327:264139` | Danh sách chiến dịch - Xác nhận thành công - đã gửi một phần | `campaign-list` | tương tác | 11.44 | 15.1% | lệch rõ | Thông báo, dữ liệu hoặc modal gửi một phần chưa khớp |
