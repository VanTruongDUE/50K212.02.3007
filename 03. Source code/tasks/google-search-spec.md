> Cập nhật triển khai: các quyết định/hợp đồng cuối ở `../backend/API.md` và kết quả kiểm chứng ở `../BAO_CAO_GOOGLE_SEARCH_2026-11-15.md`. Phần thiết kế ban đầu bên dưới được giữ để truy vết, không phải tất cả endpoint đã hiện thực đúng tên đề xuất.

# Đặc tả kỹ thuật dự kiến — Google Search/Web

Tài liệu thiết kế 15/11/2026, các endpoint/bảng dưới đây chưa tồn tại. Nguồn nghiệp vụ và các điểm cần chốt nằm trong [plan.md](plan.md).

## Tiêu chí và truy vấn

Giữ JSON hiện có: `{role:[],industry:[],location:[],keyword:"",size:[],email:[],source:"Google Search/Web"}`. Trim giá trị, giới hạn độ dài như Filter Template, kiểm tra whitelist giá trị thực sự hỗ trợ ở BE. Ít nhất một tiêu chí có giá trị; keyword chỉ khoảng trắng khi được sử dụng phải báo lỗi. Không lấy owner/role từ body. Mọi lỗi kiểm tra phải xảy ra trước khi tiêu credit.

Tạo truy vấn theo nhóm: OR giữa lựa chọn trong nhóm, AND giữa các nhóm. Giới hạn số biến thể, không nhân tổ hợp vô hạn. Từ khóa người dùng là nội dung tìm, không cho chèn toán tử tùy ý để phá truy vấn. Ví dụ mang tính minh họa: `("Giám đốc Marketing" OR "Marketing Director") "phần mềm" "Đà Nẵng" (email OR liên hệ)`; kết quả vẫn cần kiểm tra chứng cứ, không coi trang có từ khóa là bằng chứng chức vụ của mọi email trên trang.

Adapter gọi cố định `https://serpapi.com/search.json` với engine=google, q, hl/gl phù hợp, api_key lấy từ BE. Dùng title/link/snippet/position và search_metadata.id để truy vết. Không phụ thuộc tham số num hoặc giả định luôn có 10 kết quả. Phân trang theo start/metadata nhưng dựng lại URL trên host SerpAPI cố định, không fetch next URL tùy ý. Giữ cache mặc định của nhà cung cấp; không ép no_cache. Không ghi URL request chứa key vào log.

## Thu thập và chất lượng

- Chỉ website HTTP(S) công khai; đọc HTML, mailto và JSON-LD nếu có bằng chứng rõ. Một trang có nhiều email tạo các ứng viên riêng. Không đoán email từ tên người/tên miền. Không chạy JavaScript từ website trong tiến trình BE.
- Chỉ theo liên kết contact/about/liên hệ đã xuất hiện trên cùng domain, trong ngân sách; không quét toàn website, không đăng nhập, không vượt CAPTCHA hoặc robots. PDF/OCR/trang chỉ render bằng JS không hỗ trợ trong bản đầu; ghi lý do, không giả kết quả.
- Email trong snippet chưa được xác nhận trên trang chỉ là ứng viên chưa kiểm chứng; đề xuất chưa tự lưu thành Contact gửi chiến dịch. Không gán tên/chức vụ/company chỉ từ từ khóa đầu vào. BA cho phép suy luận chức vụ/ngành/khu vực từ nội dung thực thu thập, theo quy tắc provenance dưới đây.
- Lưu nguồn URL, thời điểm, loại chứng cứ, trích đoạn ngắn đủ liên hệ email với trường dữ liệu; không lưu toàn trang HTML không cần thiết. Trường quan sát thiếu vẫn để trống. Phạm vi kiểm tra email BA chốt là cú pháp: lưu syntax_valid/syntax_invalid và hiển thị “Hợp lệ về cú pháp”; deliverability=unknown, catch_all=unknown. Không dùng một cờ verified chung cho cả cú pháp và khả năng nhận thư; MX tồn tại không chứng minh hộp thư nhận được.
- Chuẩn hóa trim/lower để tương thích index hiện có; không Ẩn dấu chấm hoặc +tag theo đặc thù Gmail vì có thể đổi định danh. Kiểm tra cú pháp/độ dài, loại nguồn ghi nhận không dùng được. Suppression không bị Ẩn hoặc khôi phục bởi một lần tìm mới.

