# P1: reload đổi bản ghi đang mở

Ngày15/11/2026. Phần dưới ghi bằng chứng trước sửa; bản sửa source và kết quả kiểm tra mới nằm ở cuối tài liệu. Chưa triển khai bản sửa lên public.

## Bằng chứng public

Chủ phiên dùng desktop chọn Contact list6 chưa kiểm tra, mở chi tiết (ảnh05). URL là `?screen=contact-list-detail&searchId=1`, không có `listId`. Ctrl+R làm màn hiện Contact list10 mới nhất (ảnh06). Đây là lỗi runtime đã tái hiện, không chỉ nhận xét từ source. Có nguy cơ người dùng thao tác nhầm danh sách sau reload; chưa khẳng định đã có ghi nhầm dữ liệu.

Hai lần tái hiện bổ sung từ desktop của chủ phiên:

- Từ URL export có `listId=6`, bấm sidebar Response rồi thực sự bấm RSP9: nội dung trước refresh là RSP9, URL `response-detail&listId=6`, không có `responseId`. Ctrl+R hiển thị RSP6 (ảnh `09-response9-before`, `10-response-after`). Đây là **va chạm ID khác loại**, không chỉ chọn dòng mới nhất: listId6 bị đọc thành selected6 rồi khớp Response6, dù Response mới nhất là12.
- Thực sự bấm Follow-up4, kênh Gọi điện/pending thuộc RSP10: URL `followup-result&listId=9` còn ID cũ. Ctrl+R hiển thị FU3/RSP3 (ảnh12–13). ID9 không khớp Follow-up nên fallback về dòng đầu.

Do đó Contact/Response/Follow-up đã có bằng chứng runtime riêng; Campaign/Template/sender còn là phạm vi rủi ro từ mã cho đến khi được tái hiện. Lần native accessibility click không đổi dòng manager trước đó **không được tính lỗi ứng dụng**: bấm trực tiếp dòng thứ hai đã chọn đúng và duyệt list6 thành công.

## Chuỗi nguyên nhân và chỗ phải sửa cùng nhau

| Nơi | Dòng hiện tại | Vai trò |
| --- | --- | --- |
| `frontend/src/LiveFlows.tsx` |400 | selected khởi tạo chỉ từ URL listId, không có ID cho các loại bản ghi khác |
| cùng file |511–521 | list/campaign/response/followup/sender đều fallback về phần tử đầu nếu selected trống/không khớp; list manager ưu tiên pending đầu |
| cùng file |732–738 | choose(id,next) setSelected vào memory rồi go(next), không ghi ID URL |
| `frontend/src/App.tsx` |193–207 | go tạo query mới bằng screen/role và sao chép searchId/listId cũ, không nhận selection context; stale listId/searchId còn theo qua module khác |
| `LiveFlows.tsx` |542–548,643–660 | detailId lấy từ object đã fallback; useEffect gọi GET :id và setDetail nên API trả dữ liệu thật của **bản ghi sai đã chọn**, không phải BE tự đổi ID |
| cùng file |620–626 | tải filter khi screen template-edit luôn setSelected/name/criteria từ loaded[0], kể cả sau này chỉ thêm templateId vào URL mà chưa sửa nhánh này |
| cùng file |402–405,570–591,2742–2745 | senderEditId có URL senderId riêng và hydrate form; đây là trường hợp đã xử lý một phần, không nên phá khi sửa chung |
| `frontend/src/SearchFlows.tsx` |218–224 | openList từ search ghi listId trước go(check): đường này đã lưu ID, còn choose từ danh sách chưa làm; tránh sửa hỏng đường đang đúng |

`go()`/browser popstate chỉ thay screen; selected không đồng bộ theo history entry. Vì thế Back/Forward cũng cần kiểm tra, không chỉ khởi tạo một lần bằng useState. Contact page/return screen chỉ lưu memory ở LiveFlows1070; sau reload vị trí trang/đích Quay lại có thể reset, mức thấp hơn đổi danh tính bản ghi.

## Phạm vi bị ảnh hưởng từ mã

| Loại/context cần lưu | Màn và đường thao tác |
| --- | --- |
| listId | contact-list-detail, check/check-rejected, confirm, confirmed, all-contacts, export/export-success; manager-review-detail/all-contacts/reject/approved/rejected; lựa chọn pending ở manager-review |
| campaignId | campaign-filtered/pending/layouts/email/editor/preview/sender/schedule/confirm/detail/resume; chọn Mở/Chỉnh sửa/Sửa email từ campaign-list, tạo draft rồi đi các bước; popup overview/edit/Ẩn/pause dùng object trực tiếp trong phiên nhưng khi chuyển thành route phải giữ đúng ID |
| responseId | response-detail/edit/status/history/status-history/reply; từ list chọn Xem chi tiết; followup-create/duplicate/optout cần Response context gốc riêng với ID của Follow-up |
| followupId | followup-result/note/detail/delete/success và về lại; chọn từ followup-list hoặc sau POST create nhận ID mới |
| templateId | template-edit, lựa chọn ở templates, save/reload/thử lại; row select và Cập nhật Template hiện trực tiếp setSelected |
| senderId | sender-detail, manager-account-detail/edit/saved/result-good/result-error và check; row select/check result/save hiện trực tiếp setSelected; giữ cơ chế senderEditId đã có |

Các caller setSelected ngoài choose phải rà: Template900/911; manager list1006; campaign openEmail1212/create1285/clear1361; Response→Follow-up2108; Follow-up Response select2178; sender check2434–2446/save2596/edit detail2742–2745. Số dòng là snapshot trước sửa; tìm ký hiệu khi thực hiện.

