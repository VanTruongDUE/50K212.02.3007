> Cập nhật 15/11/2026, sau kích hoạt SerpAPI: đã chạy live thành công job 47. Phần “chưa live/thiếu key” bên dưới là trạng thái ở giai đoạn kiểm thử fixture trước đó; xem kết quả cập nhật cuối báo cáo.

# Báo cáo triển khai Google Search/Web — 15/11/2026

## Kết quả hiện tại

Đã nối pipeline BE/PostgreSQL và các màn FE live cho hai role theo phạm vi Google Search. Nhánh làm việc `feat/google-contact-search`; chưa commit/push. Chưa có SERPAPI_API_KEY nên không tuyên bố đã tìm được email thật từ Google.

## Phần đã triển khai

- Migration 021: contact_search_jobs và metadata nguồn trong contacts. Job giữ tiêu chí snapshot, đếm kết quả, trạng thái, lỗi/cảnh báo, ID provider và danh sách liên quan.
- API tạo/đọc job, capabilities, lịch sử phân trang; session/role và owner boundary. Idempotency requestKey, khóa theo owner, lease và tối đa 2 lần claim khi process gián đoạn.
- Adapter Google SerpAPI: truy vấn theo tiêu chí, phân trang hữu hạn, đọc response giới hạn, phân biệt lỗi/rỗng, không lộ key. Kiểm tra malformed JSON shape.
- Bộ tải HTML: DNS/IP public và ghim địa chỉ kết nối, kiểm tra từng redirect, robots.txt, timeout/body, không gửi token/cookie sang website. Đã sửa tương thích Node lookup(all) sau phép thử mạng thật.
- Trích email công khai/mailto, gồm URL-encoded và uppercase MAILTO; giữ evidence gần email. Không lấy script/comment hoặc dùng tiêu chí đầu vào làm bằng chứng. Email chung không gán chức vụ cá nhân; không lấy chức vụ của đoạn văn Contact khác.
- Chuẩn hóa cú pháp → invalid → duplicate trong job/toàn hệ thống → new. Không ghi đè Contact cũ; tạo danh sách chưa kiểm tra/chưa duyệt. Lỗi ghi cuối rollback Contact/list cùng job result.
- FE criteria/review/searching/results/empty/error/history/detail/all-contacts với dữ liệu API, giữ draft/ID và mã chống lặp khi reload. Sửa legacy route mapper từng chặn review/results/history-detail; giữ listId để mở đúng danh sách kiểm tra.
- Hiển thị email “Đã xác nhận” kèm phạm vi nguồn công khai + cú pháp. Các thuộc tính suy luận luôn “Chưa đảm bảo”. Proxy quy mô phiên bản public-email-count-proxy-v1 chỉ chia khoảng theo số email công khai trong lần tìm, không được hiệu chuẩn theo headcount; không lọc cứng. Không có số đếm hợp lệ thì không dự đoán.
- Metadata còn hiển thị ở các màn danh sách/kiểm tra/Trưởng phòng. File xuất của danh sách nguồn tìm kiếm có thêm nguồn và ghi chú mức xác nhận, tránh mất cảnh báo khi rời giao diện.

## Kiểm chứng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Backend Jest | 12 suites, 174 test đạt |
| HTTP e2e | 3 test đạt |
| Backend build và ESLint các file search/contacts | Đạt |
| Frontend build và lint | Đạt; còn cảnh báo bundle lớn hơn 500 kB |
| Migration trên database tạm mới | Đạt, gồm migration 021 |
| smoke-search trên PostgreSQL | Đạt: role/owner, thiếu key, idempotency/key khác payload, đếm invalid/trùng/mới, nguồn, kết quả rỗng/chỉ trùng, lỗi provider/website, history, kiểm tra và duyệt danh sách |
| Lỗi DB khi ghi kết quả cuối | Contact rollback, job failed |
| Job hết lease đã đạt giới hạn attempts | Chuyển failed, không retry vô hạn |
| Smoke nghiệp vụ BE cũ | Đạt: templates, Contacts/approval, sender, campaign/asset/preview/schedule, IMAP, Response/Follow-up; không gửi mail thật |
| Bộ tải website công khai thật | Đọc https://example.com thành công; đây chỉ là thử network reader, không phải tìm email/SerpAPI |
| Export helper | CSV/JSON/XML giữ nguồn/cảnh báo; XLSX tạo tệp ZIP hợp lệ trong trình duyệt |
| Export UI | Chọn CSV và bấm Xuất CSV → export-success trên danh sách fixture 12 Contact |

