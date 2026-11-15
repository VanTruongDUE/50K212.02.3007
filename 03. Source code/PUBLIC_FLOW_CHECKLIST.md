# Checklist nghiệp vụ web public

Nguồn đọc ngày 15/11/2026: `GHI_CHU_YEU_CAU.md`, quyết định BA cuối tài liệu, `frontend/src/App.tsx`, `Flow.tsx`, `SearchFlows.tsx`, `LiveFlows.tsx`, controller BE và `DEPLOY_VERIFICATION.md`. Đây là danh mục kiểm tra tạo từ mã/yêu cầu; trạng thái desktop mới được cập nhật riêng trong bảng bằng chứng cuối tài liệu. Các ô yêu cầu tổng hợp vẫn để trống nếu chưa phủ đủ mọi nhánh của ô. Không dùng preview/demo để đánh dấu đạt.

Public FE: `https://v5-marketing.vercel.app`; URL màn dùng `?screen=<route>`. API dưới đây tính từ `/api/`, trừ `/health`. Mở màn chính không chứng minh popup, validation, lỗi/rỗng hoặc ghi DB của màn đó đã được kiểm tra.

## 1. Phiên, điều hướng và shell — cả hai vai trò

- [ ] Đăng nhập ban đầu; thiếu cả hai trường/thiếu từng trường/email sai định dạng: lỗi đúng trường, giữ dữ liệu, focus hợp lý; chưa gọi login khi dữ liệu thiếu (`POST auth/login`).
- [ ] Sai thông tin, lỗi mạng, không có quyền: thông báo có cách khắc phục, không hiện secret; loading khóa gửi lặp.
- [ ] Đăng nhập Nhân viên và Trưởng phòng; `GET auth/me` đúng vai trò, sidebar/header đúng; refresh giữ phiên.
- [ ] `home`: Nhân viên nhận `GET notifications`; Trưởng phòng nhận thêm `GET dashboard?period=week`; loading/rỗng/lỗi tải trung thực, không tự gán số mẫu.
- [ ] Brand về home; menu chính/submenu, breadcrumb và browser Back/Forward đúng; nội dung màn không rơi về “Chức năng”.
- [ ] `profile`: email/vai trò; Đăng xuất (`POST auth/logout`) về login; refresh/Back không mở dữ liệu phiên cũ; lỗi logout cho thử lại.
- [ ] Nhân viên mở `manager-*`, Trưởng phòng mở route Nhân viên: FE đưa về home; BE từ chối quyền dù sửa URL hoặc gọi API trực tiếp.
- [ ] Kiểm tra 1440×1024 và 1366×900; tab/focus, disabled/loading/toast/error, bảng cuộn trong khung; popup đóng/hủy không lưu. Không tự đòi thiết kế mobile chưa chốt.
- [ ] Chọn bản ghi thứ hai rồi refresh, Back/Forward, đổi module và quay lại: không âm thầm hiện/chỉnh bản ghi đầu tiên; kiểm tra riêng Template/list/campaign/Response/Follow-up/sender.

## 2. Tìm Contact — Nhân viên

| Route/thành phần | API thật | Trạng thái/hành động cần đi qua |
| --- | --- | --- |
| `criteria`, `criteria-adjust`, `criteria-invalid` | `GET contact-searches/capabilities`; draft sessionStorage | chọn/bỏ tiêu chí, tìm trong danh sách, từ khóa, nguồn, áp dụng Template |
| `review` và các tên `review-*` được router giữ | `POST contact-searches` khi xác nhận | xem bộ tiêu chí, quay sửa; busy, ghi nhận lỗi, chống submit lặp |
| `searching` | `GET contact-searches/:id` polling | queued/running/stage; refresh với searchId; lỗi tải/thử lại |
| `results`, `search-empty`, `search-error`, `history-detail` | `GET contact-searches/:id` | succeeded/0 mới/failed; tiêu chí, đếm, cảnh báo, nguồn, bằng chứng |
| `search-all-contacts` | cùng job detail | 10 dòng/trang, trước/sau, về kết quả |
| `history` (rỗng/lỗi thực từ API) | `GET contact-searches/history?cursor=` | danh sách, phân trang, chọn đúng lần tìm và mở chi tiết |

