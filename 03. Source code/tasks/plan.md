# Kế hoạch Google Search/Web — UC2, UC3.1, UC4

Ngày chuẩn bị: 15/11/2026. Trạng thái: đã triển khai và kiểm thử bằng fixture; chưa gọi live SerpAPI do thiếu key. Chi tiết hiện thực và giới hạn: `../BAO_CAO_GOOGLE_SEARCH_2026-11-15.md`.

## Mục tiêu và phạm vi đã chốt

Nhân viên nhập hoặc áp dụng Filter Template → kiểm tra/xác nhận tiêu chí → hệ thống tự tìm website trên toàn web → lấy email công khai và bằng chứng nguồn → chuẩn hóa/loại không hợp lệ/loại trùng → lưu lịch sử và Contact → kiểm tra/xác nhận danh sách gốc → Trưởng phòng duyệt → tạo chiến dịch và lọc người nhận → soạn email.

Chỉ hai role Nhân viên và Trưởng phòng. Chỉ Google Search/Web; Apollo để sau. Không yêu cầu BA cung cấp trước danh sách website. Giữ cấu trúc và phong cách FE hiện tại. Đã chuyển sang triển khai theo yêu cầu BA; không đăng ký/mua dịch vụ hoặc tiêu credit khi chưa có key.

## Nguồn và thứ tự quyết định

