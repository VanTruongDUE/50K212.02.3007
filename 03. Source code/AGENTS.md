# Quy tắc phát triển mã nguồn

Áp dụng cho mã nguồn trong thư mục `03. Source code`.

## Phạm vi công việc

- Đọc yêu cầu và các tài liệu hiện có trước khi sửa mã nguồn. Nếu thiếu thông tin làm thay đổi chức năng hoặc dữ liệu, hãy hỏi ngắn gọn.
- Chỉ thực hiện phần được yêu cầu; không tự thêm tính năng, quy tắc nghiệp vụ hoặc công nghệ chưa được xác định.
- Giữ thay đổi nhỏ, đúng chỗ và bảo toàn những chỉnh sửa không liên quan.

## Cách viết mã

- Theo cấu trúc, cách đặt tên và công cụ định dạng sẵn có của dự án. Khi chưa có quy ước, ưu tiên mã dễ đọc và tên mô tả rõ mục đích.
- Mỗi hàm hoặc mô-đun nên có một trách nhiệm rõ ràng. Chỉ tách phần dùng chung khi đã có nhu cầu thực tế.
- Xử lý lỗi rõ ràng; kiểm tra dữ liệu ở ranh giới nhập liệu và không bỏ qua lỗi âm thầm.
- Không ghi mật khẩu, khóa API hoặc thông tin bí mật trực tiếp vào mã nguồn.
- Chỉ thêm thư viện khi cần để đáp ứng yêu cầu và giải thích lý do.

## Giao diện theo Figma

- Figma do BA cung cấp là nguồn chuẩn cho giao diện FE: bố cục, nội dung chữ, màu, font, kích thước, khoảng cách, icon, hình ảnh và các trạng thái đã thiết kế. Không tự đổi phong cách hoặc thêm màn hình/thành phần ngoài thiết kế.
- Trước khi code một màn hình, đọc đúng frame và các component/variant liên quan, ghi nhận kích thước frame, token/style, asset và các trạng thái hover, focus, disabled, loading, empty, error, validation nếu có; đối chiếu màn hình đó với yêu cầu nghiệp vụ và BPMN.
- Chỉ hiện thực responsive và trạng thái đã có thiết kế hoặc đã được BA chốt. Nếu thiếu frame, breakpoint, asset hay trạng thái làm thay đổi trải nghiệm, hỏi BA trước khi tự suy đoán.
- Sau khi code, mở ứng dụng ở cùng kích thước viewport với frame Figma, chụp ảnh và so sánh trực quan; sửa các khác biệt về bố cục, font, màu, khoảng cách, nội dung và trạng thái. Báo rõ màn hình/trạng thái nào đã đối chiếu và phần nào chưa kiểm tra được.
- Skill hoặc repo tham khảo chỉ hỗ trợ cách triển khai; không được thay thế quyết định thiết kế trong Figma. Nếu Figma mâu thuẫn với yêu cầu nghiệp vụ hoặc khả năng truy cập, nêu điểm mâu thuẫn để BA chốt.
- Với tác vụ thiết kế, xây dựng hoặc rà FE, phối hợp `design-taste-frontend` (quy trình **app screens** và kiểm tra ảnh chụp), `impeccable` (độ hoàn thiện của màn hình, trạng thái và UX), `ui-ux-pro-max` (tra cứu có mục tiêu về usability, accessibility và cách triển khai theo stack). Chỉ đọc phần phù hợp của từng skill để tiết kiệm ngữ cảnh.
- Không dùng các bộ màu, font, bố cục, motion hoặc nội dung do skill gợi ý để thay thế Figma. Nếu có cách cải thiện, ghi thành đề xuất cho BA duyệt trên thiết kế trước khi đổi FE.

## Tra cứu và sử dụng ngữ cảnh

- Với mỗi yêu cầu, tự chọn skill đã cài có liên quan trực tiếp và chỉ đọc phần hướng dẫn cần dùng; không cần người dùng nhắc tên skill. Yêu cầu đơn giản không cần ép dùng skill.
- Khi cần yêu cầu nghiệp vụ, bắt đầu từ mục liên quan trong `GHI_CHU_YEU_CAU.md`. Nếu cần chi tiết, làm mới cache bằng `tools/build_document_cache.py`, tìm trong `.context-cache/` và chỉ đọc đoạn khớp; xác nhận lại trong tài liệu gốc khi có mâu thuẫn hoặc quyết định quan trọng.
- Cache Markdown là bản trích xuất để tìm kiếm, không thay thế DOCX/XLSX gốc; hình ảnh, bảng và nội dung chưa trích được phải kiểm tra ở nguồn.
- Tìm tên file bằng `rg --files`, rồi tìm ký hiệu/nội dung bằng `rg -n` trong phạm vi liên quan trước khi đọc cả file hoặc thư mục.
- Khi sửa mã, chỉ xem phần phụ thuộc, nơi gọi và bài kiểm tra có liên quan; dùng `git diff` để rà lại thay đổi trước khi bàn giao.
- Chỉ dùng skill phù hợp với công việc và công nghệ đã chọn. Chỉ bổ sung công cụ lập đồ thị mã hoặc tìm kiếm cấu trúc khi source code đã đủ lớn và việc tìm kiếm hiện tại không còn hiệu quả.

## Kiểm chứng và bàn giao

- Chạy kiểm tra nhỏ nhất phù hợp với thay đổi; mở rộng khi thay đổi ảnh hưởng đến phần dùng chung.
- Báo rõ đã kiểm tra gì, kết quả ra sao và phần nào chưa thể kiểm tra. Không coi việc đọc mã là đã chạy thử.
- Cập nhật `README.md` khi cách cài đặt hoặc chạy dự án thay đổi.