### Dữ liệu suy luận theo quyết định BA

Cho phép suy luận chức vụ/ngành/khu vực, nhưng không ghi dự đoán thành bằng chứng xác nhận. Mỗi trường có observed_value hoặc inferred_value riêng, determination_method=observed|inferred|unknown, source_url và evidence/reason. Hiển thị “Chưa đảm bảo — thông tin suy đoán” khi dùng inferred_value; thiếu cả chứng cứ lẫn cơ sở suy luận thì “Chưa xác định”. Không tự đặt phần trăm confidence khi chưa hiệu chuẩn. Giá trị suy luận không ghi đè observed_value/Contact hiện có; query đầu vào không phải dữ liệu nguồn.

Không suy luận chức vụ cá nhân cho email chung: job_title và inferred job_title đều null; có thể lưu ngành/khu vực của doanh nghiệp với provenance riêng. Tên cá nhân chưa có bằng chứng vẫn null.

Quy mô: BA đã chốt cho phép ước đoán từ số email công khai, hiển thị “Ước đoán — độ tin cậy thấp”, không dùng để lọc cứng. Lưu distinct_public_email_count theo domain và estimated_company_size riêng, kèm method_version, cơ sở và thời điểm; không đặt email count vào employee_count hoặc ghi đè số nhân viên có nguồn. Chỉ dùng gợi ý này để tham khảo, không loại hoặc tự coi Contact thỏa tiêu chí quy mô. Phương pháp quy đổi chưa có dữ liệu hiệu chuẩn: cần xây dựng và kiểm chứng trước khi sinh khoảng quy mô; không tự đặt các ngưỡng như 5 email tương đương 50 nhân viên. Chưa đủ dữ liệu thì trả “Chưa đủ cơ sở ước đoán”.

### Số liệu, loại trùng và lưu

`received` là số ứng viên email/contact sau trích xuất và đối chiếu tiêu chí, không phải số website/URL Google. Số website/crawl_failures lưu riêng. Chuẩn hóa → loại không hợp lệ → kiểm tra trùng trong job và toàn bộ contacts → Contact mới. Mỗi ứng viên được xếp đúng một nhóm; khi hoàn tất `received = invalid + duplicate + new`. Email có nhiều nguồn chỉ tạo một Contact; nguồn thứ hai được ghi nhận là trùng và giữ provenance. Contact đã tồn tại không ghi đè và không tiết lộ thông tin của nhân viên khác; chỉ báo đếm trùng.

Transaction hoàn tất gồm search_history + Contact mới + liên kết nguồn/kết quả + contact_list khi có Contact mới. Không gọi nguyên ContactsController.create qua HTTP: cần tái sử dụng đúng nghiệp vụ/persistence trong cùng transaction. Dùng UNIQUE lower(email) với ON CONFLICT để tính lại trùng khi hai job chạy đồng thời. Kết quả rỗng hoặc chỉ có trùng: vẫn lưu history, không tạo danh sách rỗng (API danh sách hiện yêu cầu ≥1). List tạo từ tìm kiếm luôn chưa kiểm tra/chưa xác nhận/chưa duyệt.

Lỗi provider, timeout pipeline hoặc lỗi DB: không tạo Contact/list/history thành công; job kỹ thuật giữ error để FE biết thất bại. Không được báo “không có kết quả” thay cho lỗi. Không công bố thành công một phần cho tới khi BA chốt; nếu một URL đọc thất bại cần báo rõ phạm vi chưa hoàn tất.

## API đề xuất

| Method/route | Quyền | Kết quả |
| --- | --- | --- |
| GET /api/contact-searches/capabilities | employee | configured, supportedCriteria; không trả key |
| POST /api/contact-searches | employee | body criteria, header Idempotency-Key; 202 job id/status |
| GET /api/contact-searches/:id | chủ job | status, stage, số URL đã xử lý; không % ước lượng giả |
| GET /api/search-history?cursor=&limit= | employee, chỉ dữ liệu mình | Lịch sử thành công/rỗng phân trang |
| GET /api/search-history/:id | chủ lịch sử | criteria snapshot, counts, listId/null, timestamps |
| GET /api/search-history/:id/contacts?cursor=&limit= | chủ lịch sử | Contact mới của lần tìm và source evidence |