- [ ] Nhập ít nhất một điều kiện hợp lệ; từ khóa chỉ khoảng trắng không qua; dữ liệu còn khi validation/lỗi tải.
- [ ] Nguồn Google khả dụng theo capabilities; Apollo ngoài phạm vi hiện tại không được trả Contact giả; thiếu key báo đúng.
- [ ] Review phản ánh đúng role/industry/location/keyword/size/email/source đã nhập; Điều chỉnh giữ draft, áp dụng Template giữ giá trị.
- [ ] Xác nhận tạo job một lần; reload/thử lại không nhân đôi job cho cùng requestKey. **Tìm thật dùng SerpAPI credit: chỉ kích hoạt khi nằm trong phạm vi cho phép của lượt audit.**
- [ ] Trạng thái đang tìm không có tiến độ giả; khi hoàn tất chuyển đúng results/empty/error; refresh không quên job ID.
- [ ] Results: received/invalid/duplicate/new_count khớp dữ liệu job; kết quả trùng hết phải giải thích 0 mới; warnings không bị trình bày như kết quả đầy đủ.
- [ ] Email có link website nguồn/bằng chứng; “Đã xác nhận” chỉ nguồn+cú pháp; trường suy đoán và quy mô tham khảo không diễn đạt thành dữ kiện chắc chắn.
- [ ] Xem toàn bộ/pagination đúng; mở link nguồn tab mới; quay về không đổi job.
- [ ] Mở “Kiểm tra danh sách” từ job có list_id truyền đúng `listId` đến `check`; job không có Contact mới không sinh danh sách giả.
- [ ] History rỗng, lỗi/thử lại, cursor tải thêm, người tạo/thời điểm/nguồn/tiêu chí/số đếm; người khác không đọc job trái quyền.

## 3. Filter Template — Nhân viên

- [ ] `templates`: `GET filter-templates`; selected row, tên/role/từ khóa/khu vực/quy mô; loading/rỗng/lỗi và “Tải lại Template”.
- [ ] Chọn bản ghi khác → `template-edit`: đúng ID/tên/tiêu chí, không lấy dòng đầu.
- [ ] `template-create`: tên bắt buộc, dropdown năm trường, keyword text; `POST filter-templates`; trùng tên trả lỗi, không mất draft.
- [ ] `template-edit`: `PATCH filter-templates/:id`; đổi từng trường, giữ mảng nhiều giá trị sẵn có khi chỉ sửa keyword/tên; reload và đọc lại.
- [ ] Xem Filter Template/hủy không tự lưu; thành công quay danh sách, bản ghi vừa lưu nhận diện được.
- [ ] “Xem / áp dụng tiêu chí” ghi draft và chuyển criteria, không tiêu credit/tạo job trước xác nhận.
- [ ] Lỗi POST/PATCH giữ form, nút hoạt động lại. FE hiện tại không có nút xóa Template riêng; `DELETE filter-templates/:id` là API, không tự ghi thành luồng UI đã có.

## 4. Danh sách Contact — Nhân viên

