export const selectionOptions: { key: 'role' | 'industry' | 'location' | 'size' | 'email'; label: string; options: string[] }[] = [
  { key: 'role', label: 'Chức vụ Contact', options: ['Giám đốc Marketing', 'Founder', 'Quản lý', 'Trưởng phòng'] },
  { key: 'industry', label: 'Ngành nghề / lĩnh vực', options: ['Phần mềm doanh nghiệp', 'Thương mại điện tử', 'Công nghệ', 'Bán lẻ'] },
  { key: 'location', label: 'Địa điểm / khu vực', options: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương'] },
  { key: 'size', label: 'Quy mô doanh nghiệp', options: ['51–200 nhân viên', '201–500 nhân viên', '1–10 nhân viên', '11–50 nhân viên'] },
  { key: 'email', label: 'Trạng thái email', options: ['Đã xác minh', 'Chưa xác minh', 'Catch-all'] },
]
