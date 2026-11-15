> Cập nhật triển khai: các quyết định/hợp đồng cuối ở `../backend/API.md` và kết quả kiểm chứng ở `../BAO_CAO_GOOGLE_SEARCH_2026-11-15.md`. Phần thiết kế ban đầu bên dưới được giữ để truy vết, không phải tất cả endpoint đã hiện thực đúng tên đề xuất.

# Ma trận nghiệm thu Google Search/Web

Tất cả là ca cần thực hiện khi code, chưa đánh dấu đạt. Fixtures dùng domain example.invalid hoặc máy chủ test cô lập, không gọi web thật mặc định.

| ID | Tình huống | Kết quả bắt buộc |
| --- | --- | --- |
| Q01 | Không đăng nhập/role manager | 401/403, không gọi SerpAPI |
| Q02 | Nhân viên đọc job/history người khác | 404, không lộ tiêu chí/Contact |
| Q03 | Tiêu chí rỗng, whitespace, sai kiểu, ngoài whitelist | 400 đúng field, không tiêu credit, giữ draft |
| Q04 | size/catch-all hoặc xác minh hộp thư chưa hỗ trợ | Báo cụ thể trước tìm, không âm thầm bỏ bộ lọc |
| Q05 | Nhiều lựa chọn, ký tự đặc biệt trong keyword | OR/AND đúng, không query injection/tổ hợp vô hạn |
| P01 | Key thiếu/sai, hết quota, 429/5xx/timeout | Lỗi rõ nguyên nhân/khôi phục, không Contact mới, không lộ key |
| P02 | JSON HTTP 200 chứa error hoặc thiếu shape | Không giả thành kết quả rỗng |
| P03 | organic_results rỗng hợp lệ | History 0, listId=null, không tạo list rỗng |
| P04 | Pagination thiếu next/trùng URL/vượt giới hạn | Dừng đúng ngân sách, không vòng lặp |
| W01 | Email mailto/văn bản/HTML entities/nhiều email | Trích đúng; bỏ ảnh/file/chuỗi không phải email |
| W02 | Snippet có email nhưng website không chứng minh | Không tuyên bố verified/đúng chức vụ |
| W03 | Website thiếu dữ liệu trực tiếp | observed=null; suy luận chức vụ/ngành/khu vực có cơ sở riêng và nhãn “Chưa đảm bảo — thông tin suy đoán”; không điền từ tiêu chí tìm kiếm |
| W06 | Email chung trên trang có tên giám đốc | Không gán chức vụ cá nhân, kể cả trường suy luận |
| W07 | Email đúng cú pháp nhưng hộp thư chưa kiểm tra | syntax_valid, nhãn “Hợp lệ về cú pháp”, deliverability/catch_all=unknown |
| W08 | Website công khai nhiều email | Quy mô suy luận ghi “Ước đoán — độ tin cậy thấp”, có phiên bản phương pháp/cơ sở; không ghi vào employee_count và không dùng để loại Contact theo bộ lọc quy mô |
| W09 | Dữ liệu không đủ để ước đoán quy mô | “Chưa đủ cơ sở ước đoán”; không chế ngưỡng hoặc số nhân viên |
| W04 | Redirect private IP, DNS rebinding, IPv6 nội bộ | Chặn trước kết nối, không đọc metadata/nội mạng |
| W05 | Body lớn/chunked/gzip bomb, timeout, robots, CAPTCHA | Giới hạn thật, dừng có lý do; không báo hoàn tất giả |
| D01 | 6 ứng viên: 2 invalid, 2 duplicate, 2 new | received=6 và 6=2+2+2; invalid xếp trước duplicate |
| D02 | Email khác case/space, nhiều nguồn cùng email | Một Contact mới; +tag/dấu chấm không bị tự sửa |
| D03 | Contact tồn tại thuộc người khác | Không ghi đè/không lộ bản ghi; chỉ đếm trùng |
| D04 | Hai job cùng email đồng thời | UNIQUE bảo vệ; đếm trùng theo kết quả insert thật |
| D05 | Lỗi DB khi lưu history/Contact/list | Rollback toàn bộ dữ liệu kết quả |
| D06 | Request POST lặp cùng key hoặc mất response | Một job, một lần hoàn tất, không tốn thêm call do double-click |
| D07 | Restart BE giữa job, lease hết hạn | Reclaim hữu hạn, không treo/chạy/commit hai lần |
| D08 | Toàn email trùng, hoặc không có email trong URL | History đúng số, không tạo list rỗng |
| F01 | criteria → review → searching → results | Tiêu chí thực, stage thực, khóa gửi lặp; refresh không mất job |
| F02 | search-empty/search-error/history-empty/load-error | Phân biệt rõ; giữ draft; retry có chủ ý |
| F03 | Kết quả/xem toàn bộ/phân trang/lịch sử chi tiết | Cùng id và cùng counts/data, không quay lại dữ liệu demo |
| F04 | Template áp dụng và sửa tiêu chí sau tìm | History snapshot cũ bất biến, lần mới dùng tiêu chí mới |
| F05 | Check → lưu đánh giá → confirm → export | Đúng thứ tự UC4, CSV/XLSX/JSON/XML dùng dữ liệu thật |
| B01 | Chưa được Trưởng phòng duyệt | Không tạo chiến dịch từ list đó |
| B02 | Duyệt/từ chối lý do, lọc người nhận | Giữ nguyên rule hiện có, gồm suppression và chặn gửi lại 7 ngày |
| B03 | Tìm lại email đã ngừng nhận | Không Ẩn suppression/khôi phục quyền nhận |
| U01 | Desktop 1440×1024, 1366×768, 1280×900 | Không cuộn ngang toàn trang, typography/sidebar giữ hệ hiện có |
| U02 | Focus/keyboard, busy/error/success popup | Có thể thao tác bàn phím, lỗi giữ dữ liệu, motion nhẹ/reduced-motion |

## Lệnh và bằng chứng

BE: test tập trung src/search rồi toàn bộ Jest, npm run build, eslint file thay đổi; HTTP e2e và smoke PostgreSQL với adapter/crawler giả lập, không gửi email. Migration kiểm tra database test riêng và chạy lại không nhân bản. FE: npm --prefix frontend run build và lint; dùng agent-desktop trên Brave theo yêu cầu BA, chụp ảnh cùng viewport Figma trước/sau cho các frame liên quan.

Live: chỉ sau khi có key và ngân sách đã chốt. Ghi query/criteria snapshot (không key), provider search id, URL nguồn, giờ, số request và chi phí credit quan sát trên tài khoản. Đối chiếu thủ công bằng chứng email trên website. Không gửi marketing tự động tới Contact vừa tìm; nghiệm thu phần gửi chỉ dùng hộp thư được cho phép. Bộ Gmail hiện có đã thử opt-out nên hộp thư kiểm thử đang bị chặn; không tự Ẩn suppression để vượt thử nghiệm.

Mỗi ca ghi PASS/FAIL/NOT RUN kèm API/status, DB assertion hoặc ảnh. Chỉ đọc code không được ghi PASS; không coi render route là đã kiểm thử thao tác hay đối chiếu ảnh.