- [ ] `contact-lists` → `contact-list-detail`: `GET contact-lists`, `GET contact-lists/:id`; đúng tên/số Contact/đánh giá/phê duyệt/nguồn.
- [ ] `all-contacts`: 10 dòng/trang; trước/sau/boundary; quay lại đúng màn mở nó; dữ liệu không đổi sau refresh.
- [ ] `check`: xem Contact/bằng chứng; Lưu Đạt hoặc Chưa đạt gọi `PATCH contact-lists/:id/review`; busy/validation/server error không thành công giả.
- [ ] `check-rejected`: không thể xác nhận; quay kiểm tra/chọn danh sách đúng, không tạo Contact mới.
- [ ] `confirm`: tóm tắt đúng; chỉ Đạt/chưa xác nhận được bấm; `POST contact-lists/:id/confirm`; xác nhận xong gửi danh sách chờ Trưởng phòng.
- [ ] `confirmed`: trạng thái/đếm đúng, không xác nhận lặp; chuyển Xuất danh sách đúng ID.
- [ ] `export`: chọn bắt buộc CSV/XLSX/JSON/XML; chưa chọn nút khóa; tải đúng nội dung API hiện có (tạo file ở FE, không có endpoint export riêng).
- [ ] Xuất thành công/rỗng/lỗi tải; ký tự tiếng Việt, email, escaping/đuôi file/số dòng; không hiểu dữ liệu mẫu Figma là dữ liệu production.
- [ ] List thiếu/không có quyền/lỗi đọc → có nguyên nhân/thử lại/quay về, không hiện list khác dưới cùng URL.

## 5. Duyệt Contact — Trưởng phòng

| Route | API/hành vi |
| --- | --- |
| `manager-review`, `manager-review-empty` | `GET contact-lists`, lọc pending đã confirmed; chọn dòng |
| `manager-review-detail` | `GET contact-lists/:id`, đếm lọc, 5 dòng xem trước |
| `manager-review-all-contacts` | cùng detail, xem toàn bộ và quay lại |
| `manager-review-reject` | bắt buộc nhận xét; `POST contact-lists/:id/approval {decision:rejected,comment}` |
| `manager-review-approved`, `manager-review-rejected` | kết quả thật từ API và nhận xét, về danh sách |

- [ ] Danh sách chỉ hiện pending đã xác nhận; rỗng sau duyệt không phải lỗi; chọn đúng ID và Contact của list đó.
- [ ] Duyệt gọi approval approved một lần, Nhân viên đọc lại kết quả sau refresh; đã duyệt không duyệt lại.
- [ ] Không đạt → nhận xét trống bị chặn, nhập rồi lưu, Nhân viên nhìn thấy lý do; hủy không ghi.
- [ ] Pending thay đổi bởi phiên khác → API chặn race, FE báo lỗi thay vì ghi đè.
- [ ] Đối chiếu thứ tự duyệt với BA: bản live API hiện đòi list được duyệt **trước** `POST campaigns`; không tự coi là đã thực hiện BPMN duyệt recipient sau draft campaign.

## 6. Campaign — Nhân viên

| Route/popup | API/hành động |
| --- | --- |
| `campaign-list` | `GET campaigns`; Xem mở overview modal, Chỉnh sửa modal, Ẩn/pause/modal theo trạng thái |
| `campaign-contacts` | chọn list confirmed+approved, tên/mô tả; `POST campaigns` |
| `campaign-filtered` | đếm gốc/loại/hợp lệ, Chọn lại hoặc xác nhận recipient; không tự gửi |
| `campaign-pending` | hiển thị trạng thái duyệt/list, tiếp tục khi hợp lệ |
| `campaign-email` | `GET email-templates`; `POST email-templates/:id/apply {campaignId}` sao chép mẫu |
| `campaign-layouts`, `campaign-editor` | chọn layout; `PATCH campaigns/:id/content`; chèn block/biến/link/logo/PDF, lưu mẫu |
| `campaign-preview` | `POST campaigns/:id/preview {contactId}`; desktop/phone/chọn Contact/đóng |
| `campaign-sender` | `GET sender-accounts`; `PATCH campaigns/:id/sender` |
| `campaign-schedule` | tính dự kiến FE; `PATCH campaigns/:id/schedule` |
| `campaign-confirm` | tóm tắt bốn phần, xem mail, sửa, xác nhận cuối; `POST campaigns/:id/confirm` |
| `campaign-detail` | `GET campaigns/:id`; recipient/status/lịch sử tổng quát |
| `campaign-resume` | xem lại/phần chưa gửi; `POST campaigns/:id/resume` sau điều kiện hợp lệ |

