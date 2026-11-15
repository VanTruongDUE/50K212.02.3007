# Việc cần làm — Google Search/Web

Cập nhật: pipeline/FE đã triển khai. Các mục đánh dấu là đã kiểm chứng ở phạm vi fixture; chưa thay thế nghiệm thu live. Hợp đồng thực tế ở backend/API.md.

- [ ] S1 — Đã ghi nhận quy mô ước đoán độ tin cậy thấp/không lọc cứng, suy luận có nhãn và kiểm tra cú pháp email. Còn chốt lỗi một phần/ngân sách và xây dựng phương pháp ước đoán có kiểm chứng. Đạt khi capability matrix không còn mơ hồ, có bộ tiêu chí nghiệm thu.
- [x] S2 — Migration job/history/provenance + API tạo/đọc job bằng fixture. Phụ thuộc S1 về hình dạng dữ liệu. Đạt khi quyền owner, idempotency và rollback được test.
- [x] S3 — Adapter SerpAPI và query builder. Đạt khi query đúng, lỗi/quota/cache/phân trang được test bằng fixture và key không lộ.
- [x] S4 — Bộ tải trang và trích email có bằng chứng. Đạt khi timeout/body/redirect/DNS/SSRF được test, trường quan sát thiếu giữ null, suy luận được tách nhãn/provenance theo quyết định BA; email chung không có chức vụ cá nhân.
- [x] S5 — Worker + chuẩn hóa/đếm trùng/transaction hoàn tất. Phụ thuộc S2–S4. Đạt khi concurrency/restart/empty/failure và received=invalid+duplicate+new đúng trên PostgreSQL.
- [x] Mốc A — Pipeline API bằng fixture chạy từ đầu đến cuối, tests/build/lint đạt; chưa gọi live.
- [x] S6 — Nối criteria/review/searching/results/empty/error ở FE. Đạt khi dùng dữ liệu API thật, giữ layout/steps, refresh và double-click đúng.
- [x] S7 — Nối history/detail/all-contacts với check/confirm/export hiện có. Đạt khi snapshot/counts/phân trang đúng và lịch sử lỗi không giả thành rỗng.
- [ ] S8 — Hồi quy role Trưởng phòng duyệt/từ chối và Nhân viên tạo chiến dịch. Đạt khi rule suppression/7 ngày/Gmail không đổi.
- [ ] Mốc B — Chụp ảnh và thao tác Brave cho các frame liên quan ở 1440/1366/1280, kiểm tra states và accessibility.
- [ ] S9 — Cấu hình SERPAPI_API_KEY và ngân sách, test live bộ tiêu chí BA cung cấp. Đạt khi có evidence nguồn, credit và phân biệt email chưa xác minh.
- [ ] S10 — Hoàn thiện README/API/.env.example rỗng, báo cáo PASS/FAIL/NOT RUN, rà secret, commit/push theo yêu cầu.

Bước làm ngay tiếp theo: S1; trong lúc chờ có thể chuẩn bị fixture/migration design, không tự chốt hành vi còn mở hoặc tiêu credit.

Chưa đạt S9 do chưa có SERPAPI_API_KEY. Figma Bridge không kết nối nên Mốc B mới kiểm tra browser/screenshot, chưa so frame trực tiếp. Chưa tự commit/push trong lượt này.
