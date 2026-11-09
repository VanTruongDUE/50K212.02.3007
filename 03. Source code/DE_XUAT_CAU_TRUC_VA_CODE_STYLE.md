# Đề xuất cấu trúc dự án và quy ước code

BA đã chốt React cho FE, NestJS cho BE và PostgreSQL chạy bằng Docker cho CSDL. Các chi tiết chưa chốt (thư viện truy cập dữ liệu, tác vụ nền, tích hợp và phạm vi từng bước) sẽ quyết định khi triển khai chức năng liên quan. BA sẽ giao từng bước; chỉ tạo thư mục/mã nguồn cần cho bước được giao.

Thiết kế FE nằm trong [file Figma do BA cung cấp](https://www.figma.com/design/jXKaLKxLAOL4mVyC4cReYZ/M%C3%A0n-h%C3%ACnh-giao-di%E1%BB%87n_Nh%C3%B3m2?m=auto&t=qDMpQZq3qnBanuPp-1). Các repo dưới đây chỉ tham khảo cách tổ chức mã; khi triển khai giao diện, frame/component/asset và trạng thái trong Figma là chuẩn để đối chiếu. Quy trình chi tiết nằm trong `AGENTS.md`.
Khi thực hiện FE, dùng đồng thời các skill `design-taste-frontend`, `impeccable` và `ui-ux-pro-max` cho những phần việc phù hợp; mọi gợi ý thẩm mỹ phải được kiểm tra với Figma trước khi áp dụng.

## Phân biệt công nghệ và đề xuất FE/BE

React và NestJS đã được chọn cho hai phần khác nhau của ứng dụng:

| Công nghệ | Vai trò trong dự án |
| --- | --- |
| [HTML, CSS, JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/The_web_standards_model) | Nền tảng của giao diện web; dùng dù có chọn React hay không. |
| [React](https://react.dev/learn/describing-the-ui) | Thư viện FE để tổ chức màn hình và tương tác thành component; vẫn cần HTML/CSS. |
| [NestJS](https://docs.nestjs.com/first-steps) | Framework BE chạy trên Node.js, viết TypeScript cho API và nghiệp vụ. |
| PostgreSQL | Hệ quản trị CSDL; Docker dùng để chạy PostgreSQL trong môi trường phát triển. |

**Stack đã chốt:** React cho FE, NestJS cho BE, PostgreSQL chạy bằng Docker cho CSDL. Khung FE đã được tạo với TypeScript và Vite; khung BE dùng TypeScript. Lịch gửi email cần tiến trình chạy nền độc lập với phiên trình duyệt; chưa chọn thư viện hoặc hạ tầng chạy nền.

Chưa chốt thư viện gửi email, ORM, môi trường triển khai ngoài máy phát triển hay cách tích hợp Apollo/Google thực tế. Đối chiếu từng chức năng với BPMN và tài liệu yêu cầu trước khi triển khai.

## Repo tham khảo

| Repo | Điều có thể áp dụng | Giới hạn khi áp dụng |
| --- | --- | --- |
| [NestJS, mẫu SQL/TypeORM](https://github.com/nestjs/nest/tree/master/sample/05-sql-typeorm) và [tài liệu NestJS](https://github.com/nestjs/docs.nestjs.com/blob/master/content/first-steps.md) | Backend chia module theo nghiệp vụ; mỗi module giữ controller, service và dữ liệu liên quan gần nhau. | Không mặc định chọn TypeORM hoặc sao chép toàn bộ mẫu. |
| [NestJS, tài liệu queue](https://github.com/nestjs/docs.nestjs.com/blob/master/content/application/queues.md) | Công việc gửi email theo lịch, tìm kiếm lâu và xử lý phản hồi cần chạy độc lập với phiên trình duyệt. | Queue là phương án khi chọn NestJS; chưa quyết định Redis/BullMQ. |
| [Bulletproof React: project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) | Frontend chia `features` theo chức năng, đặt thành phần dùng riêng cùng chức năng; chỉ đưa mã dùng chung ra `components`/`lib` khi thật sự được chia sẻ. | Đây là hướng dẫn kiến trúc, không phải mẫu cần chép nguyên; mỗi feature chỉ có thư mục cần dùng. |

## Ranh giới nghiệp vụ đề xuất

Tách theo khả năng nghiệp vụ, không tách theo từng màn hình hoặc từng bảng trong SRS:

1. `auth-users`: đăng nhập, người dùng, vai trò và phạm vi truy cập.
2. `contact-search`: bộ tiêu chí, nguồn Apollo/Google, phiên tìm kiếm và lịch sử.
3. `contacts`: doanh nghiệp, Contact, làm sạch, danh sách và xác nhận.
4. `campaigns`: chiến dịch, duyệt danh sách, nội dung/mẫu email, người nhận và lịch gửi.
5. `sender-accounts`: tài khoản gửi, trạng thái kết nối và hạn mức.
6. `responses`: hộp thư phản hồi, phân loại, phân công, lịch sử xử lý và unsubscribe/bounce.
7. `follow-ups`: lịch nhắc, trạng thái thực hiện và kết quả.

`dashboard` là phần giao diện/tổng hợp đọc dữ liệu từ các module trên khi phạm vi triển khai được chốt; không cần một module ghi dữ liệu riêng chỉ vì có màn hình Dashboard. Tên module có thể điều chỉnh theo BPMN và quyền truy cập thực tế.

## Khung thư mục cho frontend và backend riêng

```text
03. Source code/
├── README.md
├── AGENTS.md
├── GHI_CHU_YEU_CAU.md
├── frontend/
│   └── src/
│       ├── app/                 # route, layout và cấu hình cấp ứng dụng
│       ├── features/            # contacts, campaigns, responses, follow-ups...
│       └── shared/              # chỉ phần thực sự dùng bởi nhiều feature
└── backend/
    └── src/
        ├── modules/             # các module nghiệp vụ tương ứng
        ├── integrations/        # adapter cho Apollo, Google, nhà cung cấp email
        └── config/              # cấu hình và kiểm tra biến môi trường
```

Chỉ tạo một thư mục khi có mã cần đặt vào đó. Giữ tác vụ gửi theo lịch trong backend ở giai đoạn đầu; tách worker thành tiến trình/dịch vụ riêng nếu yêu cầu vận hành đòi hỏi. Không tách `packages/`, microservice hay thư viện dùng chung trước khi có nhu cầu thực tế.

## Quy ước code đề xuất

- Tên module/thư mục thể hiện nghiệp vụ; tên hàm thể hiện hành động, tên biến thể hiện dữ liệu. Dùng quy ước của framework đã chọn cho kiểu chữ và tên file.
- Controller/view xử lý HTTP và kiểm tra đầu vào; logic quy tắc nghiệp vụ đặt trong service/use case của cùng module; adapter tích hợp xử lý lời gọi bên ngoài và lỗi từ nhà cung cấp.
- Quy tắc có ảnh hưởng nhiều module như unsubscribe toàn cục, khoảng cách gửi 7 ngày và hạn mức tài khoản phải có một nơi thực thi rõ ràng, tránh sao chép ở giao diện và các tác vụ gửi.
- Đặt kiểm tra gần hành vi cần bảo vệ: kiểm tra danh sách người nhận trước khi đặt lịch và kiểm tra lại trước lúc gửi, vì trạng thái Contact/tài khoản có thể thay đổi trong thời gian chờ.
- Phân biệt trạng thái nghiệp vụ với nhãn hiển thị. Dùng hằng số/enum cho trạng thái đã được BA chốt; không tự tạo thêm trạng thái từ bản phác thảo giao diện.
- Tác vụ gửi email cần ghi kết quả và lỗi theo từng người nhận, tránh gửi trùng khi thử lại; chi tiết chiến lược retry/khóa cần chốt cùng thiết kế triển khai.
- File cấu hình chứa tên biến môi trường và giá trị mẫu không bí mật; tài khoản thật, token và mật khẩu không vào Git.
- Định dạng/lint/type check theo công cụ chuẩn của stack đã chọn. Bài kiểm tra ưu tiên quy tắc nghiệp vụ và luồng quan trọng, không viết chỉ để lặp lại mã hiện có.

## Quyết định còn mở trước khi code phần liên quan

1. BA chỉ định chức năng/màn hình của từng bước; đối chiếu frame Figma tương ứng trước khi code FE.
2. Chốt các quy tắc còn khác nhau trong `GHI_CHU_YEU_CAU.md` trước khi code phần liên quan, gồm phân quyền và trạng thái Response/Follow-up.
3. Xác nhận API/quyền truy cập của Apollo, Google và nhà cung cấp email trước khi xây tích hợp, tác vụ nền và nhận phản hồi.

Khung tối thiểu đã được tạo bằng công cụ chính thức của React/Vite và NestJS. Khi BA giao một chức năng, chỉ thêm module và thư viện cần cho chức năng đó. Không copy nguyên repo mẫu chỉ vì repo tham khảo có sử dụng.