- [ ] List loading/rỗng; chỉ chọn confirmed+approved; tên bắt buộc ≤100, trùng tên, không chọn list, mô tả và draft còn khi lỗi.
- [ ] Lọc trùng giữa lists, unsubscribed/bounce, đã gửi trong 7 ngày; 0 hợp lệ bị chặn; số đếm khớp recipient thật.
- [ ] Chọn lại xử lý đúng draft vừa tạo; không xóa campaign khác; quay các bước không mất tên/list/nội dung.
- [ ] Thư viện mẫu: chọn mẫu sao chép, mẫu gốc không bị sửa; bố cục trống, mẫu thiếu, lỗi áp dụng và tạo mẫu mới.
- [ ] Editor: subject bắt buộc ≤150, body bắt buộc; biến hỗ trợ, biến sai, block kéo/chèn đúng vị trí, logo nguồn thư viện/tải ảnh, link đúng và nội dung không bị mất.
- [ ] `POST/GET/DELETE campaigns/:id/assets[/assetId]`: ảnh PNG/JPG/SVG ≤2 MB; tối đa 3 PDF ≤10 MB/tệp; đúng/sai type, quá size, upload lỗi, download hash và xóa đúng asset.
- [ ] Preview desktop/phone và Contact thứ hai thay biến đúng; lỗi biến/API có cách quay lại; sau sửa content/asset phải preview lại.
- [ ] Sender active/configured, quota theo account; đủ/không đủ/không có; tên người gửi nếu màn hiện; đổi sender lưu đúng dữ liệu sau refresh.
- [ ] Schedule Gửi ngay/Hẹn giờ; giờ GMT+7, hẹn ≥15 phút và ≤90 ngày; thiếu/sai ngày giờ; tính dự kiến/điều chỉnh/lưu; chưa xác nhận không gửi.
- [ ] Confirm bốn phần đúng, xem nội dung mới bật nút; sửa thông tin chung/content/sender/schedule rồi quay lại; popup Hủy không gửi; submit lặp bị khóa.
- [ ] Xác nhận thật **chỉ người nhận được cho phép**, kiểm tra delivery đúng một lần; success/failure/thiếu quota/summary lỗi/cấu hình hết hợp lệ; không gửi thêm chỉ để phủ màn.
- [ ] Overview Xem là modal, chứa tên/trạng thái/số recipient/subject/sender/bắt đầu, paused thêm mốc/lý do; đóng về cùng list.
- [ ] Chỉnh sửa (`PATCH campaigns/:id`) đúng campaign/tên/mô tả, trống/lỗi giữ modal; gửi xong hoặc trái trạng thái không sửa trái phép.
- [ ] Tạm dừng (`POST campaigns/:id/pause`) lý do tối đa250; Hủy/đồng ý; số sent/pending và lịch sử giữ nguyên; lỗi không thành công giả.
- [ ] Tiếp tục chỉ pending, preview lại nếu sửa; thiếu quota/inactive sender/lỗi send không tự gửi lại; đã gửi giữ nguyên lịch sử.
- [ ] Ẩn (`DELETE campaigns/:id`) chỉ khi chưa gửi; popup Hủy/đồng ý/thất bại, đã gửi bị chặn; không mất lịch sử thư đã gửi.
- [ ] Render còn chạy nhưng browser logout/đóng: scheduled job hoạt động; khi service ngủ không hứa lịch chính xác. Stale/uncertain SMTP không tự resend.

## 7. Response — Nhân viên; Inbox chưa ghép — giới hạn FE