## Kiểm tra trình duyệt

Dùng Chrome DevTools mở ứng dụng thật, phiên Nhân viên local và API thật; dữ liệu kết quả là fixture trong DB. Đã thao tác chọn Founder/Đà Nẵng/Google → kiểm tra tiêu chí → review; xác nhận tìm bị khóa khi chưa cấu hình key. Đã mở results → xem toàn bộ 12 Contact → trang sau còn 2 → kiểm tra đúng listId, lưu kiểm tra/xác nhận danh sách, xuất CSV. Đã mở lịch sử → chi tiết đúng job, trạng thái failed và nút tìm lại, trạng thái empty. Lịch sử và kết quả không còn bị legacy mapper đẩy về criteria.

Đã xem ảnh kết quả ở các độ rộng desktop 1440/1366/1280, kiểm tra DOM không cuộn ngang toàn trang. Browser đang zoom 80% nên đã bù viewport emulation và kiểm tra innerWidth thay vì chỉ tin kích thước ảnh. Đã thu gọn cảnh báo từng URL trước đó bị CSS chung kéo cao 304px. Giữ sidebar/header/token DarkBlue hiện có; bảng có đường phân cách, wrap nội dung và link nguồn/bằng chứng. Không đánh giá mobile trong lượt này.

Figma Bridge báo pluginConnected=false. Vì vậy không tuyên bố so lại ảnh frame trực tiếp; dùng chỉ mục GHI_CHU_FIGMA_TRUONG và hệ UI đang có. Không thay file Figma.

## Giới hạn và việc còn lại

1. Chưa chạy live SerpAPI, chưa đo credit/độ bao phủ hoặc chất lượng thuộc tính suy luận. Cần SERPAPI_API_KEY cục bộ, restart BE rồi thử bộ tiêu chí thực tế có ngân sách nhỏ. Không gửi key qua chat.
2. Proxy quy mô chưa được kiểm chứng với số nhân viên thật, có thể sai đáng kể; luôn cảnh báo và không dùng lọc cứng. Ngành/chức vụ/khu vực mới nhận diện từ văn bản gần email theo từ vựng hỗ trợ, không phải mô hình AI; không bảo đảm mọi bộ tiêu chí có kết quả.
3. Website lỗi một phần: kết quả có warnings rõ ràng, không quảng bá là đầy đủ. Nếu toàn bộ URL lỗi, provider lỗi hoặc ghi DB lỗi: job failed, không tạo Contact mới. Không hỗ trợ PDF/OCR, JS-only, CAPTCHA/login, catch-all hoặc kiểm tra khả năng nhận thư. Website ép nén dù đã request identity bị từ chối an toàn.
4. Không có test mọi dạng website/DNS trên mạng thật. Unit tests kiểm tra địa chỉ nội bộ, DNS mixed và lookup pinning; chưa làm kiểm thử xâm nhập độc lập.
5. Metadata của nhiều nguồn hiện lưu nguồn chính/evidence cho Contact mới, không xây kho HTML hoặc enrichment AI. History dùng job/result JSON giới hạn 100, thay vì các bảng riêng trong bản kế hoạch ban đầu.
6. Chưa so toàn bộ frame Figma hoặc thao tác lại mọi màn ngoài phạm vi tìm kiếm. Các ca đang mở trong tasks/todo.md không được coi là đã đạt.