## Đề xuất thay đổi nhỏ nhất nhưng đầy đủ

1. Dùng các query key theo loại `listId`, `campaignId`, `responseId`, `followupId`, `templateId`, `senderId`; giữ searchId cho SearchFlows. Không dùng một listId chung cho mọi entity.
2. App.go nhận context ID tùy chọn (hoặc một helper navigation hiện có mở rộng), ghi đúng ID cùng history.pushState; giữ ID cần thiết khi chuyển bước cùng record, loại stale ID khi về list/tạo mới/đổi module. Riêng followup-create cần responseId, không gán responseId thành followupId. Không lưu bí mật trong URL.
3. choose và mọi caller trực tiếp setSelected+go phải đi qua cùng cơ chế. Khi POST tạo campaign/Follow-up, lấy ID response API và ghi vào route kế tiếp. Giữ sender-edit deep link hiện có.
4. Hydrate lựa chọn từ URL theo screen/group, đồng bộ khi Back/Forward, reload hoặc URL đổi mà component không unmount. Form Template edit tìm đúng templateId, không loaded[0]; chỉ hydrate draft khi ID thay đổi, không xóa draft mỗi keystroke/refetch.
5. Với màn detail/edit có ID rõ nhưng không tồn tại/không quyền: hiện not found/error, **không fallback** sang dòng đầu. Màn list có thể chọn dòng đầu có chủ đích; URL cũ không ID có thể chuyển về danh sách hoặc cố định fallback vào URL một lần theo quyết định UX, không âm thầm đổi đối tượng.
6. Rà detail/asset/preview fetch và derived current fallback cùng selection; API GET/PATCH phải dùng cùng ID đang hiển thị. Không đổi API hoặc schema DB cho lỗi FE này.

## Kiểm tra nhỏ bắt buộc sau sửa

- [ ] Tối thiểu hai bản ghi mỗi nhóm; chọn bản thứ hai → reload/deep link/Back/Forward vẫn cùng ID/tên.
- [ ] Contact list6 → check/confirm/all/export đúng6, không tác động list10; search→openList vẫn giữ đúnglistId.
- [ ] Campaign/Response/Follow-up chi tiết và editor không đổi record; field hydration đúng sau reload; draft chưa lưu không reset vì refetch.
- [ ] Template thứ hai edit/reload lưu đúngID; sender edit deep link cũ vẫn đúng.
- [ ] Record ID sai/không quyền không hiển thị bản ghi khác; đổi module/tạo mới không tái dùng staleID.
- [ ] Test URL context cho Follow-up từ Response (responseId khác followupId) và sau create thành công.
- [ ] Chạy kiểm tra route/navigation phù hợp và đối chiếu desktop public sau deploy; không dùng một test khởi tạo React state làm chứng minh toàn luồng.

Chưa mở UI, không gửi mail/tìm kiếm, không sửa dữ liệu hoặc code production trong lượt trace này.

## Bản sửa source sau audit — 15/11/2026

- Tách danh tính URL thành listId/campaignId/responseId/followupId/senderId/filterId. ID chỉ theo màn cùng loại; vào module/danh sách hoặc form tạo mới không kéo ID cũ sang.
- Chọn đối tượng ghi vào URL ngay; mở chi tiết và chuyển bước truyền đúng ID. Khôi phục selection khi popstate/refresh, xóa detail cũ và chỉ ghép detail có ID khớp.
- Follow-up tạo mới dùng responseId của khách hàng; xem/kết quả Follow-up dùng followupId. Đường Search → Kiểm tra danh sách truyền listId rõ ràng.
- ID sai hoặc URL chi tiết cũ thiếu ID yêu cầu chọn lại từ danh sách, không fallback bản ghi đầu. Template edit không nạp cứng dòng đầu; form Response/sender đọc đúng bản ghi khi mở trực tiếp hoặc quay history.
- Không đổi CSS, bố cục, BE hoặc database. Không gửi email và không dùng SerpAPI khi kiểm tra sửa lỗi.

Kiểm chứng source: build, lint và7test Node trong frontend/tests/recordNavigation.test.mjs đạt. Build còn cảnh báo kích thước bundle trên500kB (không phải lỗi build).

Kiểm chứng trình duyệt thật trên bản build local, API fixture riêng chỉ trên127.0.0.1:5179 (không phải dữ liệu production):

1. Contact: thực sự bấm dòng2, URL listId=2; reload vẫn tên/email của Contact2.
2. Từ Contact chuyển Response không còn listId; bấm RSP2, reload vẫn RSP2/nội dung2.
3. Từ RSP2 bấm Tạo lịch Follow-up; reload vẫn chọn RSP2, không đọc thành Follow-up2.
4. Bấm lịch Follow-up dòng2; URL followupId=2, reload đúng khách hàng2/mục tiêu2.
5. Browser Back qua danh sách về RSP1, Forward trở lại RSP2: URL và dữ liệu cùng đối tượng.
6. responseId=999 và URL cũ response-detail&listId=2: màn Không tìm thấy bản ghi, không hiện hành động cập nhật bản ghi đầu; Về danh sách khôi phục bảng.
7. Mở trực tiếp response-edit&responseId=2 và template-edit&filterId=2: các trường tên/nội dung/tiêu chí thuộc bản ghi2.

Giới hạn: chưa deploy source mới hoặc chạy lại bằng dữ liệu public sau deploy; chưa coi toàn bộ196trạng thái đã đạt. Tệp fixture và bằng chứng local nằm riêng trong .context-cache/public-audit/.