- [ ] `response-list`: `GET responses`; bảng đúng phạm vi phụ trách, scroll trong khung, empty/loading/error/retry, chọn đúng bản ghi.
- [ ] `response-add`: `POST responses`; tên/body bắt buộc, email/phone hợp lệ, form2cột, lưu một lần; loại/trạng thái/thời điểm hệ thống quản lý; lỗi giữ dữ liệu.
- [ ] `response-detail`: `GET responses/:id`; campaign/contact/kind/status/owner/body, lịch tương tác và Follow-up; lỗi 403/404 không fallback sang người khác.
- [ ] `response-edit`: `PATCH responses/:id`; chỉ Mới/Đang xử lý, giữ dữ liệu cũ, validation và server error; loại/nhận/campaign không sửa vô cớ.
- [ ] `response-status`: trạng thái hiện tại/read-only, bước tiếp theo hợp lệ, ghi chú; `PATCH responses/:id {status,note}`; không bỏ qua bước/chốt trái phép.
- [ ] `response-status-history`: đọc status_history trong detail, note/thời điểm/người thực hiện khớp DB, quay về đúng Response.
- [ ] `response-reply`: Email hoặc ghi nhận SMS thủ công; chọn account/template/nội dung, biến/subject/recipient; Email `POST responses/:id/reply`, SMS `POST responses/:id/interactions`; không ghi SMS thành gửi SMS tự động.
- [ ] Gửi Email phản hồi chỉ trong người nhận được cho phép; lỗi SMTP/unknown acceptance giữ trạng thái cần kiểm tra, không retry ngầm; lưu history chỉ khi API xác nhận phù hợp.
- [ ] `response-history`: lịch Email/SMS thật, 0 tương tác không hiện mẫu; quay về đúng bản ghi.
- [ ] `response-hide`/popupẨn: `POST responses/:id/hide`; chọn đúng ID; chỉ loại/điều kiện cho phép (không có tương tác hoặc Follow-up theo BE); Hủy/thất bại không mất dữ liệu.
- [ ] Từ chối Email đi Follow-up → `followup-optout`, giải thích và về đúng Response; không âm thầm chọn người khác.
- [ ] Email gửi ra có unsubscribe; reply mới tự ghép campaign/contact/người phụ trách; Interested/Need info/Not interested/OOO/Bounce/Unsubscribe/Other tách khỏi trạng thái xử lý, không phân loại nhầm phần quote.
- [ ] BE có `GET inbox/unmatched`, assign/ignore và `PATCH responses/:id/assignee`; FE live hiện chưa có route/nút inbox unmatched hoặc phân công tương ứng. Ghi thiếu phủ UI riêng, không giả định manager có màn này.

## 8. Follow-up — Nhân viên

- [ ] `followup-list`: `GET followups`; đúng khách/Response/attempt/max/channel/date/status; chọn dòng, view result, lập lịch; loading/rỗng/lỗi.
- [ ] `followup-create`: từ Response giữ ID; chọn Response hợp lệ; ngày để trống dùng2ngày làm việc, Email/SMS/phone, goal bắt buộc, reminder≥0, wait1–30, max1–3, interval1–30; `POST followups`.
- [ ] Validation thiếu goal/quá khứ/số không nguyên/phạm vi sai giữ form; Hủy về đúng Response không ghi.
- [ ] `followup-duplicate`: một pending/Response, API chặn trùng; quay form giữ dữ liệu. `followup-optout`: từ chối Email, không tạo lịch Email trái phép.
- [ ] `followup-success`: ID/Response/channel/due/max/status từ bản API vừa lưu; tạo khác/về list đúng.
- [ ] `followup-result`: summary và history thật; `followup-note` → `PATCH followups/:id/note`, lưu/rỗng/lỗi/quay lại.
- [ ] `followup-detail` (từ Ghi nhận kết quả): body bắt buộc, needsNext; `PATCH followups/:id/complete`; ghi kết quả xong không tự gửi email.
- [ ] Awaiting→responded/no_response sau wait, tự tạo lượt kế tiếp khi needsNext và dưới max; không tạo trùng pending; lịch sử/notify đúng. Đây là timer/đợi thật, không phủ chỉ bằng đổi URL.
- [ ] `followup-delete` hoặc popupHủy lịch: `DELETE followups/:id` chỉ pending, giữ history cancelled; đã xử lý bị chặn; Hủy dialog không ghi.