Route ID dùng ParseIntPipe, limit có trần, cursor kiểm tra hợp lệ. Trưởng phòng tiếp tục dùng contact-lists theo quyền hiện có; chưa tự thêm quyền tìm kiếm hoặc xem lịch sử riêng của nhân viên. 401 chưa đăng nhập, 403 sai role, 404 không có/không sở hữu. 400 lỗi tiêu chí; 409 idempotency key cùng owner nhưng khác payload; 503 chưa cấu hình; lỗi provider được map mã ổn định và thông báo an toàn.

Job: queued → running (searching → fetching → validating → saving) → succeeded/failed. Không tạo trạng thái giao diện mới chỉ vì có stage nội bộ. FE tải lại có thể tiếp tục poll id của chủ job. Retry do timeout request POST phải dùng lại Idempotency-Key; bấm tìm lại có chủ ý sau thất bại tạo key mới. Không retry POST tạo job bằng key mới tự động.

## Dữ liệu và file cần sửa

Migration kế tiếp dự kiến `021_contact_search.sql` (kiểm tra lại số trước khi code):

- contact_search_jobs: owner_id, criteria snapshot, idempotency_key + hash, status/stage, lease/attempts, counters, safe_error, created/started/finished; unique(owner_id,idempotency_key).
- search_history: job_id unique, owner/source/criteria snapshot, counts, nullable list_id, timestamps; chỉ ghi khi hoàn tất thành công/rỗng.
- search_results/provenance: history_id, contact_id, source_url, evidence snippet, found_at, provenance cho trường quan sát/suy luận và kết quả kiểm tra cú pháp; lưu nhiều nguồn nếu cần, có ràng buộc chống nhân bản. Contact.source_url hiện tại là nguồn chính, không bị ghi đè bởi tìm lại.

Đề xuất gom trong `backend/src/search/`: module/controller/service/worker và adapter/extractor khi trách nhiệm thực sự cần tách; đăng ký AppModule. Dùng DatabaseService, SessionGuard, Roles hiện có. Frontend sửa đúng đường đi trong App.tsx, Flow.tsx, LiveFlows.tsx và api.ts; không thay các màn Chiến dịch/Response/Follow-up.

## Bảo vệ bộ tải website

URL từ Google vẫn là đầu vào không tin cậy. Chỉ HTTP(S), bỏ userinfo, giới hạn port; chặn loopback/private/link-local/multicast/reserved IPv4/IPv6, metadata cloud và host nội bộ. Resolve DNS, kiểm tra mọi địa chỉ và bảo đảm kết nối dùng địa chỉ đã kiểm tra để chống DNS rebinding. Validate lại từng redirect (tối đa đề xuất 3), không để fetch tự theo redirect vô điều kiện. Không gửi cookie/token Gmail/SerpAPI sang website đích. Giới hạn thời gian/body sau giải nén/concurrency; hủy đọc khi vượt trần, không đọc cả body rồi mới đo. Tôn trọng robots, 403/429/CAPTCHA; không né chặn. Không cho người dùng chọn proxy/URL provider tùy ý.

Giới hạn đề xuất kỹ thuật: timeout SerpAPI 20s, website 10s, job 120s, HTML 2MB sau giải nén, concurrency 2; các ngân sách ở plan.md cần đo và chốt trước live. Retry có backoff giới hạn cho 429/5xx, tính vào thời gian/credit; không retry 400/401/403. Khi process chết giữa chừng, reclaim lease có giới hạn, tránh commit cũ sau khi lease đã chuyển chủ.

## Nguồn kỹ thuật

Đọc ngày 15/11/2026, thông số dịch vụ có thể thay đổi; không lưu bản sao nguyên bài.

- [SerpAPI Search API](https://serpapi.com/search-api): q, engine, xác thực, metadata/error và cache mặc định.
- [Organic Results](https://serpapi.com/organic-results): title/link/snippet; không phải hồ sơ Contact đã xác minh.
- [Pagination](https://serpapi.com/pagination): phân trang kết quả.
- [Status/error codes](https://serpapi.com/api-status-and-error-codes): xử lý lỗi nhà cung cấp.
- [Google Custom Search overview](https://developers.google.com/custom-search/v1/overview): đóng cho khách mới; không chọn làm nền tảng mới cho dự án này.
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): kiểm tra đích mạng/DNS/redirect.
