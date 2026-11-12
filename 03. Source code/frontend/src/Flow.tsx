import { useEffect, useState } from 'react'
import { demoContacts } from './demoContacts'
import { createContactExport, type ExportFormat } from './exportContacts'
import './flow.css'

type Criteria = {
  role: string[]
  industry: string[]
  location: string[]
  keyword: string
  size: string[]
  email: string[]
  source: 'Google Search/Web' | 'Apollo' | ''
}
type Template = { id: string; name: string; role: string; keyword: string; location: string; size: string; criteria?: Criteria }
type Props = { screen: string; go: (screen: string) => void; searchUnavailable?: boolean }

const emptyCriteria: Criteria = { role: [], industry: [], location: [], keyword: '', size: [], email: [], source: '' }
const sampleCriteria: Criteria = { role: ['Giám đốc Marketing'], industry: ['Phần mềm doanh nghiệp'], location: ['Hà Nội'], keyword: 'SaaS, B2B', size: ['51–200 nhân viên'], email: ['Đã xác minh'], source: 'Google Search/Web' }
const startingTemplates: Template[] = [
  { id: 'FT-024', name: 'B2B SaaS – Hà Nội', role: 'Giám đốc Marketing', keyword: 'SaaS, B2B', location: 'Hà Nội', size: '51–200 nhân viên' },
  { id: 'FT-021', name: 'SaaS – TP. HCM', role: 'Founder', keyword: 'SaaS', location: 'TP. Hồ Chí Minh', size: '11–50 nhân viên' },
  { id: 'FT-022', name: 'Cloud B2B – Hà Nội', role: 'Giám đốc', keyword: 'Cloud, B2B', location: 'Hà Nội', size: '201–500 nhân viên' },
  { id: 'FT-023', name: 'Fintech – TP. HCM', role: 'Trưởng phòng', keyword: 'Fintech', location: 'TP. Hồ Chí Minh', size: '51–200 nhân viên' },
  { id: 'FT-025', name: 'SaaS – Đà Nẵng', role: 'Giám đốc Marketing', keyword: 'SaaS', location: 'Đà Nẵng', size: '11–50 nhân viên' },
]
const historyRows = [
  ['04/11/2026 09:30', 'Nhân viên Marketing', 'Google Search/Web', '38 Contact'],
  ['04/11/2026 08:45', 'Nhân viên Marketing', 'Google Search/Web', '24 Contact'],
  ['03/11/2026 16:20', 'Nhân viên Marketing', 'Google Search/Web', '16 Contact'],
  ['03/11/2026 11:05', 'Nhân viên Marketing', 'Google Search/Web', '0 Contact'],
  ['02/11/2026 14:10', 'Nhân viên Marketing', 'Google Search/Web', '12 Contact'],
]
const formats: ExportFormat[] = ['CSV', 'XLSX', 'JSON', 'XML']
const selectionOptions: { key: 'role' | 'industry' | 'location' | 'size' | 'email'; label: string; options: string[] }[] = [
  { key: 'role', label: 'Chức vụ Contact', options: ['Giám đốc Marketing', 'Founder', 'Quản lý', 'Trưởng phòng'] },
  { key: 'industry', label: 'Ngành nghề / lĩnh vực', options: ['Phần mềm doanh nghiệp', 'Thương mại điện tử', 'Công nghệ', 'Bán lẻ'] },
  { key: 'location', label: 'Địa điểm / khu vực', options: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương'] },
  { key: 'size', label: 'Quy mô doanh nghiệp', options: ['51–200 nhân viên', '201–500 nhân viên', '1–10 nhân viên', '11–50 nhân viên'] },
  { key: 'email', label: 'Trạng thái email', options: ['Đã xác minh', 'Chưa xác minh', 'Catch-all'] },
]
const criteriaLabels: { key: keyof Criteria; label: string }[] = [
  { key: 'role', label: 'Chức vụ Contact' }, { key: 'industry', label: 'Ngành nghề / lĩnh vực' },
  { key: 'location', label: 'Địa điểm / khu vực' }, { key: 'keyword', label: 'Từ khóa doanh nghiệp' },
  { key: 'size', label: 'Quy mô doanh nghiệp' }, { key: 'email', label: 'Trạng thái email' },
]
const pages: Record<string, [string, string, 'search' | 'contacts']> = {
  criteria: ['Thiết lập tiêu chí', 'Chọn tiêu chí và nguồn để tìm Contact.', 'search'],
  'criteria-adjust': ['Điều chỉnh tiêu chí', 'Bổ sung điều kiện tìm kiếm rồi kiểm tra lại.', 'search'],
  'criteria-invalid': ['Tiêu chí cần điều chỉnh', 'Từ khóa chỉ chứa khoảng trắng. Các lựa chọn khác vẫn được giữ nguyên.', 'search'],
  'criteria-checking': ['Đang kiểm tra tiêu chí', 'Đang kiểm tra các điều kiện đã nhập. Chưa ghi nhận bộ tiêu chí mới.', 'search'],
  'criteria-check-error': ['Chưa kiểm tra được tiêu chí', 'Chưa nhận được kết quả kiểm tra. Giữ nguyên dữ liệu bên dưới và thử lại.', 'search'],
  templates: ['Filter Template', 'Xem, tạo và cập nhật bộ tiêu chí tìm kiếm.', 'search'],
  'template-empty': ['Chưa có Filter Template', 'Lưu bộ tiêu chí để sử dụng cho những lần tìm kiếm sau.', 'search'],
  'template-load-error': ['Không thể tải Filter Template', 'Chưa truy xuất được danh sách. Bộ tiêu chí hiện tại chưa bị thay đổi.', 'search'],
  'template-create': ['Tạo Filter Template', 'Đặt tên và lưu bộ tiêu chí để dùng lại.', 'search'],
  'template-edit': ['Cập nhật Filter Template', 'Chỉnh sửa bộ tiêu chí của Filter Template.', 'search'],
  'template-name-missing': ['Chưa nhập tên Template', 'Vui lòng nhập tên trước khi tạo. Bộ tiêu chí đã chọn vẫn được giữ nguyên.', 'search'],
  'template-name-duplicate': ['Tên Template cần điều chỉnh', 'Chưa tạo Template. Giữ nguyên bộ tiêu chí và đổi tên để tiếp tục.', 'search'],
  'template-save-error': ['Tạo Template không thành công', 'Không lưu được Template. Tên và bộ tiêu chí bên dưới vẫn được giữ nguyên.', 'search'],
  review: ['Bộ tiêu chí hợp lệ', 'Các điều kiện đã vượt qua kiểm tra. Xác nhận để tiếp tục tìm kiếm.', 'search'],
  'review-recording': ['Đang ghi nhận tiêu chí', 'Vui lòng chờ. Chỉ tiếp tục tìm kiếm sau khi ghi nhận hoàn tất.', 'search'],
  'review-success': ['Thiết lập tiêu chí thành công', 'Bộ tiêu chí đã được ghi nhận cho lần tìm kiếm hiện tại.', 'search'],
  'review-error': ['Thiết lập không thành công', 'Chưa ghi nhận bộ tiêu chí mới. Bản nháp bên dưới vẫn còn để bạn kiểm tra và thử lại.', 'search'],
  'template-created': ['Đã tạo Filter Template', 'Template đã được lưu. Kiểm tra và xác nhận lại trước khi áp dụng tiêu chí cho lần tìm kiếm.', 'search'],
  searching: ['Đang tìm kiếm Contact', 'Hệ thống đang xử lý yêu cầu tìm kiếm.', 'search'],
  results: ['Kết quả tìm kiếm', 'Hiển thị 5 trong 38 Contact mới hợp lệ.', 'search'],
  'search-empty': ['Không tìm thấy Contact phù hợp', 'Hãy điều chỉnh tiêu chí hoặc chọn nguồn khác.', 'search'],
  'search-error': ['Tìm kiếm không thành công', 'Yêu cầu tìm kiếm chưa hoàn tất.', 'search'],
  'apollo-unavailable': ['Không thể tìm kiếm qua Apollo', 'Cấu hình kết nối Apollo hiện không khả dụng.', 'search'],
  'apollo-empty': ['Không tìm thấy Contact phù hợp', 'Apollo đã trả về phản hồi hợp lệ nhưng không có Contact phù hợp.', 'search'],
  history: ['Lịch sử tìm kiếm', 'Xem lại nguồn và kết quả của từng lần tìm kiếm.', 'search'],
  'history-empty': ['Chưa có lịch sử tìm kiếm', 'Bắt đầu tìm kiếm để tạo lịch sử.', 'search'],
  'history-load-error': ['Không thể tải lịch sử tìm kiếm', 'Chưa truy xuất được lịch sử. Hãy thử tải lại; bộ tiêu chí hiện tại không thay đổi.', 'search'],
  'history-detail': ['Chi tiết lần tìm kiếm', 'Xem tiêu chí và kết quả của lần tìm kiếm đã lưu.', 'search'],
  'contact-lists': ['Danh sách Contact', 'Các danh sách Contact đã lưu từ những lần tìm kiếm.', 'contacts'],
  'contact-list-detail': ['Chi tiết danh sách Contact', 'Contact đã lưu từ lần tìm kiếm được chọn.', 'contacts'],
  check: ['Kiểm tra danh sách Contact', 'Rà soát danh sách và lưu kết quả kiểm tra.', 'contacts'],
  'check-save-error': ['Không lưu được kết quả kiểm tra', 'Kết quả và trạng thái trước thao tác được giữ nguyên. Rà soát lựa chọn rồi lưu lại.', 'contacts'],
  'check-rejected': ['Danh sách chưa đạt yêu cầu', 'Rà soát lại danh sách trước khi xác nhận.', 'contacts'],
  confirm: ['Xác nhận danh sách Contact', 'Danh sách đạt yêu cầu và đang chờ xác nhận.', 'contacts'],
  'confirm-error': ['Xác nhận không thành công', 'Chưa cập nhật được trạng thái. Danh sách vẫn chưa xác nhận; dữ liệu Contact được giữ nguyên.', 'contacts'],
  confirmed: ['Danh sách đã xác nhận', 'Hiển thị 5 trong 38 Contact đã xác nhận.', 'contacts'],
  'all-contacts': ['Toàn bộ Contact', 'Hiển thị danh sách Contact của lần tìm kiếm.', 'contacts'],
  export: ['Xuất danh sách Contact', 'Chọn định dạng tệp để xuất danh sách Contact.', 'contacts'],
  'export-loading': ['Đang tạo tệp CSV', 'Đang xuất 38 Contact trong danh sách SR-2026-1104. Dữ liệu nguồn được giữ nguyên.', 'contacts'],
  'export-success': ['Xuất dữ liệu thành công', 'Tệp xuất đã sẵn sàng.', 'contacts'],
  'export-error': ['Xuất dữ liệu không thành công', 'Tệp xuất chưa được tạo.', 'contacts'],
  'data-unavailable': ['Không thể truy cập dữ liệu', 'Dữ liệu không khả dụng hoặc quyền truy cập bị giới hạn.', 'search'],
  'load-error': ['Không thể tải dữ liệu', 'Vui lòng thử tải lại dữ liệu.', 'search'],
  'save-error': ['Không thể lưu thay đổi', 'Thay đổi chưa được lưu.', 'search'],
}
const messageActions: Record<string, [string, string]> = {
  'search-empty': ['Quay lại', 'criteria'], 'search-error': ['Quay lại', 'criteria'],
  'apollo-unavailable': ['Chọn lại nguồn', 'criteria'], 'apollo-empty': ['Điều chỉnh tiêu chí', 'criteria'],
  'template-empty': ['Tạo Filter Template', 'template-create'], 'template-load-error': ['Tải lại Template', 'templates'],
  'history-empty': ['Thiết lập tìm kiếm', 'criteria'], 'history-load-error': ['Tải lại lịch sử', 'history'],
  'check-rejected': ['Quay lại danh sách', 'check'], 'export-success': ['Quay lại danh sách', 'confirmed'],
  'export-error': ['Quay lại danh sách', 'confirmed'], 'data-unavailable': ['Quay lại', 'criteria'],
  'load-error': ['Quay lại danh sách', 'criteria'], 'save-error': ['Quay lại', 'criteria'],
}

function Button({ children, onClick, primary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean }) {
  return <button className={'flow-button' + (primary ? ' primary' : '')} type="button" disabled={disabled} onClick={onClick}>{children}</button>
}
function Actions({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flow-actions"><div>{left}</div><div>{right}</div></div>
}
function Heading({ screen, selected, go, returnScreen = 'check' }: { screen: string; selected: boolean; go: (screen: string) => void; returnScreen?: string }) {
  const [title, description, group] = pages[screen] ?? pages.criteria
  const parentScreen = screen === 'all-contacts' ? returnScreen : group === 'contacts' ? 'contact-lists' : 'criteria'
  const parentLabel = screen === 'all-contacts' ? pages[returnScreen]?.[0] ?? 'Danh sách Contact' : group === 'contacts' ? 'Danh sách Contact' : 'Tìm kiếm Contact'
  return <><nav className="breadcrumb" aria-label="Đường dẫn">{screen === 'contact-lists' ? <span aria-current="page">{title}</span> : <><button type="button" onClick={() => go(parentScreen)}>{parentLabel}</button><span aria-hidden="true">›</span><span aria-current="page">{title}</span></>}</nav>{screen !== 'all-contacts' && <header className="flow-heading"><h1>{title}</h1><p>{selected && screen === 'criteria' ? 'Kiểm tra các điều kiện đang chọn trước khi tìm kiếm.' : description}</p></header>}</>
}
function Metrics({ historyCount }: { historyCount?: number }) {
  const known = historyCount === undefined || historyCount === 38
  return <div className="metrics"><div><span>Contact nhận được</span><strong>{known ? '48 Contact' : '—'}</strong></div><div><span>Không hợp lệ</span><strong>{known ? '7 Contact' : '—'}</strong></div><div><span>Trùng lặp</span><strong>{known ? '3 Contact' : '—'}</strong></div><div><span>Contact mới hợp lệ</span><strong>{historyCount ?? 38} Contact</strong></div></div>
}
function ContactTable({ rows = demoContacts.slice(0, 5) }: { rows?: readonly (typeof demoContacts)[number][] }) {
  return <table className="flow-table"><thead><tr><th>Contact</th><th>Email</th><th>Chức vụ</th><th>Doanh nghiệp</th></tr></thead><tbody>{rows.map(contact => <tr key={contact.email}><td>{contact.name}</td><td>{contact.email}</td><td>{contact.role}</td><td>{contact.company}</td></tr>)}</tbody></table>
}
function CriteriaSummary({ criteria }: { criteria: Criteria }) {
  return <div className="criteria-summary">{criteriaLabels.map(({ key, label }) => <div key={key}><span>{label}</span><strong>{Array.isArray(criteria[key]) ? (criteria[key] as string[]).join(', ') || '—' : (criteria[key] as string) || '—'}</strong></div>)}</div>
}
function HistorySummary({ criteria }: { criteria: Criteria }) {
  return <div className="history-summary">
    <span>Contact: Alex Morgan · Chức vụ: {criteria.role.join(', ') || '—'}</span>
    <span>Ngành nghề / lĩnh vực: {criteria.industry.join(', ') || '—'}</span>
    <span>Từ khóa doanh nghiệp: {criteria.keyword || '—'}</span>
    <span>Địa điểm / khu vực: {criteria.location.join(', ') || '—'}</span>
    <span>Quy mô doanh nghiệp: {criteria.size.join(', ') || '—'}</span>
    <span>Email: alex.morgan@example.com · Trạng thái: {criteria.email.join(', ') || '—'}</span>
  </div>
}
function Notice({ kind = 'info', children }: { kind?: 'info' | 'warning' | 'error' | 'success'; children: React.ReactNode }) {
  return <div className={'flow-notice ' + kind} role={kind === 'error' ? 'alert' : undefined}>{children}</div>
}

export default function Flow({ screen, go, searchUnavailable = false }: Props) {
  const [criteria, setCriteria] = useState<Criteria>(() => {
    if (screen === 'criteria') {
      const applied = sessionStorage.getItem('v5-applied-filter')
      if (applied) {
        sessionStorage.removeItem('v5-applied-filter')
        try {
          const value = JSON.parse(applied) as Partial<Criteria>
          const fields = ['role', 'industry', 'location', 'size', 'email'] as const
          if (typeof value.keyword === 'string' &&
              fields.every(key => Array.isArray(value[key]) && value[key].every(item => typeof item === 'string')) &&
              ['Google Search/Web', 'Apollo', ''].includes(value.source ?? '')) {
            return { ...emptyCriteria, ...value }
          }
        } catch { /* Ignore a stale local draft. */ }
      }
    }
    return screen === 'criteria-invalid' ? { ...sampleCriteria, keyword: '   ' } : ['criteria', 'criteria-adjust'].includes(screen) ? emptyCriteria : sampleCriteria
  })
  const [templates, setTemplates] = useState<Template[]>(startingTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [templateName, setTemplateName] = useState(screen === 'template-name-missing' ? '' : 'B2B SaaS – Hà Nội')
  const [format, setFormat] = useState<ExportFormat | ''>(screen === 'export-loading' || screen === 'export-success' ? 'CSV' : '')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [contactPage, setContactPage] = useState(1)
  const [allContactsReturn, setAllContactsReturn] = useState('check')
  const [historyIndex, setHistoryIndex] = useState(0)
  const [searchTerm, setSearchTerm] = useState<Record<string, string>>({})
  const [sourceError, setSourceError] = useState(false)

  useEffect(() => {
    if (screen !== 'searching') return
    const timer = window.setTimeout(() => go('results'), 1100)
    return () => window.clearTimeout(timer)
  }, [screen, go])
  useEffect(() => {
    if (screen !== 'export-loading' && !(screen === 'export-success' && !downloadUrl)) return
    let cancelled = false
    createContactExport(format || 'CSV', demoContacts.slice(0, 38)).then(blob => {
      if (cancelled) return
      setDownloadUrl(URL.createObjectURL(blob))
      if (screen === 'export-loading') go('export-success')
    }).catch(() => { if (!cancelled) go('export-error') })
    return () => { cancelled = true }
  }, [screen, format, downloadUrl, go])
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }, [downloadUrl])

  function toggle(key: 'role' | 'industry' | 'location' | 'size' | 'email', option: string) {
    setCriteria(current => ({ ...current, [key]: current[key].includes(option) ? current[key].filter(item => item !== option) : [...current[key], option] }))
  }
  function checkCriteria() {
    if (criteria.keyword && !criteria.keyword.trim()) { go('criteria-invalid'); return }
    if (!criteriaLabels.some(({ key }) => Array.isArray(criteria[key]) ? (criteria[key] as string[]).length > 0 : Boolean((criteria[key] as string).trim()))) { go('criteria-adjust'); return }
    if (!criteria.source) { setSourceError(true); return }
    setSourceError(false)
    go('review')
  }
  function saveTemplate(edit: boolean) {
    const name = templateName.trim()
    if (!name) { go('template-name-missing'); return }
    if (templates.some((item, index) => item.name.toLowerCase() === name.toLowerCase() && (!edit || index !== selectedTemplate))) { go('template-name-duplicate'); return }
    const item: Template = { id: edit ? templates[selectedTemplate].id : 'FT-' + String(26 + templates.length - startingTemplates.length).padStart(3, '0'), name, role: criteria.role.join(', '), keyword: criteria.keyword, location: criteria.location.join(', '), size: criteria.size.join(', '), criteria: { ...criteria } }
    setTemplates(current => edit ? current.map((old, index) => index === selectedTemplate ? item : old) : [...current, item])
    go(edit ? 'templates' : 'template-created')
  }
  function applyTemplate() {
    const item = templates[selectedTemplate]
    if (!item) return
    setCriteria(item.criteria ?? { ...emptyCriteria, role: item.role ? item.role.split(', ') : [], location: item.location ? item.location.split(', ') : [], keyword: item.keyword, size: item.size ? item.size.split(', ') : [] })
    go('criteria')
  }
  function editTemplate() {
    const item = templates[selectedTemplate]
    if (!item) return
    setTemplateName(item.name)
    setCriteria(item.criteria ?? { ...emptyCriteria, role: item.role ? item.role.split(', ') : [], location: item.location ? item.location.split(', ') : [], keyword: item.keyword, size: item.size ? item.size.split(', ') : [] })
    go('template-edit')
  }
  function showAllContacts() {
    setContactPage(1)
    setAllContactsReturn(screen)
    go('all-contacts')
  }

  const criteriaScreens = ['criteria', 'criteria-adjust', 'criteria-invalid', 'criteria-checking', 'criteria-check-error']
  const templateEditorScreens = ['template-create', 'template-edit', 'template-name-missing', 'template-name-duplicate', 'template-save-error']
  const reviewScreens = ['review', 'review-recording', 'review-success', 'review-error', 'template-created']
  const resultScreens = ['results', 'check', 'check-save-error', 'confirmed', 'history-detail', 'contact-list-detail']
  const messageScreens = ['search-empty', 'search-error', 'apollo-unavailable', 'apollo-empty', 'template-empty', 'template-load-error', 'history-empty', 'history-load-error', 'check-rejected', 'export-success', 'export-error', 'data-unavailable', 'load-error', 'save-error']
  const selectedHistoryIndex = screen === 'contact-lists' && historyRows[historyIndex]?.[3] === '0 Contact' ? 0 : historyIndex
  const selectedHistory = historyRows[selectedHistoryIndex] ?? historyRows[0]
  const historyCount = Number.parseInt(selectedHistory[3], 10)
  // shortcut: older searches reuse sample Contacts; replace with each search's rows when source data exists.
  const historyContacts = selectedHistoryIndex === 0 ? demoContacts : demoContacts.slice(selectedHistoryIndex * 5, selectedHistoryIndex * 5 + historyCount)
  const showingHistory = ['history-detail', 'contact-list-detail'].includes(screen) || screen === 'all-contacts' && ['history-detail', 'contact-list-detail'].includes(allContactsReturn)
  const currentContacts = showingHistory ? historyContacts : demoContacts
  const sourceLine = 'Nguồn: ' + (showingHistory ? selectedHistory[2] : criteria.source) + '  ·  ' + (showingHistory ? selectedHistory[0] : '04/11/2026 09:30')
  const criteriaBusy = screen === 'criteria-checking'
  const reviewBusy = screen === 'review-recording'
  const selectedCriteria = criteriaLabels.flatMap(({ key }) => Array.isArray(criteria[key]) ? criteria[key] as string[] : (criteria[key] as string).trim() ? [criteria[key] as string] : [])
  const visibleHistoryRows = screen === 'contact-lists' ? historyRows.filter(row => row[3] !== '0 Contact') : historyRows

  return <div className="flow-content"><Heading screen={screen} selected={selectedCriteria.length > 0} go={go} returnScreen={allContactsReturn} />
    {criteriaScreens.includes(screen) && <>
      <div className="criteria-status"><strong>{screen === 'criteria-adjust' ? 'Cần điều chỉnh' : 'Đang chọn'}</strong>{screen === 'criteria-adjust' ? <span>Nhập ít nhất một điều kiện có giá trị, rồi kiểm tra lại.</span> : selectedCriteria.length ? <button type="button" className="criteria-chip" onClick={() => setCriteria(current => ({ ...emptyCriteria, source: current.source }))} aria-label="Xóa các tiêu chí đã chọn">{selectedCriteria.join(' · ')} <span aria-hidden="true">×</span></button> : <span>Chưa chọn tiêu chí</span>}</div>
      <div className="criteria-grid">
        {selectionOptions.slice(0, 3).map(group => <section className="criteria-card" key={group.key}><h2>{group.label}</h2><input aria-label={'Tìm ' + group.label} placeholder="Tìm trong danh sách..." value={searchTerm[group.key] ?? ''} disabled={criteriaBusy} onChange={e => setSearchTerm(current => ({ ...current, [group.key]: e.target.value }))} />{group.options.filter(option => option.toLocaleLowerCase().includes((searchTerm[group.key] ?? '').toLocaleLowerCase())).map(option => <label key={option}><input type="checkbox" checked={criteria[group.key].includes(option)} disabled={criteriaBusy} onChange={() => toggle(group.key, option)} />{option}</label>)}</section>)}
        <section className="criteria-card"><h2>Từ khóa doanh nghiệp</h2><input aria-label="Từ khóa doanh nghiệp" placeholder="Nhập từ khóa doanh nghiệp..." value={criteria.keyword} disabled={criteriaBusy} aria-invalid={screen === 'criteria-invalid'} onChange={e => setCriteria(current => ({ ...current, keyword: e.target.value }))} />{screen === 'criteria-invalid' && <span className="flow-field-error" role="alert">Từ khóa không được chỉ gồm khoảng trắng. Nhập từ khóa hoặc bỏ điều kiện này.</span>}</section>
        {selectionOptions.slice(3).map(group => <section className="criteria-card" key={group.key}><h2>{group.label}</h2><input aria-label={'Tìm ' + group.label} placeholder="Tìm trong danh sách..." value={searchTerm[group.key] ?? ''} disabled={criteriaBusy} onChange={e => setSearchTerm(current => ({ ...current, [group.key]: e.target.value }))} />{group.options.filter(option => option.toLocaleLowerCase().includes((searchTerm[group.key] ?? '').toLocaleLowerCase())).map(option => <label key={option}><input type="checkbox" checked={criteria[group.key].includes(option)} disabled={criteriaBusy} onChange={() => toggle(group.key, option)} />{option}</label>)}</section>)}
      </div>
       <div className="source-row"><strong>Nguồn tìm kiếm</strong>{(['Google Search/Web', 'Apollo'] as const).map(source => <label key={source}><input type="checkbox" checked={criteria.source === source} disabled={criteriaBusy} aria-invalid={sourceError} aria-describedby={sourceError ? 'source-error' : undefined} onChange={() => { setCriteria(current => ({ ...current, source })); setSourceError(false) }} />{source}</label>)}</div>
       {sourceError && <span className="flow-field-error" id="source-error" role="alert">Chọn Google Search/Web hoặc Apollo trước khi tiếp tục.</span>}
        <Actions left={<><Button disabled={criteriaBusy} onClick={() => go('templates')}>Xem Filter Template</Button>{searchUnavailable && <small role="status">Google Search chưa được kết nối; hãy cấu hình dịch vụ để tìm kiếm.</small>}</>} right={<Button primary disabled={criteriaBusy || searchUnavailable} onClick={checkCriteria}>{criteriaBusy ? 'Đang kiểm tra…' : screen === 'criteria-invalid' ? 'Kiểm tra lại' : screen === 'criteria-check-error' ? 'Thử kiểm tra lại' : 'Kiểm tra tiêu chí'}</Button>} />
    </>}

    {screen === 'templates' && <>
      <section className="flow-panel"><table className="flow-table"><thead><tr><th>Template</th><th>Chức vụ Contact</th><th>Từ khóa</th><th>Khu vực</th><th>Quy mô doanh nghiệp</th></tr></thead><tbody>{templates.map((item, index) => <tr key={item.id} className={selectedTemplate === index ? 'selected-row' : ''} onClick={() => setSelectedTemplate(index)}><td><button className="table-select" type="button" onClick={() => setSelectedTemplate(index)}>{item.name}</button><small>{item.id}</small></td><td>{item.role}</td><td>{item.keyword}</td><td>{item.location}</td><td>{item.size}</td></tr>)}</tbody></table><p className="panel-footnote">Đang chọn: {templates[selectedTemplate]?.id} · {templates[selectedTemplate]?.name}</p></section>
      <Actions left={<><Button onClick={editTemplate}>Cập nhật Template</Button><Button onClick={() => { setTemplateName(''); go('template-create') }}>Tạo Template</Button></>} right={<Button primary onClick={applyTemplate}>Xem / áp dụng tiêu chí</Button>} />
    </>}

    {templateEditorScreens.includes(screen) && <><section className="flow-panel template-editor">
      <label className="editor-name">Tên Filter Template<input value={templateName} aria-invalid={screen === 'template-name-missing' || screen === 'template-name-duplicate'} onChange={e => setTemplateName(e.target.value)} /></label>
      {(screen === 'template-name-missing' || screen === 'template-name-duplicate') && <span className="flow-field-error" role="alert">{screen === 'template-name-missing' ? 'Vui lòng nhập tên Template; tên không được chỉ gồm khoảng trắng.' : 'Tên này đã tồn tại trong phạm vi lưu trữ. Vui lòng nhập tên khác.'}</span>}
      <div className="editor-grid">{criteriaLabels.map(({ key, label }) => <label key={key}>{label}{key === 'keyword' ? <input value={criteria.keyword} onChange={e => setCriteria(current => ({ ...current, keyword: e.target.value }))} /> : <select value={(criteria[key] as string[])[0] ?? ''} onChange={e => setCriteria(current => ({ ...current, [key]: e.target.value ? [e.target.value] : [] }))}><option value="">Chọn điều kiện</option>{selectionOptions.find(item => item.key === key)?.options.map(option => <option key={option}>{option}</option>)}</select>}</label>)}</div>
      <p>Chỉ nhập những điều kiện sử dụng cho lần tìm kiếm.</p>
    </section><Actions left={<Button onClick={() => go('templates')}>Xem Filter Template</Button>} right={<Button primary onClick={() => saveTemplate(screen === 'template-edit')}>{screen === 'template-edit' ? 'Lưu cập nhật' : screen === 'template-save-error' ? 'Thử lưu lại' : 'Tạo Template'}</Button>} /></>}

    {reviewScreens.includes(screen) && <><section className="flow-panel review-panel"><h2>Bộ tiêu chí tìm kiếm</h2><CriteriaSummary criteria={criteria} /><div className="review-source"><strong>Nguồn tìm kiếm</strong><span>{criteria.source}</span></div><p>Lưu thành Template để dùng lại. Tìm kiếm chỉ bắt đầu khi bạn xác nhận.</p></section><Actions left={<><Button disabled={reviewBusy} onClick={() => go('criteria')}>Điều chỉnh tiêu chí</Button><Button disabled={reviewBusy} onClick={() => { setTemplateName(''); go('template-create') }}>Lưu thành Template</Button></>} right={<Button primary disabled={reviewBusy} onClick={() => go(screen === 'review-success' || screen === 'template-created' ? 'searching' : 'review-success')}>{reviewBusy ? 'Đang ghi nhận…' : screen === 'review-success' ? 'Tìm kiếm Contact' : screen === 'review-error' ? 'Thử ghi nhận lại' : screen === 'template-created' ? 'Xác nhận tiêu chí' : 'Xác nhận và tìm kiếm'}</Button>} /></>}

    {screen === 'searching' && <><Notice>Đang gửi và xử lý yêu cầu từ nguồn đã chọn.<br />Chưa có kết quả cuối cùng. Vui lòng chờ, không gửi lại yêu cầu.</Notice><Actions right={<Button primary disabled>Đang tìm kiếm…</Button>} /></>}

    {resultScreens.includes(screen) && <><section className={"flow-panel result-panel" + (showingHistory ? " history-detail-panel" : "")}><p className="source-line">{sourceLine}</p><Metrics historyCount={showingHistory ? historyCount : undefined} />{screen === 'confirmed' && <p className="result-caption">Kết quả kiểm tra: Đạt yêu cầu<br />Trạng thái danh sách: Đã xác nhận</p>}{(!showingHistory || historyCount > 0) && <p className="table-overline"><button type="button" onClick={showAllContacts}>{screen === 'history-detail' ? 'Hiển thị toàn bộ contact' : 'Xem toàn bộ Contact'}</button></p>}{showingHistory && historyCount === 0 ? <p className="panel-footnote">Lần tìm kiếm này không có Contact mới.</p> : <ContactTable rows={showingHistory ? historyContacts.slice(0, 5) : undefined} />}{showingHistory && (historyIndex === 0 ? <HistorySummary criteria={sampleCriteria} /> : <p className="panel-footnote">Contact hiển thị là dữ liệu mẫu, không phải kết quả thực của lần tìm kiếm này; tiêu chí chi tiết chưa có trong Figma.</p>)}{screen === 'check' || screen === 'check-save-error' ? <p className="panel-footnote">Rà soát chức danh, ngành nghề, quy mô, vị trí và chất lượng email.<br />Email: định dạng · tên miền · khả năng sử dụng từ nguồn · trùng lặp.<br />Lưu kết quả kiểm tra không tự xác nhận danh sách.</p> : null}</section><Actions left={screen === 'results' ? <Button onClick={() => go('history')}>Lịch sử tìm kiếm</Button> : showingHistory ? <Button onClick={() => go(screen === 'contact-list-detail' ? 'contact-lists' : 'history')}>{screen === 'history-detail' ? 'Quay lại lịch sử' : 'Quay lại danh sách'}</Button> : screen === 'check' || screen === 'check-save-error' ? <Button onClick={() => go('check-rejected')}>Lưu: Chưa đạt yêu cầu</Button> : null} right={screen === 'results' ? <Button primary onClick={() => go('check')}>Kiểm tra danh sách</Button> : screen === 'check' || screen === 'check-save-error' ? <Button primary onClick={() => go('confirm')}>{screen === 'check-save-error' ? 'Thử lưu: Đạt yêu cầu' : 'Lưu: Đạt yêu cầu'}</Button> : screen === 'confirmed' ? <Button primary onClick={() => go('export')}>Xuất danh sách</Button> : null} /></>}

    {(screen === 'confirm' || screen === 'confirm-error') && <><section className="flow-panel confirm-panel"><h2>SR-2026-1104 · B2B SaaS – Hà Nội</h2><p>Nguồn: {criteria.source}　·　Thời điểm tìm kiếm: 04/11/2026 09:30</p><div className="confirmation-status"><strong>Kết quả kiểm tra: Đạt yêu cầu</strong><strong>Trạng thái xác nhận: Chưa xác nhận</strong></div><Metrics /><h2>Tiêu chí đã sử dụng</h2><CriteriaSummary criteria={criteria} /><p className="contact-list-heading"><span>Contact trong danh sách</span><button type="button" onClick={showAllContacts}>Xem toàn bộ Contact</button></p><ContactTable /></section><Actions left={<Button onClick={() => go('check')}>Quay lại</Button>} right={<Button primary onClick={() => go('confirmed')}>{screen === 'confirm-error' ? 'Thử xác nhận lại' : 'Xác nhận danh sách'}</Button>} /></>}

    {screen === 'all-contacts' && <><section className="flow-panel all-contacts"><p className="source-line">{sourceLine}</p><h2>Toàn bộ Contact</h2><p>Hiển thị {(contactPage - 1) * 10 + 1}–{Math.min(contactPage * 10, currentContacts.length)} trong {currentContacts.length} Contact · Trang {contactPage}/{Math.ceil(currentContacts.length / 10)}</p><ContactTable rows={currentContacts.slice((contactPage - 1) * 10, contactPage * 10)} /></section><Actions left={<><Button onClick={() => go(allContactsReturn)}>Quay lại {pages[allContactsReturn]?.[0] ?? 'danh sách'}</Button>{contactPage > 1 && <Button onClick={() => setContactPage(current => current - 1)}>Trang trước</Button>}</>} right={contactPage < Math.ceil(currentContacts.length / 10) ? <Button primary onClick={() => setContactPage(current => current + 1)}>Trang tiếp</Button> : null} /></>}

    {(screen === 'history' || screen === 'contact-lists') && <><section className="flow-panel"><table className="flow-table"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Nguồn</th><th>Contact mới</th></tr></thead><tbody>{visibleHistoryRows.map(row => <tr key={row[0]} className={selectedHistoryIndex === historyRows.indexOf(row) ? 'selected-row' : ''} onClick={() => setHistoryIndex(historyRows.indexOf(row))}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === 0 ? <button className="table-select" type="button" aria-pressed={selectedHistoryIndex === historyRows.indexOf(row)}>{cell}</button> : cell}</td>)}</tr>)}</tbody></table>{screen === 'contact-lists' && <p className="panel-footnote">Các dòng ngoài lần tìm kiếm đầu dùng Contact minh họa từ mẫu Figma; dữ liệu thực và tiêu chí chi tiết chưa được cung cấp.</p>}</section><Actions right={<Button primary onClick={() => { setHistoryIndex(selectedHistoryIndex); go(screen === 'contact-lists' ? 'contact-list-detail' : 'history-detail') }}>{screen === 'contact-lists' ? 'Xem danh sách' : 'Xem chi tiết'}</Button>} /></>}

    {(screen === 'export' || screen === 'export-loading') && <><section className="flow-panel export-panel"><h2>Danh sách: SR-2026-1104 · 38 Contact · B2B SaaS – Hà Nội</h2><p>Chọn định dạng tệp</p><div className="format-grid">{formats.map(item => <label key={item} className={format === item ? 'selected-format' : ''}><input type="radio" name="format" checked={format === item} onChange={() => setFormat(item)} />{item} (.{item.toLowerCase()})</label>)}</div><p>Giữ nguyên giá trị đang lưu; trường thiếu dữ liệu được giữ trống.</p></section><Actions left={<Button onClick={() => go('confirmed')}>Quay lại danh sách</Button>} right={<Button primary disabled={!format || screen === 'export-loading'} onClick={() => go('export-loading')}>{screen === 'export-loading' ? 'Đang tạo tệp…' : format ? 'Xuất ' + format : 'Xuất tệp'}</Button>} /></>}

    {messageScreens.includes(screen) && <><Notice kind={screen === 'export-success' ? 'success' : ['search-empty', 'apollo-empty'].includes(screen) ? 'warning' : ['template-empty', 'history-empty'].includes(screen) ? 'info' : 'error'}><div>{messageText(screen, criteria.source, format, downloadUrl)}</div></Notice><Actions left={<Button onClick={() => go(messageActions[screen][1])}>{messageActions[screen][0]}</Button>} right={screen === 'save-error' ? <Button onClick={() => go('check')}>Quay lại danh sách</Button> : null} /></>}
  </div>
}