## 9. Tài khoản gửi — Trưởng phòng; Nhân viên chỉ đọc

- [ ] Employee `sender-list`→`sender-detail`: `GET sender-accounts[/id]`, quota/status/cấu hình, không có nút quản trị và không lộ token/secret.
- [ ] Manager `manager-account-check`: chọn đúng account → verify SMTP `POST sender-accounts/:id/verify`; `manager-account-result-good/error` nội dung thật; quay lại/thêm hoặc đổi account.
- [ ] `manager-account-list`→`manager-account-detail`: chọn bản ghi thứ hai, reload đúng; quota3days/used/status/SMTP/IMAP/OAuth đúng.
- [ ] `manager-account-add`: `POST sender-accounts`; name/email/SMTP fields/port/quota/status/inbound, validate trống/trùng/range; OAuth mới cho inactive/no password/no inbound.
- [ ] `manager-account-edit`: `PATCH sender-accounts/:id`; secret trống giữ secret cũ, không prefill password; OAuth connected khóa trường identitySMTP, ghi chú hướng disconnect trước khi sửa.
- [ ] `manager-account-saved`: bản vừa lưu đúng, view/detail/list; API lỗi không hiện saved giả; edit missing ID có hồi phục.
- [ ] Kết nối/reconnect (`POST :id/google/connect`) → Google → HTTPS callback đúng FE, state/PKCE/phiên, sai Gmail/hủy/quyền thiếu/hết hạn/lỗi token; không lộ token qua URL/log.
- [ ] Disconnect (`POST :id/google/disconnect`) có xác nhận, dừng SMTP/IMAP ứng dụng; Hủy giữ kết nối. **Không ngắt Gmail đang dùng nếu chỉ cần phủ popup.**
- [ ] SMTP verify, IMAP verify (`POST :id/verify-inbox`), sync (`POST :id/sync-inbox`): enabled/disabled/busy, thông báo thật; initcursor không nhập thư cũ, sau đó chỉ thư mới.
- [ ] Ẩn (`DELETE sender-accounts/:id`): account chưa dùng, popupconfirm/Hủy/lỗi; account có campaign bị chặn, không làm mất lịch sử.
- [ ] blocked/inactive/expired token khiến campaign dừng hoặc báo nguyên nhân; không tự chọn tài khoản khác.

## 10. Khoảng trống kiểm chứng public — danh sách ban đầu

`DEPLOY_VERIFICATION.md` ghi kết quả triển khai trước lượt này. Các mục dưới là khoảng trống ban đầu; trạng thái cập nhật nằm ở bảng bằng chứng cuối tài liệu và `PUBLIC_FLOW_AUDIT.md`. Không chuyển các kết quả API thành dấu đạt cho toàn bộ checklist.

- [ ] Chưa có bằng chứng public Google Search có credit → job→results/empty/error/history→Contact; không dùng fixture local làm chứng cứ cloud.
- [ ] Chưa phủ toàn bộ lựa chọn/lỗi/empty/retry của Template, export4formats và pagination trên dữ liệu đủ nhiều dòng.
- [ ] Chưa phủ từ chối manager/nhận xét/race và quay sửa; chưa phủ mọi nhánh campaign pause/resume/delete/quota/schedule tương lai/asset10MB/previewmultiContact.
- [ ] Chưa phủ UI sửa/chuyển trạng thái/Email reply/SMS recording/ẨnResponse và các điều kiện chặn; chưa phủ Follow-up complete/wait/chain/cancel/duplicate/optout.
- [ ] Chưa phủ add/edit/Ẩnsender khác nhau, OAuthfailures, API fail/recovery mỗi màn, phiên hết hạn, nhiều người dùng và refresh đúng bản ghi không phải dòng đầu.
- [ ] Chưa có kiểm chứng chịu tải/Render sleep đánh thức hoặc toàn bộ196frame; đối chiếu visual theo bố cục/nội dung/thao tác khoảng90% do BA yêu cầu, không dựng chỉ số pixel không đo.