1. Quyết định BA trong `GHI_CHU_YEU_CAU.md`, phần “Quyết định BA bổ sung khi chuẩn bị BE”.
2. DOCX gốc `../02. Phân tích và thiết kế hệ thống/tài liệu phân tích và thiết kế hệ thống.docx`: §4.2, §4.3/UC3.1, BR-UC3-01..03, §4.4, UC12. Đã kiểm tra lại ba BR trong DOCX gốc. Cache mục UC3.1 dùng để tra cứu luồng chính/ngoại lệ.
3. BPMN: `GHI_CHU_YEU_CAU.md` phần đọc XML, Sub Process 1/2; chỉ mục frame trong `GHI_CHU_FIGMA_TRUONG.md`.
4. Tài liệu kỹ thuật hiện hành: [nguồn tham khảo](google-search-spec.md#nguồn-kỹ-thuật).

Không dùng dữ liệu minh họa 48/7/3/38 trong Figma làm quy tắc. BA đã chốt duyệt danh sách gốc; không chuyển lại bước duyệt hoặc thêm role theo tài liệu cũ.

## Hiện trạng đã đọc

- `backend/migrations/002_contacts.sql`: contacts duy nhất theo lower(email), contact_lists có criteria và trạng thái kiểm tra/duyệt, contact_list_items nối hai bảng.
- `backend/src/contacts/contacts.controller.ts`: tạo danh sách 1–1000 Contact, trùng trong request bị từ chối; Contact tồn tại dùng lại mà không ghi đè. Chưa có lịch sử lần tìm và bằng chứng nhiều nguồn.
- `backend/src/filter-templates/filter-templates.controller.ts`: criteria gồm role, industry, location, size, email, keyword, source. Có kiểm tra hình dạng và ít nhất một điều kiện; chưa phải xác nhận khả năng hỗ trợ của Google.
- `frontend/src/App.tsx`: live criteria chuyển sang Flow với searchUnavailable; màn khác dùng LiveFlows. `LiveFlows.tsx` có placeholder tìm kiếm/lịch sử, chưa gọi API tìm kiếm.
- `Flow.tsx`: đã có route review, searching, results, search-empty, search-error, history/detail/error, kiểm tra/xác nhận và xuất. Phải giữ các bước khi nối API.
- NestJS, pg, session/role guard, worker và migration SQL đã có. Không cần thêm Redis, microservice hay AI chỉ để tìm email.
- Kiểm tra cấu hình cục bộ: SERPAPI_API_KEY đang thiếu; không đọc/ghi giá trị secret vào tài liệu.

## Phương án triển khai

Dùng SerpAPI như bên cung cấp kết quả Google, không phải Google API chính chủ và không phải dịch vụ xác minh email. BE lấy URL organic_results, đọc trang công khai bằng bộ tải có giới hạn, trích email/bằng chứng và ghi kết quả. API Gmail OAuth hiện có không cấp quyền dùng SerpAPI.

Tạo job trong PostgreSQL, FE poll tiến trình thực. Một worker BE dùng claim/lease để tránh hai tiến trình chạy cùng job; HTTP ra ngoài transaction. Worker hồi phục sau restart có giới hạn, không lặp vô hạn hoặc ghi danh sách hai lần. Hoàn tất dữ liệu bằng transaction riêng. Dùng fetch có sẵn; thư viện HTML parser/chặn IP chỉ thêm nếu cần để xử lý đúng, không dùng regex HTML làm bộ phân tích toàn trang.

## Quyết định BA bổ sung và các điểm còn mở

| Nội dung | Hướng đề xuất cho bản đầu | Cần chốt trước khi bật live |
| --- | --- | --- |
| Chức vụ/ngành/khu vực | BA cho phép dự đoán từ dữ liệu thu thập; hiển thị “Chưa đảm bảo — thông tin suy đoán” và nguồn/cơ sở suy luận | Không gắn nhãn xác nhận trực tiếp; không dùng chính tiêu chí nhập làm bằng chứng |
| Quy mô doanh nghiệp | BA chốt cho phép ước đoán từ số email công khai, ghi “Ước đoán — độ tin cậy thấp”, không dùng lọc cứng | Phương pháp quy đổi phải được xây dựng/kiểm chứng, không coi email count là employee count |
| Kiểm tra email | BA chốt phạm vi kiểm tra cú pháp; hiển thị “Đã xác nhận” kèm giải thích nguồn công khai và cú pháp | Không cần dịch vụ xác minh bên ngoài cho phạm vi này; Catch-all/khả năng nhận thư chưa được xác định |
| Email chung như info@/sales@ | BA chốt không gán chức vụ cá nhân; job_title=null kể cả khi có từ khóa chức vụ trên trang | Không coi hộp thư chung là cá nhân khớp chức vụ |
| Dừng khi một website lỗi | Ghi lỗi từng URL, nhưng không công bố kết quả thiếu như hoàn chỉnh | Đã triển khai: giữ phần đọc được kèm warnings; tất cả URL lỗi hoặc provider/DB lỗi thì job thất bại |
| Chi phí/độ sâu | Đề xuất tối đa 2 query, 2 trang/query, 20 URL tổng, 2 trang liên hệ/domain, 100 Contact mới/job | Điều chỉnh sau một lần đo live; số này không phải yêu cầu SRS |

Cập nhật theo BA sau ngày lập kế hoạch: suy luận được phép nếu tách khỏi thông tin quan sát. Quy tắc này bổ sung BR-UC3-02; trường quan sát thiếu vẫn để trống, giá trị dự đoán lưu riêng cùng provenance.

Mặc định an toàn khi chưa chốt: không bỏ qua bộ lọc không hỗ trợ, không khẳng định Contact thỏa tiêu chí thiếu chứng cứ, không gán verified. Các mục này không ngăn viết migration/adapter/test bằng fixture, nhưng phải giải quyết trước nghiệm thu live.

## Thứ tự và điều kiện nghiệm thu

Theo `tasks/todo.md`: chốt hợp đồng → job + quyền → SerpAPI → đọc website an toàn → chuẩn hóa/lưu → nối FE → duyệt/chiến dịch → nghiệm thu live.

Mốc A: fixtures chạy được qua API/job và không sửa giao diện ngoài luồng tìm kiếm. Mốc B: đủ các trạng thái FE và kiểm tra quyền/rollback/SSRF. Mốc C: cấu hình key, BA chốt tiêu chí/giới hạn, thử có giới hạn credit. Không gọi một lần trả ít email là hệ thống lỗi; không cam kết tìm đủ N email.

Bộ kiểm thử chi tiết tại [google-search-tests.md](google-search-tests.md), hợp đồng tại [google-search-spec.md](google-search-spec.md), chuẩn bị môi trường tại [google-search-setup.md](google-search-setup.md).


## Cập nhật hiện thực

Đã chọn kết quả một phần kèm warnings rõ ràng khi một số URL lỗi, thất bại nếu không đọc được trang nào; đây là lựa chọn triển khai theo quyền Dev để giữ dữ liệu thu được mà không giả hoàn chỉnh. Ngân sách mặc định như README. API/history gộp trong contact_search_jobs và results JSON giới hạn 100, không thêm bảng history/provenance riêng khi chưa cần. requestKey nằm trong body, không header. Các khác biệt so với bản thiết kế ban đầu được ghi ở backend/API.md. Các checkbox còn mở trong todo phản ánh phần chưa kiểm chứng, không phải mọi mục đã hoàn tất.