Dữ liệu UI fixture (3 job, 1 list, 12 Contact) và phiên cookie tạm đã dọn sau kiểm tra. Các bài smoke tự dọn dữ liệu tạo bởi chúng. Không Ẩn Contact/lịch sử người dùng, không khôi phục suppression của Gmail kiểm thử cũ.

## Cách chạy tiếp

Điền SERPAPI_API_KEY trong .env BE → migrate/build/restart → mở http://127.0.0.1:5173 → Nhân viên → Thiết lập tiêu chí → chọn Google → kiểm tra/xác nhận. Theo dõi job thực và cảnh báo nguồn. Nhân viên đánh giá/xác nhận list rồi Trưởng phòng duyệt như luồng cũ. Chạy hồi quy tìm kiếm bằng `npm --prefix backend run test:search:local` không tiêu credit.

## Cập nhật đăng ký và chạy live — 15:35, 15/11/2026 (GMT+7)

- Đã đăng ký tài khoản SerpAPI bằng Gmail dự án và xác nhận email qua Brave/agent-desktop. BA tự hoàn tất xác minh điện thoại; Dashboard đã hoạt động, Account API xác nhận Free Plan.
- Đã lấy API key từ trang quản lý và ghi riêng trong .env cục bộ. Không in key, không đưa vào .env.example hoặc Git. BE đã restart và capabilities.configured=true.
- Các lượt đầu phát hiện hai khác biệt live: thời gian phản hồi vượt 20 giây; trang kết quả hết có metadata Success nhưng error “Google hasn't returned any results for this query.” Đã tăng timeout upstream 40 giây và chỉ xử lý đúng thông điệp hết kết quả này như trang rỗng; lỗi provider khác vẫn thất bại.
- Organic link trả google.com/goto opaque. Khi có displayed_link chứa origin HTTP(S) rõ ràng, adapter dùng origin website để tìm trang chủ/liên hệ, không đoán path rút gọn hoặc đọc Google bất chấp robots. Đã có test hồi quy cho cả hai trường hợp.
- Job 47: keyword “công ty phần mềm Đà Nẵng email liên hệ”; succeeded, processed=20, received=5, invalid=0, duplicate=3, new_count=2. Danh sách 121 có 2 Contact và vẫn pending ở bước Nhân viên kiểm tra/Trưởng phòng duyệt. Không tự gửi email tới các Contact tìm được.
- Nguồn email thực lưu là bqlkktcn.hue.gov.vn và aptech.vn. Kết quả Google theo từ khóa không bảo đảm doanh nghiệp/chức vụ/khu vực khớp tuyệt đối; phải rà soát ở bước kiểm tra, không coi nguồn Huế là xác nhận khu vực Đà Nẵng. Chỉ nhãn email source_and_syntax đã được kiểm tra.
- Cảnh báo URL không đọc được: doanhnghiep.dalat-info.gov.vn, doanhnghiep.danang.gov.vn, facebook.com. Kết quả vẫn thông báo chưa đầy đủ, không giả tất cả website đọc thành công.
- Account API sau kiểm tra còn 244 lượt, Free Plan. Các truy vấn lặp cache được tái sử dụng; không mua gói hoặc nhập thông tin thanh toán. Số credit là ảnh chụp tại thời điểm kiểm tra, không phải hạn mức cố định của mọi tài khoản.
- 12 suites / 176 unit test đạt, backend build và lint phần adapter đạt; smoke-search PostgreSQL chạy lại đạt sau khi job live kết thúc. Job thử thất bại trước đó vẫn được giữ trong lịch sử, không Ẩn để che lỗi.
- Thay đổi mã nguồn của đợt này vẫn chưa commit/push. Vẫn chưa đối chiếu trực tiếp Figma Bridge và chưa nghiệm thu nhiều bộ tiêu chí ngoài lượt live này.