## Điểm cần kiểm tra do đọc mã, chưa tái hiện runtime

1. **P1 đã tái hiện trên public qua desktop của chủ phiên:** chọn Contact list6 chưa kiểm tra → mở `contact-list-detail` (ảnh05); URL chỉ có `?screen=contact-list-detail&searchId=1`, thiếu `listId`. Ctrl+R → màn tự hiển thị list10 mới nhất (ảnh06). Danh tính bản ghi đổi mà không có lựa chọn mới. `LiveFlows.choose()` chỉ lưu selected vào React state; khởi tạo selected chỉ đọc `listId`, còn fallback list dùng phần tử đầu. Response và Follow-up cũng đã tái hiện riêng ở bảng bằng chứng bên dưới; campaign/sender/Template mới là phạm vi rủi ro từ mã, chưa mặc định có bằng chứng runtime. `template-edit` lúc tải nhóm filter chủ động nạp `loaded[0]`.
2. Header manager hiển thị tổng quan7ngày; BE có dashboard period week/month nhưng FE home chưa có bộ chọn tuần/tháng. Đây là thiếu điều khiển nhìn thấy từ mã so với PV2; không phải assertion API thất bại.
3. BE có unmatched inbox/assign/ignore nhưng FE live không có route/quản trị tương ứng; quản lý thư chưa ghép còn thiếu đường UI. Chỉ ghi nhận phạm vi, chưa tự xây thêm màn ngoài Figma.
4. SRS/BPMN mô tả duyệt recipient sau draft, API tạo campaign lại yêu cầu Contact list đã approved. Đây là chênh quy trình cần đối chiếu BA, không tự sửa thứ tự khi kiểm tra.

Không sửa FE/BE, không mở UI, không gửi thư, không tìm kiếm hoặc sửa DB trong lượt lập checklist này.

## Bằng chứng desktop public bổ sung — chủ phiên điều khiển

Trạng thái **PASS** chỉ áp dụng hành động cụ thể; **PARTIAL** nghĩa là mới phủ một phần luồng; **FAIL** có tái hiện; **NOT RUN** chưa chạy. Người cập nhật tài liệu chỉ đọc báo cáo từ chủ phiên, không tự điều khiển UI hoặc sửa dữ liệu.