function messageText(screen: string, source: string, format: string, downloadUrl: string) {
  const messages: Record<string, React.ReactNode> = {
    'search-empty': <>{source} không trả về Contact phù hợp.<br />Đã lưu lịch sử với các số lượng bằng 0; không tạo Contact mới.<br />Điều chỉnh tiêu chí để tìm lại hoặc xem lịch sử.</>,
    'search-error': <>Tìm kiếm không thành công qua {source}.<br />Không có Contact mới được tạo. Bộ tiêu chí đã nhập vẫn được giữ.<br />Bạn có thể thử lại hoặc điều chỉnh tiêu chí.</>,
    'apollo-unavailable': <>Cấu hình kết nối Apollo không khả dụng nên yêu cầu chưa được gửi.<br />Không có Contact mới được tạo.<br />Chọn Google Search/Web hoặc thử lại khi kết nối Apollo khả dụng.</>,
    'apollo-empty': <>Apollo không trả về Contact phù hợp.<br />Đã lưu lịch sử với các số lượng bằng 0; không tạo Contact mới.<br />Điều chỉnh tiêu chí để tìm lại hoặc xem lịch sử.</>,
    'template-empty': 'Bạn chưa lưu Filter Template nào. Tạo Template để dùng lại bộ tiêu chí.',
    'template-load-error': 'Chưa nhận được danh sách Filter Template. Chọn “Tải lại Template” để thử lại; bộ tiêu chí đang nhập được giữ nguyên.',
    'history-empty': 'Các lần tìm kiếm sẽ xuất hiện tại đây.',
    'history-load-error': 'Chưa nhận được dữ liệu lịch sử tìm kiếm. Chọn “Tải lại lịch sử” để thử lại; tiêu chí đang nhập được giữ nguyên.',
    'check-rejected': <>Kết quả kiểm tra: Chưa đạt yêu cầu.<br />Danh sách chưa đủ điều kiện xác nhận và chưa chuyển thành Đã xác nhận.<br />Quay lại kiểm tra mức độ phù hợp và chất lượng Contact.</>,
    'export-success': <>Tệp đã được tạo và sẵn sàng tải xuống.<br /><br />{downloadUrl ? <a className="flow-download" href={downloadUrl} download={'contacts_b2b_saas_2026-11-04.' + (format || 'CSV').toLowerCase()}>contacts_b2b_saas_2026-11-04.{(format || 'CSV').toLowerCase()}</a> : 'Đang chuẩn bị tệp…'}</>,
    'export-error': <>Chưa tạo được tệp xuất. Danh sách Contact và định dạng đã chọn được giữ nguyên.<br />Quay lại màn xuất và thử xuất lại; chưa có tệp mới để tải xuống.</>,
    'data-unavailable': <>Không thể truy cập dữ liệu được yêu cầu.<br />Dữ liệu có thể không còn khả dụng hoặc nằm ngoài phạm vi truy cập.<br />Quay lại danh sách để chọn dữ liệu còn khả dụng.</>,
    'load-error': <>Không thể truy cập dữ liệu được yêu cầu.<br />Dữ liệu có thể không còn khả dụng hoặc nằm ngoài phạm vi truy cập.<br />Quay lại danh sách để chọn dữ liệu còn khả dụng.</>,
    'save-error': <>Không lưu được thay đổi của thao tác vừa thực hiện.<br />Dữ liệu đã lưu trước đó không thay đổi. Quay lại màn thao tác để kiểm tra và thử lưu lại.</>,
  }
  return messages[screen]
}