| Nhóm | Trạng thái | Bằng chứng mới và phần còn thiếu |
| --- | --- | --- |
| Đăng nhập manager | PASS | Form public → đúng home/sidebar Trưởng phòng; không suy rộng mọi nhánh auth lỗi |
| Duyệt list6 | PASS | Bấm trực tiếp dòng thứ hai chọn đúng list6 rồi duyệt; sự cố native accessibility click không chọn trước đó không phải lỗi app |
| Từ chối list7 | PASS | Nhận xét trống khóa xác nhận; nhập lý do kiểm tra thông tin liên hệ rồi lưu thành công; chưa phủ lỗi mạng/race |
| Campaign7 soạn email | PARTIAL | Tạo draft, compose/save, preview desktop, chọn sender1, Gửi ngay, mở xác nhận cuối rồi **đóng**; không xác nhận gửi và không phát sinh thêm email từ thao tác này |
| Response9 và Ẩn Response8 | PARTIAL | Sửa nội dung và chuyển Đang xử lý được đối chiếu DB; Response8 mở/hủy popup rồi xác nhận Ẩn, DB xác nhận hidden. Chưa phủ phản hồi Email/SMS |
| Follow-up tạo | PASS | Tạo phone FU7 từ luồng Response, hẹn17/11; không gửi email |
| Follow-up hoàn tất và Ẩn | PARTIAL | FU4 hoàn tất needsNext=false, DB xác nhận note; FU7 xác nhận Ẩn và DB cancelled; chưa phủ chuỗi lượt tiếp theo/wait tự động/optout/duplicate |
| Sender inactive và quota | PARTIAL | Thêm tài khoản Ngừng hoạt động, sửa hạn mức80; mở/hủy popup và xác nhận Ẩn, danh sách/API không còn sender thử. Chưa phủ duplicate/mọi trường lỗi hoặc campaign phụ thuộc |
| SMTP verify public | PASS | Bấm kiểm tra trên UI, quan sát success; không đồng nghĩa gửi email mới |
| IMAP verify và sync public | PASS | Verify thành công và sync có toast thành công; không đồng nghĩa mọi nhánh Inbox đã phủ |
| Contact refresh | FAIL P1 | List6 → Ctrl+R thành list10; ảnh05–06, URL thiếu listId |
| Response refresh | FAIL P1 | RSP9 → Ctrl+R thành RSP6 do URL giữ listId6; ảnh09–10; không phải fallback về RSP12 mới nhất |
| Follow-up refresh | FAIL P1 | FU4/RSP10 → Ctrl+R thành FU3/RSP3, URL giữ listId9; ảnh12–13 |
| Cold start | FAIL về độ đáp ứng quan sát | Có lần chờ ít nhất90giây trên public; chưa có benchmark lặp lại/tách DNS/TLS/Renderwake/DB để khẳng định mọi request chậm hoặc nguyên nhân duy nhất |
| Search credit → kết quả public | PASS một lượt cụ thể | GUI nhập FPT Software, review/xác nhận Google, search1 xử lý20 trang và1 Contact mới, history/detail/xem toàn bộ, cảnh báo lỗi URL và giới hạn20 trang. Nguồn fpt.vn/vi cần người dùng kiểm tra độ phù hợp với FPT Software. Chưa phủ kết quả rỗng/lỗi/thử lại |
| Kiểm tra/xác nhận Contact, CSV | PASS thao tác cụ thể | List6 Chưa đạt → Đạt → xác nhận/pending manager; CSV tải về có4cột/1Contact đúng fixture. Chưa thử ba định dạng còn lại hoặc phân trang nhiều dòng |
| Filter Template | PARTIAL | Template3 tạo/sửa keyword/áp dụng vào criteria; chưa phủ nhiều Template, mọi dropdown/lỗi hoặc reload đúng bản ghi thứ hai |
| Đăng nhập Nhân viên/lỗi form | PASS thao tác cụ thể | Form trống/email sai định dạng/sai thông tin; URL manager khi chưa đăng nhập vẫn yêu cầu login; đăng nhập Nhân viên về đúng home; cả hai vai trò xem profile và logout |
| Desktop | PARTIAL | Ảnh cửa sổ Campaign rộng1426px và Response1366px: bảng/nút nằm trong khung, Response cuộn nội bộ; chưa rà mọi màn và mọi viewport |
| Các nhánh lỗi/empty và breakpoint còn lại | NOT RUN/PARTIAL | Giữ các ô tương ứng ở trên chưa đánh dấu; không có kết luận phủ toàn bộ96mục hoặc196frame |

Chi tiết P1 và phạm vi mã liên quan nằm trong `PUBLIC_ROUTING_FINDING.md`. Chưa có sửa FE/BE cho P1 trong lượt audit này.

## Dọn dữ liệu sau kiểm tra

Đã dọn chính xác các fixture của lượt audit:9Response,2campaign chưa gửi,5danh sách,5Contact,search1,filter3 và Follow-up/lịch sử liên quan.29kiểm tra an toàn trước commit và11kiểm tra sau commit đạt. Campaign3 đã hoàn tất, Response3, Follow-up3 và sender1 vẫn còn; không gửi email mới trong lượt audit. Các ID trên chỉ để đối chiếu ảnh/báo cáo, không còn là link dữ liệu thử đang hoạt động.
