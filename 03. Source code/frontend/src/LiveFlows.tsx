import { invalidEmailVariable } from "./campaignContent";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, api, idNumber } from "./api";
import { recordContext, recordKey, recordRequired, selectedRecord, type Navigate, type RecordContext } from "./recordNavigation";
import { createContactExport, type ExportFormat } from "./exportContacts";
import { CampaignInfo, Dialog, ExhaustedFollowup, PreviewBody, Stepper } from "./NextFlows";
import { followupDeadline, isFollowupExhausted } from "./followupResult";
import { selectionOptions } from "./criteriaOptions";
import { senderValidation } from "./senderValidation";
import FigmaState from "./FigmaState";
import { followupValidation } from "./followupValidation";
import CampaignEditor, { type EditorHandle } from "./CampaignEditor";
import { expectedFinish, scheduleError, scheduleOptionsError, scheduleStartError } from "./campaignSchedule";
import "./flow.css";
import "./nextFlows.css";
import "./managerFlows.css";

type Props = { screen: string; go: Navigate; manager: boolean; owner: string };
type Contact = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  search_provenance?: { emailStatus?: string; method?: string; industry?: string | null; sizeNote?: string };
  source_url?: string;
};
type ContactList = {
  id: string;
  name: string;
  contact_count: number;
  employee_review: string;
  confirmed_at: string | null;
  manager_review: string;
  manager_comment: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  owner_id?: string;
  owner_name?: string;
  created_at?: string;
  criteria?: Record<string, string | string[]>;
  search_started_at?: string | null;
  search_received?: number | null;
  search_invalid?: number | null;
  search_duplicate?: number | null;
  search_new_count?: number | null;
  contacts?: Contact[];
};
type RecipientFilter = { original: number; valid: number; excluded: number; duplicate: number; invalid: number; unsubscribe: number; bounce: number; recent: number };
type Campaign = {
  filter_summary?: RecipientFilter;
  id: string;
  name: string;
  description?: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  subject?: string | null;
  body?: string | null;
  sender_account_id?: string | null;
  sender_name?: string | null;
  send_rate?: number;
  needs_reconfirmation?: boolean;
  window_start?: string;
  window_end?: string;
  scheduled_at?: string | null;
  send_mode?: "scheduled" | "now";
  paused_at?: string | null;
  pause_reason?: string | null;
  created_at?: string | null;
  lists?: { id: string; name: string; reviewed_at?: string | null }[];
  recipients?: (Contact & { status: string })[];
};
type Sender = {
  id: string;
  name: string;
  email: string;
  status: string;
  quota_3_days: number;
  used_3_days: number;
  quota_warning?: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  configured: boolean;
  inbound_enabled: boolean;
  code?: string;
  created_at?: string;
  updated_at?: string;
  google_status: 'connected' | 'reconnect_required' | null;
};
type ResponseItem = {
  id: string;
  customer_name: string;
  email: string;
  phone: string;
  kind: string;
  status: string;
  content: string;
  campaign_name?: string | null;
  campaign_id?: string | null;
  assignee_id: string;
  received_at: string;
  interactions?: {
    id: string;
    channel: string;
    content: string;
    created_at: string;
    actor_id?: string;
  }[];
  email_deliveries?: {
    id: string;
    state: string;
    subject: string;
    created_at: string;
    actor_id?: string;
  }[];
  status_history?: {
    actor_id: string;
    from_status: string;
    to_status: string;
    changed_at: string;
    note?: string | null;
  }[];
  followups?: { id: string; due_at: string; status: string }[];
};
type Followup = {
  id: string;
  response_id: string;
  customer_name: string;
  email: string;
  due_at: string;
  status: string;
  outcome: string | null;
  worker_error?: string | null;
  worker_error_stage?: string | null;
  attempt: number;
  note: string | null;
  channel: string;
  goal: string;
  reminder_minutes: number;
  wait_days: number;
  max_attempts: number;
  interval_days: number;
  assignee_id?: string;
  overdue?: boolean;
  created_at?: string;
  completed_at?: string | null;
  resolved_at?: string | null;
};
type Template = { id: string; name: string; subject: string; body: string; created_at?: string; category?: string };
type FilterTemplate = { id: string; name: string; criteria: Criteria };
type Criteria = {
  role: string[];
  industry: string[];
  location: string[];
  size: string[];
  email: string[];
  keyword: string;
  source: string;
};
const emptyCriteria: Criteria = {
  role: [],
  industry: [],
  location: [],
  size: [],
  email: [],
  keyword: "",
  source: "Google Search/Web",
};
const kinds: Record<string, string> = {
  interested: "Quan tâm",
  not_interested: "Không quan tâm",
  need_info: "Cần thêm thông tin",
  out_of_office: "Vắng mặt",
  bounce: "Email bị trả lại",
  unsubscribe: "Từ chối nhận email",
  spam: "Rác",
  other: "Khác",
};
const responseStatuses: Record<string, string> = {
  new: "Mới",
  processing: "Đang xử lý",
  replied: "Đã phản hồi",
  closed: "Đã chốt nhu cầu",
};
const campaignStatuses: Record<string, string> = {
  approved: "Đang chuẩn bị",
  scheduled: "Đã lên lịch",
  sending: "Đang gửi",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
};
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "—";
const n = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN");

const pageDescriptions: Record<string, string> = {
  "Thiết lập tiêu chí": "Chọn tiêu chí và nguồn để tìm Contact.",
  "Lịch sử tìm kiếm": "Xem lại nguồn và kết quả của từng lần tìm kiếm.",
  "Filter Template": "Xem, tạo và cập nhật bộ tiêu chí tìm kiếm.",
  "Tạo Filter Template": "Đặt tên và lưu bộ tiêu chí để dùng lại.",
  "Cập nhật Filter Template": "Chỉnh sửa bộ tiêu chí của Filter Template.",
  "Danh sách Contact": "Các danh sách Contact đã lưu từ những lần tìm kiếm.",
  "Chi tiết danh sách Contact": "Contact đã lưu trong danh sách được chọn.",
  "Kiểm tra danh sách": "Rà soát danh sách và lưu kết quả kiểm tra.",
  "Xác nhận danh sách Contact": "Kiểm tra lại danh sách trước khi gửi Trưởng phòng duyệt.",
  "Danh sách đã xác nhận": "Xem kết quả xác nhận và trạng thái phê duyệt.",
  "Toàn bộ Contact": "Xem đầy đủ Contact trong danh sách đang chọn.",
  "Xuất danh sách Contact": "Chọn định dạng tệp để xuất danh sách Contact.",
  "Xuất danh sách thành công": "Tệp đã được tải về thiết bị.",
  "Chiến dịch": "Quản lý các chiến dịch email marketing của phòng Marketing.",
  "Tạo chiến dịch mới": "Chọn danh sách Contact đã duyệt để chuẩn bị người nhận.",
  "Chọn danh sách Contact": "Chọn danh sách đã duyệt để lọc người nhận cho chiến dịch.",
  "Chi tiết chiến dịch": "Theo dõi thông tin và tiến độ của chiến dịch.",
  "Chọn/soạn mẫu email": "Chọn mẫu đã lưu hoặc soạn nội dung email mới.",
  "Soạn mẫu email": "Soạn nội dung email cho chiến dịch.",
  "Xem trước email": "Kiểm tra nội dung cá nhân hóa trước khi gửi.",
  "Chọn tài khoản gửi": "Chọn tài khoản hoạt động và kiểm tra hạn mức gửi.",
  "Thiết lập lịch gửi": "Chọn thời điểm bắt đầu gửi email.",
  "Xác nhận chiến dịch": "Kiểm tra lại thông tin trước khi xác nhận lịch gửi.",
  Response: "Xem phản hồi thuộc phạm vi phụ trách.",
  "Quản lý Response": "Xem phản hồi thuộc phạm vi phụ trách.",
  "Thêm Response": "Ghi nhận phản hồi qua điện thoại hoặc gặp trực tiếp.",
  "Chi tiết Response": "Xem nội dung và lịch sử xử lý phản hồi.",
  "Cập nhật Response": "Cập nhật thông tin phản hồi đang xử lý.",
  "Soạn phản hồi": "Soạn email hoặc ghi nhận SMS đã gửi ngoài hệ thống.",
  "Follow-up": "Theo dõi lịch và kết quả của khách hàng.",
  "Quản lý lịch Follow-up": "Theo dõi lịch và kết quả của khách hàng.",
  "Lập lịch Follow-up": "Thiết lập thời điểm và mục tiêu chăm sóc khách hàng.",
  "Chi tiết Follow-up": "Xem lịch hẹn và ghi nhận kết quả chăm sóc.",
  "Tài khoản gửi": "Email của V5 dùng để gửi thư cho đối tác và khách hàng tiềm năng.",
  "Kiểm tra tài khoản gửi": "Kiểm tra địa chỉ email dùng gửi thư cho khách hàng, kết nối dịch vụ và hạn mức gửi.",
  "Thêm tài khoản gửi": "Cấu hình email dùng để gửi thư cho khách hàng.",
  "Cập nhật tài khoản gửi": "Chỉnh sửa thông tin của tài khoản gửi đã chọn.",
  "Chi tiết tài khoản": "Thông tin cấu hình, trạng thái và hạn mức gửi của tài khoản đang chọn.",
};

function Page({
  section,
  title,
  go,
  backTo,
  description: descriptionOverride,
  crumbLabel,
  className = "",
  children,
}: {
  section: string;
  title: string;
  go: Props["go"];
  backTo?: string;
  description?: string | null;
  crumbLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const target = backTo ?? (
    section === "Tìm kiếm Contact"
      ? "criteria"
      : section === "Danh sách Contact"
      ? "contact-lists"
      : section === "Chiến dịch"
        ? "campaign-list"
        : section === "Response"
          ? "response-list"
          : section === "Follow-up"
            ? "followup-list"
            : section === "Tài khoản gửi"
              ? "manager-account-list"
              : "manager-review");
  const description = descriptionOverride === null ? null :
    descriptionOverride ?? pageDescriptions[title] ??
    (section === "Chiến dịch"
      ? pageDescriptions["Chi tiết chiến dịch"]
      : pageDescriptions[section]) ??
    "Chọn chức năng để bắt đầu làm việc.";
  return (
    <section className={"next-page " + className + (["Quản lý Response", "Quản lý lịch Follow-up"].includes(title) ? " next-list-page" : "")}>
      <nav className="next-breadcrumb" aria-label="Đường dẫn">
        {section === title ||
         (section === "Tài khoản gửi" && title === "Kiểm tra tài khoản gửi") ||
         (section === "Response" && title === "Quản lý Response") ||
         (section === "Follow-up" && title === "Quản lý lịch Follow-up") ? (
          <span>{section}</span>
        ) : (
          <>
            <button type="button" onClick={() => go(target)}>
              {section}
            </button>
            <span aria-hidden="true">›</span>
            <span>{crumbLabel ?? title}</span>
          </>
        )}
      </nav>
      <div className="next-title">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={"next-card " + className}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={"next-button" + (primary ? " primary" : "") + (typeof children === "string" && /^(?:xác nhận\s+)?(?:ẩn|xóa|ngắt)/i.test(children.trim()) ? " next-destructive" : "")}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  value,
  set,
  type = "text",
  required = false,
  rows,
  placeholder,
  disabled = false,
  error,
  options,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  options?: string[];
}) {
  const id = label.replace(/\s/g, "-");
  const [invalid, setInvalid] = useState("");
  const fieldError = error || invalid;
  return (
    <div className="next-field">
      <label htmlFor={id}>
        {label}
        {required && " *"}
      </label>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => { setInvalid(""); set(e.target.value); }}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? `${id}-error` : undefined}
          onInvalid={event => { event.preventDefault(); setInvalid(`Vui lòng nhập ${label.toLowerCase()} hợp lệ.`); }}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          type={type}
          list={options ? `${id}-options` : undefined}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? `${id}-error` : undefined}
          value={value}
          onChange={(e) => { setInvalid(""); set(e.target.value); }}
          onInvalid={event => { event.preventDefault(); setInvalid(`Vui lòng nhập ${label.toLowerCase()} hợp lệ.`); }}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      {options && <datalist id={`${id}-options`}>{options.map(option => <option key={option} value={option} />)}</datalist>}
      {fieldError && <small role="alert" id={`${id}-error`} className="next-field-error">{fieldError}</small>}
    </div>
  );
}
function ContactEmail({contact}: {contact: Contact}) {
  return <>{contact.email}{contact.search_provenance && <small className="search-source-note"><br/><span title="Email công khai trên website nguồn và hợp lệ cú pháp; chưa xác minh khả năng nhận thư.">Đã xác nhận</span> · Chức vụ/ngành/khu vực suy đoán: Chưa đảm bảo{contact.source_url && <> · <a href={contact.source_url} target="_blank" rel="noreferrer">Nguồn</a></>}</small>}</>;
}
function ContactAudit({ list, criteria = false }: { list: ContactList; criteria?: boolean }) {
  const labels: Record<string, string> = { role: "Chức vụ", industry: "Ngành nghề", location: "Khu vực", size: "Quy mô", email: "Trạng thái email", keyword: "Từ khóa" };
  return <div className="next-contact-audit">
    <p className="next-hint">Nguồn: {list.criteria?.source || "Danh sách Contact"} · {list.search_started_at ? date(list.search_started_at) : date(list.created_at)}</p>
    <div className="mgr-stats">{[
      ["Contact nhận được", list.search_received], ["Không hợp lệ", list.search_invalid],
      ["Trùng lặp", list.search_duplicate], ["Contact mới hợp lệ", list.search_new_count],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{typeof value === "number" ? `${n(value)} Contact` : "—"}</strong></div>)}</div>
    {criteria && <dl className="next-criteria-summary">{Object.entries(list.criteria || {}).filter(([key]) => labels[key]).map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{Array.isArray(value) ? value.join(", ") || "—" : value || "—"}</dd></div>)}</dl>}
  </div>;
}
function Table({ heads, rows, selectedRow, onSelect }: { heads: string[]; rows: ReactNode[][]; selectedRow?: number; onSelect?: (index: number) => void }) {
  return (
    <div className="next-table-wrap" tabIndex={0} role="region" aria-label={heads.join(" · ")}>
      <table className={`next-table${heads.length === 4 && ["Email", "Địa chỉ email"].includes(heads[1]) ? " next-contact-table" : ""}`}>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className={onSelect && i === selectedRow ? "selected" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? event => { if (!(event.target as HTMLElement).closest("button,a,input")) onSelect(i); } : undefined} onKeyDown={onSelect ? event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(i); } } : undefined}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={heads.length}>Chưa có dữ liệu.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function LiveFlows({ screen, go: navigate, manager, owner }: Props) {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [createdFollowup, setCreatedFollowup] = useState<Followup | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filters, setFilters] = useState<FilterTemplate[]>([]);
  const [selection, setSelection] = useState(() => recordContext(screen, location.search));
  const initialEditorId = useRef(screen === "campaign-editor" ? new URLSearchParams(location.search).get("campaignId") : null);
  const selectionRef = useRef(selection);
  const scope = recordKey(screen);
  const selected = selection.key === scope ? selection.id : recordContext(screen, location.search).id;
  function setSelected(id: string) {
    const next = { key: scope, id };
    selectionRef.current = next;
    setSelection(next);
    if (scope) {
      const url = new URL(location.href);
      if (id) url.searchParams.set(scope, id);
      else url.searchParams.delete(scope);
      history.replaceState(null, "", url);
    }
  }
  function go(next: string, context?: RecordContext) {
    if (next === "campaign-confirm" || next === "campaign-resume") { setEditingSection(false); setSchedule(null); setSendMode(null); setSendRate(null); setWindowFrom(null); setWindowTo(null); setSenderName(null); }
    navigate(next, context ?? (selectionRef.current.key === recordKey(next) ? selectionRef.current : undefined));
  }
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [senderEditId, setSenderEditId] = useState(() =>
    new URLSearchParams(location.search).get("senderId") || "",
  );
  const loadedSenderEditId = useRef("");
  const googleResult = new URLSearchParams(location.search).get("google");
  const googleMessages: Record<string, string> = {
    connected: "Đã liên kết Google. Bạn có thể kiểm tra SMTP và IMAP; việc liên kết chưa gửi email.",
    cancelled: "Bạn đã hủy cấp quyền Google. Cấu hình cũ được giữ nguyên.",
    wrong_account: "Gmail vừa chọn không trùng địa chỉ tài khoản gửi. Chọn đúng Gmail khi kết nối lại.",
    missing_permission: "Chưa cấp đủ quyền gửi và nhận Gmail. Kết nối lại và kiểm tra quyền trên Google.",
    account_changed: "Thông tin tài khoản đã thay đổi trong lúc kết nối. Kiểm tra lại địa chỉ Gmail.",
    expired: "Phiên kết nối đã hết hạn hoặc không hợp lệ. Bấm kết nối Google để bắt đầu lại.",
    failed: "Không hoàn tất được kết nối Google. Kiểm tra cấu hình OAuth rồi thử lại.",
  };
  const [detail, setDetail] = useState<
    ContactList | Campaign | ResponseItem | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [exportFile, setExportFile] = useState<{ url: string; name: string } | null>(null);
  const [filterNameError, setFilterNameError] = useState("");
  const [senderErrors, setSenderErrors] = useState<Record<string, string>>({});
  const [filterLoadError, setFilterLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
    danger: boolean;
  } | null>(null);
  const [pauseCampaign, setPauseCampaign] = useState<Campaign | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [campaignOverview, setCampaignOverview] = useState<Campaign | null>(null);
  const [failureDialog, setFailureDialog] = useState<{ title: string; message: string } | null>(null);
  const [responseWindow, setResponseWindow] = useState<"30" | "all">("30");
  const [statusNote, setStatusNote] = useState("");
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [confirmEmailViewed, setConfirmEmailViewed] = useState(false);
  const [showCampaignEditChoice, setShowCampaignEditChoice] = useState(false);
  const [resumeEmailViewed, setResumeEmailViewed] = useState(false);
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [senderId, setSenderId] = useState("");
  const [editingSection, setEditingSection] = useState(false);
  const [followupErrors, setFollowupErrors] = useState<Record<string, string>>({});
  const [senderName, setSenderName] = useState<string | null>(null);
  const [sendRate, setSendRate] = useState<string | null>(null);
  const [windowFrom, setWindowFrom] = useState<string | null>(null);
  const [windowTo, setWindowTo] = useState<string | null>(null);
  const [replyChannel, setReplyChannel] = useState<"email" | "sms">("email");
  const [senderCheckResult, setSenderCheckResult] = useState<{ id: string; connected: boolean; message: string } | null>(null);
  const [previewDraft, setPreviewDraft] = useState<{ subject: string; body: string } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "phone">("desktop");
  const [previewContactId, setPreviewContactId] = useState("");
  const editorBodyRef = useRef<EditorHandle>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [assets, setAssets] = useState<
    { id: string; kind: string; file_name: string }[]
  >([]);
  const [showLogoLibrary, setShowLogoLibrary] = useState(false);
  const [buttonBlock, setButtonBlock] = useState<{ label: string; url: string } | null>(null);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [emptyRecipientFilter, setEmptyRecipientFilter] = useState<RecipientFilter | null>(null);
  const [filteredOriginalCount, setFilteredOriginalCount] = useState(0);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"scheduled" | "now" | null>(null);
  const [scheduleCalculated, setScheduleCalculated] = useState<boolean | null>(null);
  const [editCampaign, setEditCampaign] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editCampaignError, setEditCampaignError] = useState("");
  const [due, setDue] = useState("");
  const [followChannel, setFollowChannel] = useState("email");
  const [goal, setGoal] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("60");
  const [waitDays, setWaitDays] = useState("2");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [intervalDays, setIntervalDays] = useState("2");
  const [needsNext, setNeedsNext] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat | "">("");
  const [contactReturnScreen, setContactReturnScreen] = useState("contact-list-detail");
  const [contactPage, setContactPage] = useState(1);
  const [criteria, setCriteria] = useState<Criteria>(emptyCriteria);
  const [senderForm, setSenderForm] = useState({
    name: "",
    code: "",
    email: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "465",
    smtpUser: "",
    smtpPassword: "",
    status: "inactive",
    quota3Days: "100",
    inboundEnabled: false,
  });
  useEffect(() => {
    // A retry belongs to the failed payload; editing must submit the current form instead.
    queueMicrotask(() => setRetryAction(null));
  }, [name, description, criteria, senderForm, subject, body, email, phone, senderId, senderName, schedule, sendMode, sendRate, windowFrom, windowTo, goal, due, reminderMinutes, waitDays, maxAttempts, intervalDays, decisionNote, pauseReason, selectedLists, replyChannel, followChannel, statusNote, needsNext, templateName, exportFormat, editCampaign, selected]);
  const group =
    screen.startsWith("manager-review") ||
    screen.startsWith("contact-") ||
    ["all-contacts", "check", "check-rejected", "confirm", "confirmed", "export", "export-success"].includes(screen)
      ? "lists"
      : screen.startsWith("manager-account") || screen.startsWith("sender-")
        ? "senders"
        : screen.startsWith("campaign-")
          ? "campaigns"
          : screen.startsWith("response-")
            ? "responses"
            : screen.startsWith("followup-")
              ? "followups"
              : screen.startsWith("template") || screen === "templates"
                ? "filters"
                : "other";
  const list = scope === "listId" && !selected && manager && screen.startsWith("manager-review")
    ? lists.find(item => item.manager_review === "pending" && item.confirmed_at) ?? lists[0]
    : selectedRecord(lists, scope === "listId" ? selected : "");
  const campaign = selectedRecord(campaigns, scope === "campaignId" ? selected : "");
  const responseItem = selectedRecord(responses, scope === "responseId" ? selected : "");
  const followup = selectedRecord(followups, scope === "followupId" ? selected : "");
  const sender = selectedRecord(senders, scope === "senderId" ? selected : "");
  const loadedForm = useRef("");
  useEffect(() => {
    if (screen !== "campaign-list" || !campaigns.some(item => ["scheduled", "sending"].includes(item.status))) return;
    const timer = window.setInterval(() => setReload(value => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [screen, campaigns]);
  useLayoutEffect(() => {
    const sync = () => {
      const next = recordContext(new URLSearchParams(location.search).get("screen") || screen, location.search);
      selectionRef.current = next;
      setSelection(next);
      setDetail(null);
      loadedForm.current = "";
      setSenderErrors({});
      setRetryAction(null);
      setLoadFailure(false);
    };
    sync();
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, [screen]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const formKey = `${screen}:${selected}`;
      if (loadedForm.current === formKey) return;
      if (screen === "template-create") {
        const draft = sessionStorage.getItem("v5-template-draft");
        if (draft) { try { setCriteria(JSON.parse(draft)); } catch { setCriteria(emptyCriteria); } }
      } else if (screen === "template-edit") {
        const item = selectedRecord(filters, selected);
        if (!item) return;
        setName(item.name); setCriteria(item.criteria);
      } else if (screen === "response-edit") {
        if (!responseItem) return;
        setName(responseItem.customer_name); setEmail(responseItem.email || "");
        setPhone(responseItem.phone || ""); setBody(responseItem.content);
      } else if (screen === "campaign-sender") {
        if (!campaign) return;
        const available = senders.find(item => item.status === "active" && item.configured && item.quota_3_days - item.used_3_days >= campaign.recipient_count - campaign.sent_count);
        setSenderId(campaign.sender_account_id || available?.id || "");
        setSenderName(campaign.sender_name || senders.find(item => item.id === campaign.sender_account_id)?.name || available?.name || "");
      } else if (screen === "manager-account-edit") {
        if (!sender) return;
        setSenderEditId(sender.id);
        setSenderForm({ code: sender.code || `TK-${sender.id}`, name: sender.name, email: sender.email, smtpHost: sender.smtp_host || "",
          smtpPort: String(sender.smtp_port || 465), smtpUser: sender.smtp_user || "", smtpPassword: "",
          status: sender.status, quota3Days: String(sender.quota_3_days), inboundEnabled: sender.inbound_enabled });
      } else {
        loadedForm.current = "";
        return;
      }
      loadedForm.current = formKey;
    });
    return () => { active = false; };
  }, [screen, selected, filters, responseItem, sender, campaign, senders]);
  useEffect(() => {
    if (group !== "senders" || !manager) return;
    let active = true;
    api<{ configured: boolean }>("sender-accounts/google/status")
      .then(value => { if (active) setGoogleConfigured(value.configured); })
      .catch(() => { if (active) setGoogleConfigured(false); });
    return () => { active = false; };
  }, [group, manager]);
  useEffect(() => {
    if (!/campaign-(schedule|confirm|resume)/.test(screen)) return;
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [screen]);
  useEffect(() => () => { if (exportFile) URL.revokeObjectURL(exportFile.url); }, [exportFile]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const detailResource =
    screen.startsWith("manager-review") || screen.startsWith("contact-") ||
    ["all-contacts", "check", "check-rejected", "confirm", "confirmed", "export", "export-success"].includes(screen)
      ? "contact-lists"
      : screen.startsWith("campaign-")
        ? "campaigns"
        : "responses";
  const detailId =
    detailResource === "contact-lists"
      ? list?.id
      : detailResource === "campaigns"
        ? campaign?.id
        : responseItem?.id;
  const assetCampaignId = campaign?.id;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setLoadFailure(false);
        setError("");
        if (group === "filters") setFilterLoadError(false);
      }
    });
    const resources: Record<string, () => Promise<unknown>[]> = {
      lists: () => [api<ContactList[]>("contact-lists")],
      senders: () => [api<Sender[]>("sender-accounts")],
      campaigns: () => [
        api<Campaign[]>("campaigns"),
        api<ContactList[]>("contact-lists"),
        api<Sender[]>("sender-accounts"),
        api<Template[]>("email-templates"),
      ],
      responses: () => [
        api<ResponseItem[]>("responses"),
        api<Campaign[]>("campaigns"),
        api<Sender[]>("sender-accounts"),
        api<Template[]>("email-templates"),
        api<Contact[]>("contact-lists/customers").then(value => { if (active) setCustomerLoadError(""); return value; }).catch(reason => { if (active) setCustomerLoadError(reason.message); return []; }),
      ],
      followups: () => [
        api<Followup[]>("followups"),
        api<ResponseItem[]>("responses"),
      ],
      filters: () => [api<FilterTemplate[]>("filter-templates")],
      other: () => [],
    };
    Promise.all(resources[group]())
      .then((values) => {
        if (!active) return;
        if (group === "lists") setLists(values[0] as ContactList[]);
        if (group === "senders") {
          const loaded = values[0] as Sender[];
          setSenders(loaded);
          const params = new URLSearchParams(location.search);
          const editing = loaded.find(item => item.id === params.get("senderId"));
          if (params.get("screen") === "manager-account-edit" && editing && loadedSenderEditId.current !== editing.id) {
            loadedSenderEditId.current = editing.id;
            setSenderForm({
              name: editing.name,
              code: editing.code || `TK-${editing.id}`,
              email: editing.email,
              smtpHost: editing.smtp_host || "",
              smtpPort: String(editing.smtp_port || 465),
              smtpUser: editing.smtp_user || "",
              smtpPassword: "",
              status: editing.status,
              quota3Days: String(editing.quota_3_days),
              inboundEnabled: editing.inbound_enabled,
            });
          }
        }
        if (group === "campaigns") {
          setCampaigns(values[0] as Campaign[]);
          setLists(values[1] as ContactList[]);
          setSenders(values[2] as Sender[]);
          setTemplates(values[3] as Template[]);
        }
        if (group === "responses") {
          setResponses(values[0] as ResponseItem[]);
          setCustomers(values[4] as Contact[]);
          setCampaigns(values[1] as Campaign[]);
          setSenders(values[2] as Sender[]);
          setTemplates(values[3] as Template[]);
        }
        if (group === "followups") {
          setFollowups(values[0] as Followup[]);
          setResponses(values[1] as ResponseItem[]);
        }
        if (group === "filters") {
          const loaded = values[0] as FilterTemplate[];
          setFilters(loaded);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoadFailure(true);
          if (group === "filters") setFilterLoadError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [group, reload]);
  useEffect(() => {
    if (
      !["lists", "campaigns", "responses"].includes(group) ||
      !detailId ||
      !/detail|check|confirm|review|preview|history|edit|editor|reply|hide|filtered|resume|status|export|all-contacts/.test(screen)
    )
      return;
    let active = true;
    api<ContactList | Campaign | ResponseItem>(`${detailResource}/${detailId}`)
      .then((value) => {
        if (active) {
          setDetail(value);
          if (screen === "campaign-editor" && initialEditorId.current === detailId) {
            setSubject((value as Campaign).subject || "");
            setBody((value as Campaign).body || "");
            initialEditorId.current = null;
          }
        }
      })
      .catch((e) => {
        if (active) { setError(e.message); setLoadFailure(true); }
      });
    return () => {
      active = false;
    };
  }, [screen, group, detailResource, detailId, reload]);
  useEffect(() => {
    if (
      !assetCampaignId ||
      !["campaign-editor", "campaign-preview", "campaign-confirm", "campaign-resume"].includes(screen)
    )
      return;
    let active = true;
    api<{ id: string; kind: string; file_name: string }[]>(
      `campaigns/${assetCampaignId}/assets`,
    )
      .then((value) => {
        if (active) setAssets(value);
      })
      .catch((e) => {
        if (active) { setError(e.message); setLoadFailure(true); }
      });
    return () => {
      active = false;
    };
  }, [screen, assetCampaignId, reload]);
  useEffect(() => {
    if (screen !== "campaign-preview" || !assetCampaignId) return;
    let active = true;
    api<{ subject: string; body: string }>(`campaigns/${assetCampaignId}/preview`, "POST", { ...(previewContactId ? { contactId: idNumber(previewContactId) } : {}), ...(previewDraft || {}) })
      .then(result => { if (active) setPreviewResult(result); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Không tạo được bản xem trước."); });
    return () => { active = false; };
  }, [screen, assetCampaignId, previewContactId, previewDraft]);
  async function run<T>(
    action: () => Promise<T>,
    message: string,
    next?: string,
    onError?: (error: Error) => void,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(message);
      setConfirmAction(null);
      setReload((x) => x + 1);
      if (next) go(next);
      return result;
    } catch (e) {
      const failure = e instanceof Error ? e : new Error("Không thể hoàn tất thao tác. Vui lòng thử lại.");
      setError(failure.message);
      setRetryAction(() => () => { void run(action, message, next, onError); });
      if (screen === "manager-account-add" || screen === "manager-account-edit") { if (failure instanceof ApiError && failure.status === 409 && /đã tồn tại|trùng/i.test(failure.message)) setSenderErrors(previous => ({ ...previous, [/mã tài khoản/i.test(failure.message) ? 'code' : 'email']: failure.message })); }
      onError?.(failure);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  function googleConnection(account: Sender, dirty = false) {
    return <Card title="Kết nối Gmail với Google">
      <p>{account.email} · {account.google_status === "connected" ? "Đã liên kết Google" : account.google_status === "reconnect_required" ? "Cần kết nối lại Google" : "Chưa liên kết Google"}</p>
      <p>Cho phép gửi SMTP và đồng bộ IMAP bằng tài khoản Google, không cần nhập mật khẩu ứng dụng.</p>
      {googleResult === "connected" && account.google_status === "connected" && <p role="status" className="mgr-callout">{googleMessages.connected}</p>}
      {googleConfigured === false && <p role="status" className="mgr-callout">Kết nối Google tạm thời không khả dụng. Vui lòng thử lại sau.</p>}
      {dirty && <p role="status">Hãy lưu các thay đổi trong form trước khi chuyển sang Google.</p>}
      <div className="next-actions-bar">
        {account.google_status && <Button disabled={busy || dirty} onClick={() => ask("Ngắt kết nối Google", "Tài khoản sẽ ngừng gửi và đồng bộ IMAP trong ứng dụng. Quyền đã cấp trên Google không bị thu hồi bởi thao tác này.", () => void run(async () => {
          await api(`sender-accounts/${account.id}/google/disconnect`, "POST");
          loadedSenderEditId.current = "";
        }, "Đã ngắt kết nối Google trong ứng dụng."))}>Ngắt kết nối Google</Button>}
        <Button primary disabled={busy || googleConfigured !== true || dirty} onClick={() => void run(async () => {
          const result = await api<{ url: string }>(`sender-accounts/${account.id}/google/connect`, "POST");
          location.assign(result.url);
        }, "Đang chuyển đến Google…")}>{account.google_status ? "Kết nối lại Google" : "Kết nối với Google"}</Button>
      </div>
    </Card>;
  }
  const choose = (id: string, next: string) => {
    setSelected(id);
    if (next.startsWith("campaign-")) { setPreviewDraft(null); setSchedule(null); setSendMode(null); setSenderName(null); setSendRate(null); setWindowFrom(null); setWindowTo(null); setScheduleCalculated(null); setPreviewContactId(""); setPreviewResult(null); setResumeEmailViewed(false); setConfirmEmailViewed(false); setShowConfirmEmail(false); setShowCampaignEditChoice(false); }
    setError("");
    setNotice("");
    setEditingSection(false);
    go(next);
  };
  const insertEditorText = (before: string, after = "") => {
    if (editorBodyRef.current) editorBodyRef.current.insert(before, after);
    else setBody(current => current + before + after);
    setPreviewResult(null);
  };
  const ask = (title: string, message: string, action: () => void, danger = true) =>
    setConfirmAction({ title, message, action, danger });
  const openCampaignEdit = (item: Campaign) => {
    setConfirmEmailViewed(false);
    setEditCampaign({ id: item.id, name: item.name, description: item.description || "" });
    setEditCampaignError("");
  };
  const openCampaignPause = (item: Campaign) => {
    setPauseCampaign(item);
    setPauseReason("");
    setError("");
  };
  async function uploadAsset(file: File, campaignId: string, kind: "logo" | "pdf" | "image" = file.type === "application/pdf" ? "pdf" : "logo") {
    if (
      !["application/pdf", "image/png", "image/jpeg", "image/svg+xml"].includes(
        file.type,
      )
    ) {
      setError(`Không thể tải tệp “${file.name}”. Chỉ hỗ trợ ảnh PNG/JPG, logo PNG/JPG/SVG hoặc tệp PDF.`);
      return;
    }
    if (kind === "image" && file.type === "image/svg+xml") {
      setError("Ảnh nội dung chỉ hỗ trợ PNG hoặc JPG.");
      return;
    }
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const saved = await run<{ id: string }>(async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/assets`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message || "Không thể tải tệp lên.");
      }
      return response.json() as Promise<{ id: string }>;
    }, "Đã tải tệp lên chiến dịch.", undefined, failure => setError(`Không thể tải tệp “${file.name}”. ${failure.message}`));
    if (saved) setPreviewResult(null);
    return saved;
  }
  async function chooseLibraryLogo(campaignId: string) {
    try {
      const response = await fetch("/logo-v5.png");
      if (!response.ok) throw new Error("Không tải được logo V5. Vui lòng thử lại.");
      const file = new File([await response.blob()], "logo-v5.png", { type: "image/png" });
      if (await uploadAsset(file, campaignId)) setShowLogoLibrary(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không chọn được logo V5.");
    }
  }
  const feedback = (
    <>
      {manager && group === "senders" && googleResult && googleResult !== "connected" && googleMessages[googleResult] && (
        <p role="alert" className="mgr-callout">{googleMessages[googleResult]}</p>
      )}
      {loading && (
        <p role="status" className="next-card">
          Đang tải dữ liệu…
        </p>
      )}
      {error && (
        <div role="alert" className="next-error"><strong>{screen === "export" ? "Xuất dữ liệu không thành công" : screen === "check" ? "Không thể lưu kết quả kiểm tra" : screen === "confirm" ? "Không thể xác nhận danh sách" : screen === "campaign-editor" ? "Không thể lưu nội dung email" : screen === "campaign-filtered" ? "Không thể lưu danh sách người nhận" : screen === "response-add" ? "Thông tin Response chưa hợp lệ" : screen === "response-edit" ? "Thông tin cập nhật chưa hợp lệ" : screen === "followup-create" ? "Thông tin lịch Follow-up chưa hợp lệ" : screen === "followup-note" ? "Không thể lưu ghi chú" : screen === "response-reply" ? "Gửi phản hồi chưa thành công" : screen === "campaign-schedule" ? "Không thể lưu lịch gửi" : screen === "campaign-sender" ? "Không thể lưu tài khoản gửi" : screen === "campaign-confirm" ? "Không thể xác nhận chiến dịch" : screen === "campaign-resume" ? "Không thể tiếp tục gửi" : "Không thể hoàn tất thao tác"}</strong><p>{error}</p>{retryAction && <Button disabled={busy} onClick={retryAction}>{screen === "response-reply" ? "Thử gửi lại" : screen === "followup-note" ? "Thử lưu ghi chú" : screen === "confirm" ? "Thử xác nhận lại" : screen === "check" ? "Thử lưu" : "Thử lại"}</Button>}</div>
      )}
      {notice && (
        <div role="status" className="mgr-toast">
          <strong>{notice}</strong>
          <span>Thông tin đã được cập nhật.</span>
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}
      {confirmAction && (
        <Dialog pending={busy}
          title={confirmAction.title}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction.action;
            if (!busy) action();
          }}
          cancelLabel="Hủy"
          confirmLabel={confirmAction.danger ? "Xác nhận ẩn" : "Đồng ý"}
          danger={confirmAction.danger}
        >
          <p>{confirmAction.message}</p>{error && <p role="alert" className="next-error">{error}</p>}
          {group === "campaigns" && campaign && <dl className="next-details"><dt>Chiến dịch</dt><dd>{campaign.name}</dd><dt>Số người nhận</dt><dd>{n(campaign.recipient_count - campaign.sent_count)}</dd><dt>Thời điểm bắt đầu</dt><dd>{campaign.send_mode === "now" ? "Ngay sau khi xác nhận" : date(campaign.scheduled_at)}</dd><dt>Hoàn tất dự kiến</dt><dd>{date(expectedFinish(campaign.scheduled_at || new Date(clock).toISOString(), Math.max(0, campaign.recipient_count - campaign.sent_count), campaign.send_rate ?? 50, campaign.window_start?.slice(0,5), campaign.window_end?.slice(0,5), campaign.send_mode === "now"))}</dd></dl>}
          {group === "senders" && sender && <dl className="next-details"><dt>Tên tài khoản</dt><dd>{sender.name}</dd><dt>Mã tài khoản</dt><dd>{sender.code || `TK-${sender.id}`}</dd><dt>Email</dt><dd>{sender.email}</dd><dt>Trạng thái</dt><dd>{sender.status === "active" ? "Hoạt động" : "Ngừng hoạt động"}</dd></dl>}
        </Dialog>
      )}
      {failureDialog && <Dialog title={failureDialog.title} onClose={() => setFailureDialog(null)}><p role="alert">{failureDialog.message}</p></Dialog>}
      {pauseCampaign && <Dialog pending={busy} className="next-campaign-dialog" title={`Tạm dừng chiến dịch “${pauseCampaign.name}”`} onClose={() => setPauseCampaign(null)} cancelLabel="Hủy" confirmLabel="Xác nhận tạm dừng" onConfirm={() => {
        if (busy) return;
        void run(() => api(`campaigns/${pauseCampaign.id}/pause`, "POST", { reason: pauseReason }), `Đã tạm dừng chiến dịch “${pauseCampaign.name}”.`).then(saved => { if (saved) setPauseCampaign(null); });
      }}>
        <dl className="next-details"><dt>Số email đã gửi</dt><dd>{n(pauseCampaign.sent_count)}</dd><dt>Số email chưa gửi</dt><dd>{n(Math.max(0, pauseCampaign.recipient_count - pauseCampaign.sent_count))}</dd></dl>
        <label className="next-field">Lý do tạm dừng<textarea value={pauseReason} disabled={busy} maxLength={250} rows={3} onChange={event => setPauseReason(event.target.value)} /></label>
        <p className="next-hint">Không bắt buộc, tối đa 250 ký tự.</p>
        {error && <p className="next-error" role="alert">{error}</p>}
      </Dialog>}
    </>
  );

  if (loadFailure && !loading && !(screen === "templates" && filterLoadError)) return <Page section={group === "responses" ? "Response" : group === "followups" ? "Follow-up" : group === "campaigns" ? "Chiến dịch" : group === "senders" ? "Tài khoản gửi" : "Danh sách Contact"} title={group === "responses" ? "Không thể tải danh sách Response" : group === "campaigns" ? "Không thể tải thông tin chiến dịch" : "Không thể tải dữ liệu"} go={go}>
    <FigmaState error title="Chưa nhận được dữ liệu" description={error || "Kiểm tra kết nối rồi thử tải lại. Dữ liệu đang nhập được giữ nguyên."} actions={<Button primary onClick={() => setReload(value => value + 1)}>Thử tải lại</Button>} />
  </Page>;
  const selectedItem = scope === "listId" ? list : scope === "campaignId" ? campaign
    : scope === "responseId" ? responseItem : scope === "followupId" ? followup
    : scope === "senderId" ? sender : selectedRecord(filters, selected);
  if ((recordRequired(screen) && (!selected || (!loading && !selectedItem))) || (screen === "followup-create" && selected && !loading && !selectedItem)) {
    const back = scope === "listId" ? manager ? "manager-review" : "contact-lists"
      : scope === "campaignId" ? "campaign-list" : scope === "responseId" ? "response-list"
      : scope === "followupId" ? "followup-list" : scope === "senderId" ? manager ? "manager-account-list" : "sender-list" : "templates";
    return <Page section="Thông tin" title={group === "responses" ? "Không thể truy cập Response" : group === "followups" ? "Không tìm thấy khách hàng / Response" : "Không thể truy cập dữ liệu"} go={go}>
      {feedback}<Card><p role="alert">Bản ghi không tồn tại hoặc bạn không có quyền truy cập. Vui lòng chọn lại từ danh sách.</p>
        <Button onClick={() => navigate(back, { key: scope, id: "" })}>Về danh sách</Button></Card>
    </Page>;
  }

  if (
    screen === "criteria" ||
    screen === "criteria-adjust" ||
    screen === "history"
  )
    return (
      <Page
        section="Tìm kiếm Contact"
        title={screen === "history" ? "Lịch sử tìm kiếm" : "Thiết lập tiêu chí"}
        go={go}
      >
        {feedback}
        <Card
          title={
            screen === "history"
              ? "Lịch sử tìm kiếm"
              : "Nguồn Google Search/Web"
          }
        >
          <p>
            {screen === "history"
              ? "Chưa có lần tìm kiếm Google nào được ghi nhận."
              : "Thiết lập tiêu chí để tìm kiếm và lưu danh sách Contact."}
          </p>
          {screen !== "history" && <Button disabled>Tìm kiếm</Button>}
        </Card>
      </Page>
    );

  if (screen.startsWith("template") || screen === "templates") {
    const active = selectedRecord(filters, selected);
    const edit = screen === "template-edit";
    if (screen === "templates" && filterLoadError && !loading) return <Page section="Tìm kiếm Contact" title="Không thể tải Filter Template" description="Chưa truy xuất được danh sách. Bộ tiêu chí hiện tại chưa bị thay đổi." crumbLabel="Không thể tải dữ liệu" go={go}>
      <section className="flow-panel next-template-load-error" role="alert"><p>Chưa nhận được danh sách Filter Template.<br />Chọn “Tải lại Template” để thử lại; bộ tiêu chí đang nhập được giữ nguyên.</p></section>
      <div className="flow-actions"><Button onClick={() => setReload(value => value + 1)}>Tải lại Template</Button></div>
    </Page>;
    if (screen === "templates" && !loading && !filters.length && !filterLoadError) return <Page section="Tìm kiếm Contact" title="Chưa có Filter Template" go={go}>{feedback}<FigmaState title="Chưa có Filter Template" description="Tạo Filter Template để lưu và sử dụng lại bộ tiêu chí tìm kiếm." actions={<Button primary onClick={() => { setName(""); setCriteria(emptyCriteria); go("template-create"); }}>Tạo Filter Template</Button>} /></Page>;
    return screen === "templates" ? (
      <Page section="Tìm kiếm Contact" title="Filter Template" go={go}>
        {feedback}
        <section className="flow-panel">
          {loading ? <p role="status">Đang tải Filter Template…</p> : filters.length ? <>
            <table className="flow-table">
              <thead><tr><th>Template</th><th>Chức vụ Contact</th><th>Từ khóa</th><th>Khu vực</th><th>Quy mô doanh nghiệp</th></tr></thead>
              <tbody>{filters.map((item) => <tr key={item.id} className={active?.id === item.id ? "selected-row" : ""}>
                <td><button className="table-select" type="button" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.name}<small>FT-{item.id}</small></button></td>
                <td>{item.criteria.role.join(", ") || "—"}</td>
                <td>{item.criteria.keyword || "—"}</td>
                <td>{item.criteria.location.join(", ") || "—"}</td>
                <td>{item.criteria.size.join(", ") || "—"}</td>
              </tr>)}</tbody>
            </table>
            <p className="panel-footnote">Đang chọn: {active ? `${active.name} · FT-${active.id}` : "Chưa chọn Template"}</p>
          </> : <FigmaState title="Chưa có Filter Template" description="Tạo Template để lưu bộ tiêu chí tìm kiếm." actions={<Button primary onClick={() => go("template-create")}>Tạo Filter Template</Button>} />}
        </section>
        <div className="flow-actions"><div>
          <Button disabled={!active} onClick={() => { if (!active) return; setSelected(active.id); setCriteria(active.criteria); setName(active.name); go("template-edit", { key: "filterId", id: active.id }); }}>Cập nhật Template</Button>
          <Button onClick={() => { setName(""); setCriteria(emptyCriteria); go("template-create"); }}>Tạo Template</Button>
        </div><div><Button primary disabled={!active} onClick={() => { if (!active) return; sessionStorage.setItem("v5-applied-filter", JSON.stringify(active.criteria)); go("criteria"); }}>Xem / áp dụng tiêu chí</Button></div></div>
      </Page>
    ) : (
      <Page section="Tìm kiếm Contact" title={edit ? "Cập nhật Filter Template" : "Tạo Filter Template"} className="next-template-figma" go={go}>
        {feedback}
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) { setFilterNameError("Vui lòng nhập tên Filter Template."); return; }
          if (filters.some(item => item.name.trim().toLowerCase() === name.trim().toLowerCase() && (!edit || item.id !== selected))) { setFilterNameError("Tên Filter Template đã tồn tại. Chọn tên khác."); return; }
          setFilterNameError("");
          void run(async () => {
            const saved = await api<FilterTemplate>(`filter-templates${edit && selected ? `/${selected}` : ""}`, edit ? "PATCH" : "POST", { name, criteria });
            if (!edit) sessionStorage.setItem(`v5-search:${owner}:criteria`, JSON.stringify(saved.criteria));
            return saved;
          }, "Đã lưu mẫu tiêu chí.", edit ? "templates" : "template-created", failure => setFilterNameError(failure.message));
        }}>
          <section className="flow-panel template-editor">
            <Field disabled={busy} label="Tên Filter Template" value={name} set={value => { setName(value); setFilterNameError(""); }} error={filterNameError} required />
            <div className="editor-grid">
              {(["role", "industry", "location", "keyword", "size", "email"] as const).map((key) => key === "keyword" ? <Field disabled={busy} key={key} label="Từ khóa doanh nghiệp" value={criteria.keyword} set={value => setCriteria({ ...criteria, keyword: value })} /> : <div key={key} className="next-field">
                <label htmlFor={`template-${key}`}>{selectionOptions.find(item => item.key === key)?.label}</label>
                <select id={`template-${key}`} disabled={busy} value={criteria[key].join(", ")} onChange={event => setCriteria({ ...criteria, [key]: event.target.value === criteria[key].join(", ") ? criteria[key] : event.target.value ? [event.target.value] : [] })}>
                  <option value="">Chọn điều kiện</option>
                  {[...new Set([criteria[key].join(", "), ...(selectionOptions.find(item => item.key === key)?.options || [])])].filter(Boolean).map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>)}
            </div>
            <p>Chỉ nhập những điều kiện sử dụng cho lần tìm kiếm.</p>
          </section>
          <div className="flow-actions"><div><Button onClick={() => go("templates")}>Xem Filter Template</Button></div><div><Button type="submit" primary disabled={busy}>{edit ? "Lưu cập nhật" : "Tạo Template"}</Button></div></div>
        </form>
      </Page>
    );
  }

  if (group === "lists") {
    if (screen === "contact-lists")
      return (
        <Page
          section={manager ? "Kiểm tra danh sách" : "Danh sách Contact"}
          title={manager ? "Kiểm tra danh sách" : "Danh sách Contact"}
          go={go}
        >
          {feedback}
          <Card
            title={manager ? "Danh sách chờ duyệt" : "Các danh sách đã lưu"}
          >
            <Table
              heads={[
                "Danh sách",
                "Số Contact",
                "Kiểm tra",
                "Phê duyệt",
                "Thao tác",
              ]}
              rows={lists
                .filter(
                  (item) =>
                    !manager ||
                    (item.manager_review === "pending" && item.confirmed_at),
                )
                .map((item) => [
                  item.name,
                  n(item.contact_count),
                  item.employee_review === "passed"
                    ? "Đạt"
                    : item.employee_review === "failed"
                      ? "Không đạt"
                      : "Chưa kiểm tra",
                  item.manager_review === "approved"
                    ? "Đã duyệt"
                    : item.manager_review === "rejected"
                      ? "Không đạt"
                      : "Chờ duyệt",
                  <Button
                    key={item.id}
                    onClick={() =>
                      choose(
                        item.id,
                        manager
                          ? "manager-review-detail"
                          : "contact-list-detail",
                      )
                    }
                  >
                    Xem chi tiết
                  </Button>,
                ])}
            />
          </Card>
        </Page>
      );
    if (screen === "manager-review" || screen === "manager-review-empty") {
      const pending = lists.filter(item => item.manager_review === "pending" && item.confirmed_at);
      const active = pending.find(item => item.id === selected) || pending[0];
      return <Page section="Kiểm tra danh sách" title="Kiểm tra danh sách" go={go}>
        {feedback}
        <Card title={pending.length ? "Danh sách chờ kiểm tra" : "Không có yêu cầu nào"}>
          <Table heads={["Danh sách", "Nhân viên kiểm tra", "Thời điểm gửi", "Contact"]}
            rows={pending.map(item => [
              <button key={item.id} type="button" className="next-followup-select" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.name}</button>,
              item.owner_name || item.owner_id || "—",
              date(item.confirmed_at),
              n(item.contact_count),
            ])} />
          {!pending.length ? <p>Chưa có danh sách Contact chờ duyệt.</p> : <p className="mgr-callout">Đang chọn {active?.name} để kiểm tra.</p>}
        </Card>
        {!!active && <div className="next-actions-bar"><Button primary onClick={() => choose(active.id, "manager-review-detail")}>Xem danh sách</Button></div>}
      </Page>;
    }
    const d = detail as ContactList | null;
    const current = d && list && d.id === list.id
      ? { ...list, ...d, contact_count: list.contact_count ?? d.contacts?.length ?? 0 }
      : list;
    if (manager && current && screen.startsWith("manager-review")) {
      const contacts = current.contacts || [];
      const invalid = current.search_invalid ?? contacts.filter(item => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)).length;
      const seen = new Set<string>();
      const duplicates = current.search_duplicate ?? contacts.filter(item => { const email = item.email.toLowerCase(); if (seen.has(email)) return true; seen.add(email); return false; }).length;
      const valid = current.search_new_count ?? Math.max(0, contacts.length - invalid - duplicates);
      if (screen === "manager-review-all-contacts")
        return <Page section="Kiểm tra danh sách" title="Toàn bộ danh sách Contact" go={go}>
          {feedback}
          <Card title={current.name}>
            <p>{n(current.search_received ?? current.contact_count)} Contact ban đầu · {n(valid)} hợp lệ · {n(invalid)} email không hợp lệ · {n(duplicates)} email trùng</p>
            <Table heads={["Họ tên", "Địa chỉ email", "Chức vụ", "Doanh nghiệp", "Kết quả lọc"]} rows={contacts.map(item => [item.full_name || "—", <ContactEmail key={item.id} contact={item} />, item.job_title || "—", item.company || "—", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) ? "Email không hợp lệ" : "Kiểm tra"])}/>
          </Card>
          <div className="next-actions-bar"><Button onClick={() => go("manager-review-detail")}>Quay lại kiểm tra</Button></div>
        </Page>;
      if (screen === "manager-review-reject")
        return <Page section="Kiểm tra danh sách" title="Nhận xét danh sách" go={go}>
          {feedback}
          <Card title="Lý do không đạt"><dl className="next-details"><dt>Danh sách đã kiểm tra</dt><dd>{current.name}</dd><dt>Contact</dt><dd>{n(current.contact_count)}</dd></dl>
            <Field disabled={busy} label="Nhận xét của trưởng phòng" value={decisionNote} set={setDecisionNote} rows={5} required />
            <p className="next-hint">Nhận xét này đi cùng kết quả gửi cho nhân viên tạo danh sách.</p>
          </Card>
          <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("manager-review-detail")}>Hủy</Button><Button primary disabled={busy || !decisionNote.trim()} onClick={() => void run(() => api(`contact-lists/${current.id}/approval`, "POST", { decision: "rejected", comment: decisionNote }), "Đã trả danh sách kèm nhận xét.", "manager-review-rejected")}>Xác nhận không đạt</Button></div>
        </Page>;
      if (screen === "manager-review-approved" || screen === "manager-review-rejected")
        return <Page section="Kiểm tra danh sách" title="Kết quả kiểm tra danh sách" className="next-manager-review-result" description={current.name} go={go}>
          {feedback}
          <Card title={current.manager_review === "approved" ? "Đã duyệt" : current.manager_review === "rejected" ? "Danh sách không đạt" : "Chờ duyệt"}>
            <Table heads={["Thông tin", "Giá trị"]} rows={[
              ["Trạng thái danh sách", current.manager_review === "approved" ? "Danh sách đã duyệt" : current.manager_review === "rejected" ? "Danh sách không đạt" : "Chờ duyệt"],
              ["Người duyệt · thời điểm", `Trưởng phòng Marketing · ${date(current.reviewed_at)}`],
              ...(current.manager_review !== "approved" ? [["Nhận xét", current.manager_comment || decisionNote || "—"]] : []),
              ["Thông báo kết quả", "Nhân viên tạo danh sách có thể xem kết quả kiểm tra"],
            ]} />
            <p className={`mgr-callout ${current.manager_review === "approved" ? "success" : ""}`}>Nhân viên tạo danh sách có thể xem kết quả cùng nhận xét của trưởng phòng.</p>
          </Card>
          <div className="next-actions-bar"><Button primary onClick={() => go("manager-review")}>Về danh sách</Button></div>
        </Page>;
      if (screen === "manager-review-detail")
        return <Page section="Kiểm tra danh sách" title="Chi tiết danh sách Contact" go={go}>
          {feedback}
          <Card title="Kết quả lọc người nhận">
            <div className="mgr-stats">{[["Contact ban đầu", n(current.search_received ?? current.contact_count)], ["Email không hợp lệ", n(invalid)], ["Email trùng", n(duplicates)], ["Người nhận hợp lệ", n(valid)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <div className="mgr-list-heading"><h2>Người nhận hợp lệ</h2><button type="button" onClick={() => go("manager-review-all-contacts")}>Xem toàn bộ danh sách</button></div>
            <Table heads={["Họ tên", "Địa chỉ email", "Chức vụ", "Doanh nghiệp"]} rows={contacts.filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)).slice(0, 5).map(item => [item.full_name || "—", <ContactEmail key={item.id} contact={item} />, item.job_title || "—", item.company || "—"])} />
            <p className="mgr-callout">{current.name}</p>
          </Card>
          <div className="next-actions-bar">
            <Button onClick={() => { setDecisionNote(""); go("manager-review-reject"); }}>Không đạt</Button>
            <Button onClick={() => go("manager-review")}>Quay lại</Button>
            <Button primary disabled={busy || current.manager_review !== "pending"} onClick={() => void run(() => api(`contact-lists/${current.id}/approval`, "POST", { decision: "approved" }), "Đã duyệt danh sách.", "manager-review-approved")}>Duyệt</Button>
          </div>
        </Page>;
    }
    if (!manager && current) {
      const showAll = (from: string) => { setContactPage(1); setContactReturnScreen(from); go("all-contacts"); };
      if (screen === "all-contacts") return <Page section="Danh sách Contact" title="Toàn bộ Contact" go={go}>
        {feedback}<Card title={current.name}><ContactAudit list={current} /><p>Hiển thị {current.contacts?.length ? (contactPage - 1) * 10 + 1 : 0}–{Math.min(contactPage * 10, current.contacts?.length || 0)} trong {n(current.contact_count)} Contact · Trang {contactPage}/{Math.max(1, Math.ceil((current.contacts?.length || 0) / 10))}</p>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice((contactPage - 1) * 10, contactPage * 10).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} />, c.job_title || "—", c.company || "—"])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go(contactReturnScreen)}>Quay lại</Button><Button disabled={contactPage <= 1} onClick={() => setContactPage(p => p - 1)}>Trang trước</Button><Button primary disabled={contactPage >= Math.ceil((current.contacts?.length || 0) / 10)} onClick={() => setContactPage(p => p + 1)}>Trang tiếp</Button></div>
      </Page>;
      if (screen === "check-rejected") return <Page section="Danh sách Contact" title="Danh sách chưa đạt yêu cầu" go={go}>{feedback}<FigmaState error title="Danh sách chưa đạt yêu cầu" description="Kết quả kiểm tra đã được lưu. Danh sách chưa được xác nhận." actions={<><Button onClick={() => go("check")}>Kiểm tra lại</Button><Button primary onClick={() => go("contact-lists")}>Quay lại danh sách</Button></>} /></Page>;
      if (screen === "check") return <Page section="Danh sách Contact" title="Kiểm tra danh sách" go={go}>
        {feedback}<Card>
          <ContactAudit list={current} />
          <div className="mgr-list-heading"><h2>Danh sách cần kiểm tra</h2><button type="button" onClick={() => showAll(screen)}>Xem toàn bộ Contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} />, c.job_title || "—", c.company || "—"])} />
          <p className="next-hint">Email: định dạng · tên miền · khả năng sử dụng từ nguồn · trùng lặp. Lưu kết quả kiểm tra chưa tự xác nhận danh sách.</p>
        </Card>
        <div className="next-actions-bar"><Button disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "failed" }), "Đã ghi kết quả không đạt.", "check-rejected")}>Lưu: Chưa đạt yêu cầu</Button><Button primary disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "passed" }), "Đã ghi kết quả đạt.", "confirm")}>Lưu: Đạt yêu cầu</Button></div>
      </Page>;
      if (screen === "confirm") return <Page section="Danh sách Contact" title="Xác nhận danh sách Contact" go={go}>
        {feedback}<Card title={`${current.name} · DS-${current.id}`}><ContactAudit list={current} criteria />
          <p>Kết quả kiểm tra: {current.employee_review === "passed" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"} · Trạng thái xác nhận: {current.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</p>
          <div className="mgr-list-heading"><h2>Contact trong danh sách</h2><button type="button" onClick={() => showAll("confirm")}>Xem toàn bộ Contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} />, c.job_title || "—", c.company || "—"])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("check")}>Quay lại</Button><Button primary disabled={busy || current.employee_review !== "passed" || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/confirm`, "POST"), "Đã xác nhận danh sách và gửi Trưởng phòng duyệt.", "confirmed")}>Xác nhận danh sách</Button></div>
      </Page>;
      if (screen === "confirmed") return <Page section="Danh sách Contact" title="Danh sách đã xác nhận" go={go}>
        {feedback}<Card><ContactAudit list={current} /><p>Kết quả kiểm tra: {current.employee_review === "passed" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"} · Trạng thái danh sách: {current.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</p><p>{n(current.contact_count)} Contact · Trưởng phòng: {current.manager_review === "approved" ? "Đã duyệt" : current.manager_review === "rejected" ? "Không đạt" : "Chờ duyệt"}</p><div className="mgr-list-heading"><h2>Contact trong danh sách</h2><button type="button" onClick={() => showAll("confirmed")}>Xem toàn bộ Contact</button></div><Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} />, c.job_title || "—", c.company || "—"])} /></Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("export")}>Xuất danh sách</Button></div>
      </Page>;
      if (screen === "export-success") return <Page section="Danh sách Contact" title="Xuất dữ liệu thành công" description="Tệp xuất đã sẵn sàng." go={go}>{feedback}<FigmaState title="Tệp đã được tạo và sẵn sàng tải xuống." actions={<Button onClick={() => go("confirmed")}>Quay lại danh sách</Button>}>{exportFile && <a download={exportFile.name} href={exportFile.url}>{exportFile.name}</a>}</FigmaState></Page>;
      if (screen === "export") return <Page section="Danh sách Contact" title={screen === "export" ? "Xuất danh sách Contact" : "Xuất danh sách thành công"} go={go}>
         {feedback}<section className="flow-panel export-panel"><h2>Danh sách: {current.name} · {n(current.contact_count)} Contact</h2><p>Chọn định dạng tệp</p>
           <div className="format-grid">{(["CSV", "XLSX", "JSON", "XML"] as const).map(format => <label key={format} className={exportFormat === format ? "selected-format" : ""}><input type="radio" name="export-format" disabled={busy} checked={exportFormat === format} onChange={() => setExportFormat(format)} />{format} (.{format.toLowerCase()})</label>)}</div>
           <p>Giữ nguyên giá trị đang lưu; trường thiếu dữ liệu được giữ trống.</p>
         </section>
         <div className="next-actions-bar"><Button onClick={() => go("confirmed")}>Quay lại danh sách</Button><Button primary disabled={busy || !exportFormat || !current.contacts?.length} onClick={() => void run(async () => {
           if (!exportFormat) return;
           const blob = await createContactExport(exportFormat, current.contacts!.map(c => ({ name: c.full_name || "", email: c.email, role: c.job_title || "", company: c.company || "", ...(c.search_provenance ? { source: c.source_url || "", note: "Email: Đã xác nhận nguồn công khai và cú pháp; chưa kiểm tra khả năng nhận thư. Thông tin suy đoán: Chưa đảm bảo." } : {}) })));
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = `contact-list-${current.id}.${exportFormat.toLowerCase()}`; link.click();
          setExportFile({ url, name: link.download });
         }, "Đã xuất danh sách Contact.", "export-success")}>{busy ? "Đang tạo tệp…" : exportFormat ? `Xuất ${exportFormat}` : "Xuất tệp"}</Button></div>
      </Page>;
    }
    return (
      <Page
        section={manager ? "Kiểm tra danh sách" : "Danh sách Contact"}
        title={manager ? "Kiểm tra danh sách" : "Chi tiết danh sách Contact"}
        go={go}
      >
        {feedback}
        {current ? (
          <>
            <Card title={current.name}>
              <p>
                {n(current.contact_count ?? current.contacts?.length)} Contact · Nhân viên kiểm tra:{" "}
                {current.employee_review === "passed"
                  ? "Đạt"
                  : current.employee_review === "failed"
                    ? "Không đạt"
                    : "Chưa kiểm tra"}{" "}
                · Trưởng phòng:{" "}
                {current.manager_review === "approved"
                  ? "Đã duyệt"
                  : current.manager_review === "rejected"
                    ? "Không đạt"
                    : "Chờ duyệt"}
              </p>
              {current.manager_comment && (
                <p>Nhận xét: {current.manager_comment}</p>
              )}
              <Table
                heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]}
                rows={(current.contacts ?? []).map((c) => [
                  c.full_name || "—",
                  <ContactEmail key={c.id} contact={c} />,
                  c.job_title || "—",
                  c.company || "—",
                ])}
              />
            </Card>
            <div className="next-actions-bar">
              {manager
                ? current.confirmed_at &&
                  current.manager_review === "pending" && (
                    <>
                      <Field disabled={busy}
                        label="Nhận xét khi không đạt"
                        value={decisionNote}
                        set={setDecisionNote}
                      />
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              api(
                                `contact-lists/${current.id}/approval`,
                                "POST",
                                { decision: "rejected", comment: decisionNote },
                              ),
                            "Đã trả danh sách kèm nhận xét.",
                            "manager-review",
                          )
                        }
                      >
                        Không đạt
                      </Button>
                      <Button
                        primary
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              api(
                                `contact-lists/${current.id}/approval`,
                                "POST",
                                { decision: "approved" },
                              ),
                            "Đã duyệt danh sách.",
                            "manager-review",
                          )
                        }
                      >
                        Duyệt
                      </Button>
                    </>
                  )
                : !current.confirmed_at && (
                    <>
                      <Button primary onClick={() => go("check")}>Kiểm tra danh sách</Button>
                    </>
                  )}
              {!manager && !!current.confirmed_at && <Button primary onClick={() => go("confirmed")}>Xem danh sách đã xác nhận</Button>}
            </div>
          </>
        ) : (
          !loading && <Card>Không tìm thấy danh sách Contact.</Card>
        )}
      </Page>
    );
  }

  if (group === "campaigns") {
    const openCampaignEmail = (item: Campaign) => { setEditingSection(true); setSelected(item.id); setPreviewDraft(null); setSubject(item.subject || ""); setBody(item.body || ""); setPreviewResult(null); setPreviewContactId(""); setResumeEmailViewed(false); setConfirmEmailViewed(false); setShowCampaignEditChoice(false); setEditingSection(true); go("campaign-editor"); };
    const campaignEditDialog = editCampaign && <Dialog pending={busy} title="Thông tin chung" onClose={() => setEditCampaign(null)} cancelLabel="Hủy" className="next-campaign-edit-dialog" confirmLabel="Lưu" onConfirm={() => {
      if (!editCampaign.name.trim() || editCampaign.name.length > 100) {
        setEditCampaignError("Vui lòng nhập tên chiến dịch, tối đa 100 ký tự."); return;
      }
      void run<Campaign>(() => api(`campaigns/${editCampaign.id}`, "PATCH", { name: editCampaign.name, description: editCampaign.description }), "Đã cập nhật thông tin chiến dịch.", undefined, failure => setEditCampaignError(failure.message))
        .then(saved => { if (saved) { setCampaigns(items => items.map(item => item.id === saved.id ? { ...item, ...saved } : item)); setEditCampaign(null); } });
    }}>
      <label className="next-field">Tên chiến dịch (bắt buộc)<input value={editCampaign.name} onChange={event => setEditCampaign({ ...editCampaign, name: event.target.value })} maxLength={100} /></label>
      <p className="next-hint">Tối đa 100 ký tự.</p>
      <label className="next-field">Mô tả<textarea value={editCampaign.description} onChange={event => setEditCampaign({ ...editCampaign, description: event.target.value })} rows={4} /></label>
      {editCampaignError && <p role="alert" className="next-error">{editCampaignError}</p>}
    </Dialog>;
    if (screen === "campaign-list")
      return (
        <Page section="Chiến dịch" title="Chiến dịch" go={go}>
          {feedback}
          <div className="next-toolbar">
            <Button
              primary
              onClick={() => {
                setName("");
                setDescription("");
                setSelectedLists([]);
                go("campaign-contacts");
              }}
            >
              ＋ Tạo chiến dịch mới
            </Button>
          </div>
          <div className="next-table-wrap"><table className="next-table next-campaign-table"><thead><tr>
            <th>Tên</th><th>Trạng thái</th><th>Tiến độ</th><th>Ngày tạo</th><th>Thao tác</th>
          </tr></thead><tbody>{campaigns.length ? campaigns.map(item => <tr key={item.id}>
            <td><strong>{item.name}</strong></td><td>{campaignStatuses[item.status] || item.status}</td>
            <td>{n(item.sent_count)}/{n(item.recipient_count)}</td><td>{date(item.created_at)}</td>
            <td className="next-row-actions"><div className="next-campaign-actions">
              {item.sent_count === 0 && ["draft", "approved", "scheduled", "paused"].includes(item.status) && <button className="danger-link" onClick={() => { setSelected(item.id); ask("Ẩn chiến dịch", `Chiến dịch “${item.name}” đã Ẩn sẽ không thể khôi phục.`, () => void run(() => api(`campaigns/${item.id}`, "DELETE"), `Đã ẩn chiến dịch “${item.name}”.`)); }}>Ẩn chiến dịch</button>}
              <button onClick={() => { setBusy(true); setError(""); void api<Campaign>(`campaigns/${item.id}`).then(setCampaignOverview).catch(reason => setFailureDialog({ title: "Không thể xem thông tin chiến dịch", message: reason.message })).finally(() => setBusy(false)); }}>Xem</button>
              {item.status === "approved" && <button onClick={() => choose(item.id, !item.subject ? "campaign-email" : !item.sender_account_id ? "campaign-sender" : !item.scheduled_at ? "campaign-schedule" : "campaign-confirm")}>Mở</button>}
              {["approved", "scheduled", "paused"].includes(item.status) && <button onClick={() => { if (item.status === "scheduled" && item.scheduled_at && Date.parse(item.scheduled_at) < Date.now() + 15 * 60000) { setFailureDialog({ title: "Không thể chỉnh sửa chiến dịch", message: "Không thể chỉnh sửa chiến dịch trước giờ gửi dưới 15 phút." }); return; } setSelected(item.id); if (item.status === "scheduled") openCampaignEdit(item); else setShowCampaignEditChoice(true); }}>Chỉnh sửa</button>}
              {item.status === "paused" && <button onClick={() => openCampaignEmail(item)}>Sửa email</button>}
              {item.status === "paused" && <button onClick={() => choose(item.id, "campaign-resume")}>Tiếp tục gửi</button>}
              {["scheduled", "sending"].includes(item.status) && <button onClick={() => openCampaignPause(item)}>Tạm dừng</button>}
            </div></td>
          </tr>) : <tr><td colSpan={5}>Chưa có chiến dịch. Tạo chiến dịch mới để bắt đầu.</td></tr>}</tbody></table></div>
          {campaignEditDialog}
          {showCampaignEditChoice && campaign && <Dialog pending={busy} title={`Chỉnh sửa chiến dịch “${campaign.name}”`} className="next-campaign-dialog" cancelLabel="Hủy" onClose={() => setShowCampaignEditChoice(false)}><p>Chọn mục cần sửa:</p><div className="next-dialog-links"><Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEdit(campaign); }}>Thông tin chung</Button><Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEmail(campaign); }}>Nội dung email</Button><Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); go("campaign-sender"); }}>Tài khoản gửi</Button><Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); go("campaign-schedule"); }}>Lịch gửi</Button></div></Dialog>}
          {campaignOverview && <Dialog pending={busy} title="Thông tin chiến dịch" className={"next-campaign-dialog" + (campaignOverview.status === "paused" ? " next-paused-detail" : "")} onClose={() => setCampaignOverview(null)}>
            <dl className="next-details">
              <dt>Tên</dt><dd>{campaignOverview.name}</dd>
              <dt>Trạng thái</dt><dd>{campaignStatuses[campaignOverview.status] || campaignOverview.status}</dd>
              <dt>Số người nhận</dt><dd>{n(campaignOverview.recipient_count)}</dd>
              <dt>Tiêu đề email</dt><dd>{campaignOverview.subject || "Chưa có nội dung"}</dd>
              <dt>Tài khoản gửi</dt><dd>{senders.find(item => item.id === campaignOverview.sender_account_id)?.email || "Chưa chọn"}</dd>
              <dt>Thời điểm bắt đầu</dt><dd>{date(campaignOverview.scheduled_at)}</dd>
              {campaignOverview.status === "paused" && <><dt>Thời điểm tạm dừng</dt><dd>{date(campaignOverview.paused_at)}</dd><dt>Lý do tạm dừng</dt><dd>{campaignOverview.pause_reason || "Không ghi lý do"}</dd></>}
            </dl>
          </Dialog>}
        </Page>
      );
    if (screen === "campaign-contacts")
      return (
        <Page section="Chiến dịch" title="Tạo chiến dịch mới" go={go}>
          {feedback}
          {!editingSection && <Stepper current={1} />}
          {emptyRecipientFilter && <Card title="Kết quả lọc"><div className="next-filter-stats"><div><strong>{emptyRecipientFilter.original}</strong><span>Tổng số contact ban đầu</span></div><div><strong>{emptyRecipientFilter.excluded}</strong><span>Số contact bị loại</span></div><div><strong>0</strong><span>Số contact hợp lệ</span></div></div><FigmaState error title="Danh sách không đủ dữ liệu hợp lệ" description={`Email trùng: ${emptyRecipientFilter.duplicate}; khách hàng từ chối nhận email: ${emptyRecipientFilter.unsubscribe}; email trống hoặc sai định dạng: ${emptyRecipientFilter.invalid}; email bị trả lại: ${emptyRecipientFilter.bounce}; đã gửi trong 7 ngày: ${emptyRecipientFilter.recent}.`} actions={<Button onClick={() => { setEmptyRecipientFilter(null); setError(""); }}>Chọn lại</Button>} /></Card>}
          <form onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const total = lists.filter(item => selectedLists.includes(item.id)).reduce((sum, item) => sum + item.contact_count, 0);
              const created = await api<Campaign>("campaigns", "POST", {
                name: name.trim(), description: description.trim(), listIds: selectedLists.map(idNumber),
              });
              setFilteredOriginalCount(total);
              setCampaigns(previous => [created, ...previous]);
              setSelected(created.id);
              setPreviewDraft(null); setSchedule(null); setSendMode(null); setSenderName(null); setSendRate(null); setWindowFrom(null); setWindowTo(null); setScheduleCalculated(null);
              return created;
            }, "Đã lọc danh sách người nhận.", "campaign-filtered", failure => {
              if (failure instanceof ApiError && failure.data.filter && typeof failure.data.filter === "object") {
                const filter = failure.data.filter as RecipientFilter;
                if (Number.isInteger(filter.original) && filter.valid === 0) setEmptyRecipientFilter(filter);
              }
            });
          }}>
            <div className="next-grid">
              <Card title="Thông tin chiến dịch">
                <Field disabled={busy} label="Tên chiến dịch" value={name} set={setName} required />
                <p className="next-hint">Tối đa 100 ký tự.</p>
                <Field disabled={busy} label="Mô tả" value={description} set={setDescription} rows={4} />
              </Card>
              <Card title="Danh sách contact “Đã xác nhận”">
                {lists.filter(item => item.manager_review === "approved" && item.confirmed_at).map(item =>
                  <label key={item.id} className="next-choice">
                    <input type="checkbox" checked={selectedLists.includes(item.id)} onChange={event =>
                      setSelectedLists(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
                    <span>{item.name}</span><small>{n(item.contact_count)} contact</small>
                  </label>
                )}
                {!lists.some(item => item.manager_review === "approved" && item.confirmed_at) &&
                  <p>Chưa có danh sách Contact được Trưởng phòng duyệt.</p>}
              </Card>
            </div>
            <div className="next-actions-bar"><Button type="submit" primary disabled={busy || !name.trim() || name.length > 100 || selectedLists.length === 0}>Áp dụng</Button></div>
          </form>
        </Page>
      );
    const d = detail as Campaign | null;
    const current = d && campaign && d.id === campaign.id
      ? { ...d, ...campaign, lists: d.lists, recipients: d.recipients }
      : campaign;
    if (!current)
      return (
        <Page section="Chiến dịch" title="Chi tiết chiến dịch" go={go}>
          {feedback}
          <Card>Chưa có chiến dịch.</Card>
        </Page>
      );
    if (["campaign-editor", "campaign-sender", "campaign-schedule"].includes(screen) && !["approved", "paused"].includes(current.status)) return <Page section="Chiến dịch" title="Không thể chỉnh sửa chiến dịch" go={go}>{feedback}<FigmaState error title="Chiến dịch không ở bước chuẩn bị hoặc tạm dừng" description="Tạm dừng chiến dịch trước khi thay đổi nội dung, tài khoản hoặc lịch gửi. Lịch sử gửi được giữ nguyên." actions={<Button onClick={() => go("campaign-list")}>Về danh sách chiến dịch</Button>} /></Page>;
    const cancelEdit = editingSection ? <Button disabled={busy} onClick={() => { setEditingSection(false); go(current.status === "paused" ? "campaign-resume" : "campaign-confirm"); }}>Hủy</Button> : null;
    const logo = assets.find(item => item.kind === "logo");
    const effectiveRate = Number(sendRate ?? current.send_rate ?? 50);
    const effectiveFrom = windowFrom ?? current.window_start?.slice(0, 5) ?? "08:00";
    const effectiveTo = windowTo ?? current.window_end?.slice(0, 5) ?? "17:00";
    const remainingCount = Math.max(0, current.recipient_count - current.sent_count);
    const summaryStart = current.send_mode === "now" ? new Date(clock).toISOString() : current.status === "paused" ? new Date(Math.max(Date.parse(current.scheduled_at || "") || 0, clock + 15 * 60000)).toISOString() : current.scheduled_at || "";
    const update = (
      path: string,
      method: string,
      payload: unknown,
      message: string,
      next: string,
    ) =>
      void run(
        () => api(`campaigns/${current.id}/${path}`, method, payload),
        message,
        next,
      );
    if (screen === "campaign-filtered")
      return (
        <Page section="Chiến dịch" title="Tạo chiến dịch mới" go={go}>
          {feedback}
          {!editingSection && <Stepper current={1} />}
          <div className="next-grid">
            <Card title="Thông tin chiến dịch">
              <div className="next-field"><label htmlFor="filtered-campaign-name">Tên chiến dịch</label><input id="filtered-campaign-name" value={current.name} readOnly /></div>
              <p className="next-hint">Tối đa 100 ký tự.</p>
              <div className="next-field"><label htmlFor="filtered-campaign-description">Mô tả</label><textarea id="filtered-campaign-description" value={current.description || ""} rows={4} readOnly /></div>
            </Card>
            <Card title="Danh sách contact “Đã xác nhận”">
              {(current.lists?.length ? current.lists : lists.filter(item => selectedLists.includes(item.id))).map(item => <label key={item.id} className="next-choice"><input type="checkbox" checked readOnly />{item.name}</label>)}
            </Card>
          </div>
          <Card title="Kết quả lọc">
            <div className="next-filter-stats">
              <div><strong>{n(current.filter_summary?.original ?? (filteredOriginalCount || lists.filter(item => current.lists?.some(selected => selected.id === item.id)).reduce((sum, item) => sum + item.contact_count, 0)))}</strong><span>Tổng số contact ban đầu</span></div>
              <div><strong>{n(Math.max(0, (current.filter_summary?.original ?? (filteredOriginalCount || lists.filter(item => current.lists?.some(selected => selected.id === item.id)).reduce((sum, item) => sum + item.contact_count, 0))) - current.recipient_count))}</strong><span>Số contact bị loại hoặc trùng</span></div>
              <div><strong>{n(current.recipient_count)}</strong><span>Số contact hợp lệ</span></div>
            </div>
          </Card>
          <div className="next-actions-bar">
            <Button disabled={busy} onClick={() => void run(async () => {
              await api(`campaigns/${current.id}`, "DELETE");
              setSelected("");
              return true;
            }, "Đã bỏ bản nháp để chọn lại danh sách.", "campaign-contacts")}>Chọn lại</Button>
            <Button primary disabled={busy} onClick={() => void run(() => api(`campaigns/${current.id}/recipients/confirm`, "POST"), "Đã lưu danh sách người nhận.", "campaign-pending")}>Xác nhận danh sách người nhận</Button>
          </div>
        </Page>
      );
    if (screen === "campaign-pending")
      return <Page section="Chiến dịch" title={current.name} go={go}>
        {feedback}
        {!editingSection && <Stepper current={1} />}
        <div className="next-notice" role="status"><div><strong>Danh sách người nhận đã sẵn sàng</strong><span>Danh sách Contact đã được Trưởng phòng duyệt. Tiếp tục chọn hoặc soạn mẫu email.</span></div></div>
        <section className="next-card next-pending-card"><h2>Chiến dịch</h2><dl className="next-details"><dt>Tên chiến dịch</dt><dd>{current.name}</dd><dt>Trạng thái</dt><dd>Đang chuẩn bị</dd><dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd></dl></section>
        <div className="next-actions-bar"><Button primary onClick={() => go("campaign-email")}>Tiếp tục soạn email</Button></div>
      </Page>;
    if (screen === "campaign-layouts")
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <Card title="Bố cục trống">
            <div className="next-layout-grid">{[1, 2, 3].map(number =>
              <div className="next-layout-option" key={number}>
                <div aria-hidden="true"><span /><span /><span /></div>
                <strong>Bố cục trống {number}</strong>
                <Button onClick={() => { setSubject(""); setBody(""); setPreviewResult(null); go("campaign-editor"); }}>Chọn bố cục</Button>
              </div>)}</div>
          </Card>
        </Page>
      );
    if (screen === "campaign-email")
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          {feedback}
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-toolbar compact"><Button onClick={() => go("campaign-layouts")}>＋ Soạn email mới</Button></div>
          <Card title="Thư viện mẫu email">
            <Table
              heads={["Tên mẫu", "Danh mục", "Ngày cập nhật", "Thao tác"]}
              rows={templates.map((item) => [
                item.name,
                item.category || "Mẫu đã lưu",
                date(item.created_at),
                <Button
                  key={item.id}
                  onClick={() => {
                    const namedOnly = ["Giới thiệu sản phẩm", "Bản tin định kỳ"].includes(item.name);
                    if (namedOnly) { setSubject(""); setBody(""); go("campaign-editor"); return; }
                    void run(() => api<{ subject: string; body: string }>(`email-templates/${item.id}/apply`, "POST", { campaignId: idNumber(current.id) }), "Đã chọn mẫu email.").then(applied => {
                      if (!applied) return;
                      setSubject(applied.subject);
                      setBody(applied.body);
                      setPreviewResult(null);
                      go("campaign-editor");
                    });
                  }}
                >
                  Chọn mẫu
                </Button>,
              ])}
            />
          </Card>
        </Page>
      );
    if (screen === "campaign-editor")
      return (
        <Page section="Chiến dịch" title={current.name} className="next-live-editor" go={go}>
          {feedback}
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-editor-layout">
            <section className="next-card next-editor-main">
              <h2>Trình soạn thảo</h2>
              <div className="next-field"><label htmlFor="campaign-subject">Tiêu đề email *</label>
                <input id="campaign-subject" aria-invalid={!!error && !subject.trim()} value={subject} maxLength={150} onChange={event => { setSubject(event.target.value); setPreviewResult(null); }} required /></div>
              <p className="next-hint">Tối đa 150 ký tự.</p>{error && !subject.trim() && <p className="next-field-error">Vui lòng nhập tiêu đề email.</p>}{invalidEmailVariable(subject + "\n" + body) && <p role="alert" className="next-field-error">{invalidEmailVariable(subject + "\n" + body)}</p>}
              <div className="next-editor-toolbar" role="toolbar" aria-label="Định dạng nội dung">
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => editorBodyRef.current?.format("bold")}>Đậm</button>
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => editorBodyRef.current?.format("italic")}>Nghiêng</button>
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => editorBodyRef.current?.format("underline")}>Gạch chân</button>
                <button type="button" onClick={() => insertEditorText("\n• ")}>Danh sách</button>
                <button type="button" onClick={() => insertEditorText("https://")}>Liên kết</button>
              </div>
              <div className="next-email-canvas layout-1">
                <span className="next-logo-chip">{logo ? <><img src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="" />{logo.file_name}</> : "Chưa chọn logo"}</span>
                <label htmlFor="campaign-body" className="sr-only">Nội dung email</label>
                <CampaignEditor disabled={busy} ref={editorBodyRef} value={body} campaignId={current.id} onChange={value => { setBody(value); setPreviewResult(null); }} onBlock={type => { if (type === "image") imageInputRef.current?.click(); if (type === "button") { setError(""); setButtonBlock({ label: "", url: "" }); } }} />
                <div className="next-unsubscribe">Liên kết từ chối nhận email (tự động, không xóa được)</div>
              </div>
            </section>
            <aside className="next-editor-aside">
              <Card title="Khối kéo thả">
                <input ref={imageInputRef} className="sr-only" type="file" accept="image/png,image/jpeg" aria-label="Chọn ảnh nội dung email" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id, "image").then(saved => { if (saved) insertEditorText(`[[Hình ảnh:${saved.id}]]`); }); event.target.value = ""; }} />
                {[["Văn bản", "\n"], ["Đường phân cách", "[[Đường phân cách]]"]].map(([label, content]) =>
                  <button key={label} className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("text/plain", content)} onClick={() => insertEditorText(content)}>{label}</button>)}
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("application/x-v5-block", "image")} onClick={() => imageInputRef.current?.click()}>Hình ảnh</button>
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("application/x-v5-block", "button")} onClick={() => { setError(""); setButtonBlock({ label: "", url: "" }); }}>Nút</button>
              </Card>
              <Card title="Chèn">
                <Button onClick={() => insertEditorText("{{Họ tên}}")}>Chèn biến cá nhân hóa</Button>
                <Button onClick={() => { setError(""); setShowLogoLibrary(true); }}>Chọn logo từ thư viện</Button>
                <label className="next-button next-file-button">Tải ảnh logo lên
                  <input type="file" disabled={busy} accept="image/png,image/jpeg,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
                <label className="next-button next-file-button">Đính kèm brochure PDF
                  <input type="file" disabled={busy} accept="application/pdf" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
              </Card>
              <Card title="Tệp đính kèm">
                {assets.length ? assets.map(item => <div key={item.id} className="next-inline"><span>{item.file_name}</span><Button disabled={busy} onClick={() => void run(() => api(`campaigns/${current.id}/assets/${item.id}`, "DELETE"), "Đã Ẩn tệp.").then(deleted => { if (deleted) { setPreviewResult(null); if (item.kind === "image") setBody(current => current.replaceAll(`[[Hình ảnh:${item.id}]]`, "")); } })}>Ẩn</Button></div>) : <p>Chưa có tệp đính kèm</p>}
              </Card>
              <details className="next-template-save"><summary>Lưu thành mẫu email</summary>
                <Field disabled={busy} label="Tên mẫu" value={templateName} set={setTemplateName} />
                <Button
                  disabled={
                    busy || !templateName.trim() || !subject.trim() || !body.trim()
                  }
                  onClick={() =>
                    void run(
                      () =>
                        api("email-templates", "POST", {
                          name: templateName,
                          subject,
                          body,
                          campaignId: idNumber(current.id),
                        }),
                      "Đã lưu mẫu email.",
                    )
                  }
                >
                  Lưu mẫu
                </Button>
              </details>
            </aside>
          </div>
          {showLogoLibrary && <Dialog pending={busy} title="Chọn logo từ thư viện" onClose={() => setShowLogoLibrary(false)}>
            <button className="next-library-logo" type="button" disabled={busy} onClick={() => void chooseLibraryLogo(current.id)}>
              <img src="/logo-v5.png" alt="" />
              <span>Logo V5</span>
            </button>
            {error && <p className="next-error" role="alert">{error}</p>}
          </Dialog>}
          {buttonBlock && <Dialog pending={busy} title="Chèn nút vào email" onClose={() => setButtonBlock(null)} onConfirm={() => {
            let valid = false;
            try { const link = new URL(buttonBlock.url); valid = link.protocol === "https:" && !link.username && !link.password; } catch { /* Show field error below. */ }
            if (!buttonBlock.label.trim() || buttonBlock.label.length > 80 || /\||\[|\]/.test(buttonBlock.label) || !valid) { setError("Nhập tên nút và liên kết HTTPS hợp lệ."); return; }
            insertEditorText(`[[Nút:${buttonBlock.label.trim()}|${buttonBlock.url.trim()}]]`);
            setButtonBlock(null); setError("");
          }} confirmLabel="Chèn nút" cancelLabel="Hủy">
            <label className="next-field">Tên nút<input value={buttonBlock.label} maxLength={80} onChange={event => setButtonBlock({ ...buttonBlock, label: event.target.value })} /></label>
            <label className="next-field">Liên kết HTTPS<input type="url" value={buttonBlock.url} onChange={event => setButtonBlock({ ...buttonBlock, url: event.target.value })} placeholder="https://..." /></label>
            {error && <p className="next-error" role="alert">{error}</p>}
          </Dialog>}
          <p className="next-hint">Nội dung {previewResult ? "đã được xem trước" : "chưa được xem trước sau lần chỉnh sửa cuối"}.</p>
          <div className="next-actions-bar">{cancelEdit}
            <Button disabled={busy} onClick={() => {
              if (!subject.trim() || !body.trim() || invalidEmailVariable(subject + "\n" + body)) { setError(invalidEmailVariable(subject + "\n" + body) || "Vui lòng nhập tiêu đề và nội dung email."); return; }
              setError("");
              setPreviewResult(null);
              setPreviewDraft({ subject, body });
              go("campaign-preview");
            }}>Xem trước</Button>
            <Button primary disabled={busy || !previewResult} onClick={() => update("content", "PATCH", { subject, body, requirePreview: true }, "Đã lưu nội dung email.", current.status === "paused" ? "campaign-resume" : editingSection ? "campaign-confirm" : "campaign-sender")}>Lưu nội dung</Button>
          </div>

        </Page>
      );
    if (screen === "campaign-preview" && error && !previewResult)
      return <Page section="Chiến dịch" title="Xem trước email" crumbLabel={current.name} description={null} go={go}>
        <Card title="Không tạo được bản xem trước">
          <p role="alert">{error}</p>
          <p>Nội dung đang soạn được giữ nguyên.</p>
          <Button primary onClick={() => go("campaign-editor")}>Quay lại trình soạn thảo</Button>
        </Card>
      </Page>;
    if (screen === "campaign-preview")
      return (
        <Page section="Chiến dịch" title="Xem trước email" crumbLabel={current.name} description={null} go={go}>
          {feedback}
          <div className="next-preview-controls">
            <div className="next-inline" role="group" aria-label="Kiểu hiển thị">
              <Button primary={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Máy tính</Button>
              <Button primary={previewDevice === "phone"} onClick={() => setPreviewDevice("phone")}>Điện thoại</Button>
            </div>
            <label className="next-field">Contact dùng để xem trước
              <select value={previewContactId || current.recipients?.[0]?.id || ""} onChange={event => { setError(""); setPreviewResult(null); setPreviewContactId(event.target.value); }}>
                {(current.recipients ?? []).map(contact => <option key={contact.id} value={contact.id}>{contact.full_name || contact.email} - {contact.email}</option>)}
              </select>
              <small>Mặc định: contact đầu tiên trong danh sách người nhận.</small>
            </label>
          </div>
          <section className="next-preview-stage">
            <div className={"next-card next-mail " + (previewDevice === "phone" ? "phone" : "")}>
              {previewResult ? <>
                <h2>Tiêu đề: {previewResult.subject}</h2>
                {logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}
                <div className="next-mail-body" style={{ whiteSpace: "pre-wrap" }}><PreviewBody value={previewResult.body} campaignId={current.id} /></div>
                {assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>{item.file_name}</small>)}
                <a href="#unsubscribe" onClick={event => event.preventDefault()}>Từ chối nhận email</a>
              </> : <p>{error || "Đang tạo bản xem trước theo dữ liệu Contact đầu tiên..."}</p>}
            </div>
          </section>
          <div className="next-actions-bar">
            <Button primary disabled={!previewResult} onClick={() => go("campaign-editor")}>Đóng xem trước</Button>
          </div>
        </Page>
      );
    if (screen === "campaign-sender")
      return (
        <Page section="Chiến dịch" title={current.name} className="next-sender-page" go={go}>
          {feedback}
          {!editingSection && <Stepper current={3} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <Card title="Tài khoản gửi “Hoạt động”">
            <Table
              heads={["Chọn", "Địa chỉ email", "Tên hiển thị", "Giới hạn gửi trong 3 ngày", "Đã gửi", "Hạn mức còn lại"]}
              rows={senders
                .filter((item) => item.status === "active" && item.configured)
                .map((item) => [
                  <input
                    key={item.id}
                    type="radio"
                    name="sender"
                    aria-label={`Chọn ${item.name}`}
                    checked={senderId === item.id}
                    disabled={busy || item.quota_3_days - item.used_3_days < current.recipient_count - current.sent_count}
                    onChange={() => { setSenderId(item.id); setSenderName(item.name); }}
                  />,
                  item.email,
                  item.name,
                  n(item.quota_3_days),
                  n(item.used_3_days),
                  n(Math.max(0, item.quota_3_days - item.used_3_days)),
                ])}
            />
          </Card>
          {senderId && <Card title="Người gửi">
            <Field disabled={busy} label="Tên người gửi hiển thị" value={senderName ?? current.sender_name ?? senders.find(item => item.id === senderId)?.name ?? ""} set={setSenderName} error={error && (!senderName?.trim() || senderName.length > 50) ? "Vui lòng nhập tên người gửi, tối đa 50 ký tự." : undefined} required />
            <p><strong>Địa chỉ email gửi</strong><br />{senders.find(item => item.id === senderId)?.email}</p>
          </Card>}
          {!senders.some(item => item.status === "active" && item.configured && item.quota_3_days - item.used_3_days >= current.recipient_count - current.sent_count) && <FigmaState error title="Chưa có tài khoản gửi phù hợp" description="Tài khoản phải hoạt động, có kết nối và đủ hạn mức cho người nhận chưa gửi." actions={<Button onClick={() => setReload(value => value + 1)}>Tải lại tài khoản</Button>} />}
          {senderId && <div className="next-actions-bar">{cancelEdit}
            <Button primary disabled={busy || !senders.some(item => item.id === senderId && item.status === "active" && item.configured && item.quota_3_days - item.used_3_days >= (current.status === "paused" ? Math.max(0, current.recipient_count - current.sent_count) : current.recipient_count))}
              onClick={() => update("sender", "PATCH", { senderAccountId: idNumber(senderId), senderName: senderName ?? current.sender_name ?? senders.find(item => item.id === senderId)?.name }, "Đã chọn tài khoản gửi.", current.status === "paused" ? "campaign-resume" : editingSection ? "campaign-confirm" : "campaign-schedule")}>Xác nhận tài khoản</Button>
          </div>}
        </Page>
      );
    if (screen === "campaign-schedule") {
      const selectedMode = sendMode ?? current.send_mode ?? "scheduled";
      const scheduleValue = schedule ?? (current.scheduled_at ? new Date(new Date(current.scheduled_at).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");
      const calculated = scheduleCalculated ?? !!current.scheduled_at;
      return (
        <Page section="Chiến dịch" title={current.name} className="next-schedule-page" go={go}>
          {feedback}
          {!editingSection && <Stepper current={4} />}
          <div className="next-campaign-info">
            <div><span>Số người nhận</span><strong>{n(current.recipient_count)}</strong></div>
            <div><span>Tài khoản gửi</span><strong>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</strong></div>
            <div><span>Giới hạn gửi trong 3 ngày</span><strong>{n(senders.find(item => item.id === current.sender_account_id)?.quota_3_days)}</strong></div>
          </div>
          <Card title="Lịch gửi">
            <div className="next-field"><label>Kiểu gửi</label><div className="next-inline">
              <label><input type="radio" name="campaign-send-mode" checked={selectedMode === "scheduled"} onChange={() => { setSendMode("scheduled"); setScheduleCalculated(false); }} /> Hẹn giờ</label>
              <label><input type="radio" name="campaign-send-mode" checked={selectedMode === "now"} onChange={() => { setSendMode("now"); setScheduleCalculated(true); }} /> Gửi ngay</label>
            </div></div>
            <div className="next-grid">
              <div className="next-field"><label htmlFor="campaign-send-date">Ngày bắt đầu</label>{selectedMode === "now" ? <input id="campaign-send-date" value="Ngay sau khi chiến dịch được xác nhận" readOnly /> : <input id="campaign-send-date" type="date" value={scheduleValue.slice(0, 10)} onChange={event => { setSchedule(event.target.value + "T" + (scheduleValue.slice(11, 16) || "09:00")); setScheduleCalculated(false); }} />}<small>Múi giờ GMT+7</small></div>
              <div className="next-field"><label htmlFor="campaign-send-time">Giờ bắt đầu</label>{selectedMode === "now" ? <input id="campaign-send-time" value="--:--" readOnly /> : <input id="campaign-send-time" type="time" value={scheduleValue.slice(11, 16)} onChange={event => { setSchedule((scheduleValue.slice(0, 10) || new Date(clock).toISOString().slice(0, 10)) + "T" + event.target.value); setScheduleCalculated(false); }} />}<small>HH:mm</small></div>
            </div>
            <div className="next-grid next-three">
              <div className="next-field"><label htmlFor="campaign-speed">Tốc độ gửi (email/giờ)</label><input id="campaign-speed" type="number" min="1" max="100" value={sendRate ?? current.send_rate ?? 50} onChange={event => { setSendRate(event.target.value); setScheduleCalculated(false); }} /><small>Mặc định 50 email/giờ.</small></div>
              <div className="next-field"><label htmlFor="campaign-from">Khung giờ gửi - từ</label><input id="campaign-from" type="time" value={effectiveFrom} onChange={event => { setWindowFrom(event.target.value); setScheduleCalculated(false); }} /><small>Mặc định 08:00</small></div>
              <div className="next-field"><label htmlFor="campaign-to">Khung giờ gửi - đến</label><input id="campaign-to" type="time" value={effectiveTo} onChange={event => { setWindowTo(event.target.value); setScheduleCalculated(false); }} /><small>Mặc định 17:00</small></div>
            </div>
            {calculated && <p className="next-rule"><strong>Lịch dự kiến</strong><span>{selectedMode === "now" ? "Bắt đầu ngay sau khi xác nhận, kể cả ngoài khung giờ hẹn." : `Bắt đầu ${date(scheduleValue)}.`} Tốc độ {sendRate ?? current.send_rate ?? 50} email/giờ. Hoàn tất dự kiến: {date(expectedFinish(selectedMode === "now" ? new Date(clock).toISOString() : scheduleValue + "+07:00", remainingCount, effectiveRate, effectiveFrom, effectiveTo, selectedMode === "now"))}.</span></p>}
          </Card>
          <div className="next-actions-bar">{cancelEdit}
            {<Button disabled={(selectedMode === "scheduled" && !scheduleValue) || busy} onClick={() => {
              const issue = (selectedMode !== "now" && scheduleStartError(scheduleValue + "+07:00", effectiveFrom, effectiveTo)) || scheduleOptionsError(effectiveRate, effectiveFrom, effectiveTo);
              if (issue) { setError(issue); return; }
              setError(""); setScheduleCalculated(true);
            }}>Tính lịch dự kiến</Button>}
            {calculated && <Button primary disabled={busy} onClick={() => update("schedule", "PATCH", { sendNow: selectedMode === "now", scheduledAt: selectedMode === "now" ? undefined : new Date(scheduleValue + "+07:00").toISOString(), rate: effectiveRate, windowStart: effectiveFrom, windowEnd: effectiveTo }, "Đã lưu lịch gửi.", current.status === "paused" ? "campaign-resume" : "campaign-confirm")}>Lưu lịch gửi</Button>}
          </div>
        </Page>
      );
    }
    if (screen === "campaign-confirm")
      return (
        <Page section="Chiến dịch" title={current.name} className="next-confirm-page" go={go}>
          {feedback}
          <Stepper current={5} />
          <div className="next-grid next-confirm-grid">
            <Card title="Danh sách người nhận"><p className="next-validity">{current.recipient_count > 0 ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Tên danh sách</dt><dd>{current.lists?.map(item => item.name).join("; ") || lists.filter(item => selectedLists.includes(item.id)).map(item => item.name).join("; ") || "—"}</dd>
              <dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd>
              <dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd><dt>Thời điểm duyệt</dt><dd>{current.lists?.map(item => `${item.name}: ${date(item.reviewed_at)}`).join("; ") || "—"}</dd>
            </dl></Card>
            <Card title="Nội dung email"><p className="next-validity">{current.subject && current.body ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Tiêu đề</dt><dd>{current.subject || "" || "—"}</dd>
              <dt>Ảnh thu nhỏ nội dung</dt><dd><div className="next-mail-thumb"><strong>{current.subject || ""}</strong><span>{(current.body || "").slice(0, 160)}</span></div></dd>
              <dt>Biến cá nhân hóa</dt><dd>{(current.body || "").match(/\{\{[^}]+\}\}/g)?.join(", ") || "—"}</dd>
              <dt>Tệp đính kèm</dt><dd>{assets.filter(item => item.kind === "pdf").map(item => item.file_name).join(", ") || "Không có"}</dd>
            </dl></Card>
            <Card title="Tài khoản gửi"><p className="next-validity">{senders.some(item => item.id === current.sender_account_id && item.status === "active" && item.configured && item.quota_3_days - item.used_3_days >= current.recipient_count - current.sent_count) ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Địa chỉ email</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</dd>
              <dt>Tên người gửi</dt><dd>{current.sender_name || senders.find(item => item.id === current.sender_account_id)?.name || "—"}</dd>
              <dt>Hạn mức còn lại</dt><dd>{n(Math.max(0, (senders.find(item => item.id === current.sender_account_id)?.quota_3_days || 0) - (senders.find(item => item.id === current.sender_account_id)?.used_3_days || 0)))}</dd>
            </dl></Card>
            <Card title="Lịch gửi"><p className="next-validity">{current.send_mode === "now" || (current.scheduled_at && !scheduleError(current.scheduled_at)) ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Thời điểm bắt đầu</dt><dd>{current.send_mode === "now" ? "Ngay sau khi xác nhận" : date(current.scheduled_at)}</dd>
              <dt>Tốc độ gửi</dt><dd>{current.send_rate ?? 50} email/giờ</dd>
              <dt>Thời điểm hoàn tất dự kiến</dt><dd>{date(expectedFinish(current.send_mode === "now" ? new Date(clock).toISOString() : current.scheduled_at || "", remainingCount, effectiveRate, effectiveFrom, effectiveTo, current.send_mode === "now"))}</dd><dt>Khung giờ gửi</dt><dd>{current.send_mode === "now" ? "Gửi ngay" : `${effectiveFrom}–${effectiveTo}`}</dd>
            </dl></Card>
          </div>
          <div className="next-actions-bar">
            <Button disabled={busy} onClick={() => {
              setBusy(true); setError(""); setPreviewResult(null);
              void api<{ subject: string; body: string }>(`campaigns/${current.id}/preview`, "POST", {})
                .then(result => { setPreviewResult(result); setShowConfirmEmail(true); })
                .catch(reason => setError(reason instanceof Error ? reason.message : "Không xem được nội dung email."))
                .finally(() => setBusy(false));
            }}>Xem nội dung email</Button>
            <Button onClick={() => setShowCampaignEditChoice(true)}>Chỉnh sửa</Button>
            <Button primary disabled={busy || !confirmEmailViewed || !current.subject || !current.sender_account_id || !current.scheduled_at || (current.send_mode !== "now" && !!scheduleError(current.scheduled_at))} onClick={() => ask("Xác nhận chiến dịch", `Gửi ${n(current.recipient_count)} email từ ${senders.find(item => item.id === current.sender_account_id)?.email || "tài khoản đã chọn"}, bắt đầu ${current.send_mode === "now" ? "ngay sau khi xác nhận" : date(current.scheduled_at)}?`, () => update("confirm", "POST", undefined, current.send_mode === "now" ? "Đã xác nhận. Chiến dịch bắt đầu gửi ngay." : "Đã xác nhận và lên lịch chiến dịch.", "campaign-list"), false)}>{current.send_mode === "now" ? "Xác nhận gửi ngay" : "Xác nhận gửi"}</Button>
          </div>
          {showConfirmEmail && previewResult && <Dialog pending={busy} title="Nội dung email" className="next-email-dialog" onClose={() => { setShowConfirmEmail(false); setConfirmEmailViewed(true); }}><p>Contact đầu tiên: {current.recipients?.[0]?.full_name || current.recipients?.[0]?.email || "—"} - {current.recipients?.[0]?.email || "—"}</p><div className="next-email-dialog-body"><strong>{previewResult.subject}</strong>{logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}<div><PreviewBody value={previewResult.body} campaignId={current.id} /></div>{assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>Đính kèm: {item.file_name}</small>)}</div></Dialog>}
          {showCampaignEditChoice && <Dialog pending={busy} title={`Chỉnh sửa chiến dịch “${current.name}”`} className="next-campaign-dialog" cancelLabel="Hủy" onClose={() => setShowCampaignEditChoice(false)}><p>Chọn mục cần sửa:</p><div className="next-dialog-links">
            <Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEdit(current); }}>Thông tin chung</Button>
            <Button onClick={() => openCampaignEmail(current)}>Nội dung email</Button>
            <Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); setConfirmEmailViewed(false); go("campaign-sender"); }}>Tài khoản gửi</Button>
            <Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); setConfirmEmailViewed(false); go("campaign-schedule"); }}>Lịch gửi</Button>
          </div></Dialog>}
          {campaignEditDialog}
        </Page>
      );
    if (screen === "campaign-resume") {
      const remainingRecipients = Math.max(0, current.recipient_count - current.sent_count);
      const selectedSender = senders.find(item => item.id === current.sender_account_id);
      const available = selectedSender ? selectedSender.quota_3_days - selectedSender.used_3_days : 0;
      const needsSender = !selectedSender || selectedSender.status !== "active" || !selectedSender.configured || available < remainingRecipients;
      return <Page section="Chiến dịch" title={current.name} className="next-resume-page" go={go}>
        {feedback}
        {needsSender && <div className="next-notice" role="alert"><div><strong>Cần đổi tài khoản gửi</strong><span>Tài khoản gửi không đủ hạn mức cho {n(remainingRecipients)} email còn lại. Chiến dịch giữ trạng thái “Đã tạm dừng”.</span></div><Button onClick={() => go("campaign-sender")}>Đổi tài khoản gửi</Button></div>}
        <Card title="Tình trạng gửi" className="next-send-status"><dl className="next-details">
          <dt>Số email đã gửi</dt><dd>{n(current.sent_count)}</dd>
          <dt>Số contact “Chưa gửi”</dt><dd>{n(Math.max(0, current.recipient_count - current.sent_count))}</dd>
          <dt>Trạng thái</dt><dd>{current.needs_reconfirmation ? "Chờ xác nhận lại" : campaignStatuses[current.status] || current.status}</dd>
          <dt>Thời điểm tạm dừng</dt><dd>{date(current.paused_at)}</dd>
          <dt>Lý do tạm dừng</dt><dd>{current.pause_reason || "Không ghi lý do"}</dd>
        </dl></Card>
        <div className="next-grid next-confirm-grid">
          <Card title="Danh sách người nhận"><p className="next-validity">{current.recipient_count > 0 ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Tên danh sách</dt><dd>{current.lists?.map(item => item.name).join("; ") || "—"}</dd>
            <dt>Số contact hợp lệ</dt><dd>{n(Math.max(0, current.recipient_count - current.sent_count))} (chưa gửi)</dd>
            <dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd>
            <dt>Thời điểm duyệt</dt><dd>{current.lists?.map(item => `${item.name}: ${date(item.reviewed_at)}`).join("; ") || "—"}</dd>
          </dl></Card>
          <Card title="Nội dung email"><p className="next-validity">{current.subject && current.body ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Tiêu đề</dt><dd>{current.subject || "—"}</dd>
            <dt>Ảnh thu nhỏ nội dung</dt><dd><div className="next-mail-thumb"><strong>{current.subject || "—"}</strong><span>{(current.body || "").slice(0, 160)}</span></div></dd>
            <dt>Biến cá nhân hóa</dt><dd>{(current.body || "").match(/\{\{[^}]+\}\}/g)?.join(", ") || "—"}</dd>
            <dt>Tệp đính kèm</dt><dd>{assets.filter(item => item.kind === "pdf").map(item => item.file_name).join(", ") || "Không có"}</dd>
          </dl></Card>
          <Card title="Tài khoản gửi"><p className="next-validity">{senders.some(item => item.id === current.sender_account_id && item.status === "active" && item.configured && item.quota_3_days - item.used_3_days >= current.recipient_count - current.sent_count) ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Địa chỉ email</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</dd>
            <dt>Tên người gửi</dt><dd>{current.sender_name || senders.find(item => item.id === current.sender_account_id)?.name || "—"}</dd>
            <dt>Hạn mức còn lại</dt><dd>{n(Math.max(0, (senders.find(item => item.id === current.sender_account_id)?.quota_3_days || 0) - (senders.find(item => item.id === current.sender_account_id)?.used_3_days || 0)))}</dd>
          </dl></Card>
          <Card title="Lịch gửi"><p className="next-validity">{current.send_mode === "now" || (current.scheduled_at && !scheduleError(current.scheduled_at)) ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Thời điểm bắt đầu</dt><dd>{current.send_mode === "now" ? "Ngay sau khi xác nhận" : date(summaryStart)}</dd>
            <dt>Tốc độ gửi</dt><dd>{current.send_rate ?? 50} email/giờ</dd>
            <dt>Khung giờ gửi</dt><dd>{current.send_mode === "now" ? "Gửi ngay" : `${effectiveFrom}–${effectiveTo}`}</dd><dt>Thời điểm hoàn tất dự kiến</dt><dd>{date(expectedFinish(summaryStart, remainingCount, effectiveRate, effectiveFrom, effectiveTo, current.send_mode === "now"))}</dd>
          </dl></Card>
        </div>
        <div className="next-actions-bar"><Button onClick={() => go("campaign-list")}>Để sau</Button><Button disabled={busy} onClick={() => {
          setBusy(true); setError(""); setPreviewResult(null);
          void api<{ subject: string; body: string }>(`campaigns/${current.id}/preview`, "POST", {})
            .then(result => { setPreviewResult(result); setShowConfirmEmail(true); })
            .catch(reason => setError(reason instanceof Error ? reason.message : "Không xem được nội dung email."))
            .finally(() => setBusy(false));
        }}>Xem nội dung email</Button><Button onClick={() => openCampaignEmail(current)}>Sửa email</Button><Button primary disabled={busy || needsSender || current.status !== "paused" || !resumeEmailViewed} onClick={() => ask("Tiếp tục gửi chiến dịch", `Tiếp tục gửi cho ${n(remainingRecipients)} contact chưa gửi?`, () => update("resume", "POST", undefined, `Đã tiếp tục chiến dịch “${current.name}”.`, "campaign-list"), false)}>Tiếp tục gửi</Button></div>
        {showConfirmEmail && previewResult && <Dialog pending={busy} title="Nội dung email" className="next-email-dialog" onClose={() => { setShowConfirmEmail(false); setResumeEmailViewed(true); }}><p>Contact đầu tiên: {current.recipients?.[0]?.full_name || current.recipients?.[0]?.email || "—"} - {current.recipients?.[0]?.email || "—"}</p><div className="next-email-dialog-body"><strong>{previewResult.subject}</strong>{logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}<div><PreviewBody value={previewResult.body} campaignId={current.id} /></div>{assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>Đính kèm: {item.file_name}</small>)}</div></Dialog>}
      </Page>;
    }
    return (
      <Page section="Chiến dịch" title={current.name} go={go}>
        {feedback}
        <Card title="Thông tin chiến dịch">
          <p>
            Trạng thái: {campaignStatuses[current.status] || current.status} ·
            Người nhận: {n(current.recipient_count)} · Đã gửi:{" "}
            {n(current.sent_count)}
          </p>
          <p>Lịch gửi: {date(current.scheduled_at)}</p>
          {current.status === "paused" && <p>Tạm dừng: {date(current.paused_at)} · Lý do: {current.pause_reason || "Không ghi lý do"}</p>}
          {current.recipients && (
            <Table
              heads={["Contact", "Email", "Trạng thái"]}
              rows={current.recipients.map((item) => [
                item.full_name || "—",
                item.email,
                ({ pending: "Chưa gửi", sending: "Đang gửi", sent: "Đã gửi", failed: "Gửi thất bại", skipped: "Đã bỏ qua", unsubscribed: "Từ chối nhận email" } as Record<string, string>)[item.status] || item.status,
              ])}
            />
          )}
          <div className="next-actions-bar">
            {current.sent_count === 0 && ["draft", "approved", "scheduled", "paused"].includes(current.status) && (
              <Button disabled={busy} onClick={() => {
                ask("Ẩn chiến dịch", "Chỉ Ẩn chiến dịch chưa gửi email nào.", () =>
                  void run(() => api(`campaigns/${current.id}`, "DELETE"), "Đã Ẩn chiến dịch.", "campaign-list"));
              }}>Ẩn chiến dịch</Button>
            )}
            <div className="next-delete-other-actions">
            {["approved", "paused"].includes(current.status) && (
              <Button
                onClick={() => openCampaignEmail(current)}
              >
                {current.status === "paused" ? "Sửa email" : "Tiếp tục soạn"}
              </Button>
            )}
            {["approved", "scheduled", "paused"].includes(current.status) && <Button onClick={() => openCampaignEdit(current)}>Sửa thông tin chung</Button>}
            {["scheduled", "sending"].includes(current.status) && (
              <Button
                disabled={busy}
                onClick={() => openCampaignPause(current)}
              >
                Tạm dừng
              </Button>
            )}
            {current.status === "paused" && (
              <Button
                disabled={busy}
                onClick={() => choose(current.id, "campaign-resume")}
              >
                Tiếp tục gửi
              </Button>
            )}
            </div>
          </div>
        </Card>
        {campaignEditDialog}
      </Page>
    );
  }

  if (group === "responses") {
    const visibleResponses = responseWindow === "all" ? responses : responses.filter(item => Date.parse(item.received_at) >= clock - 30 * 86400000);
    const activeResponse = visibleResponses.find(item => item.id === selected) || visibleResponses[0];
    if (screen === "response-list")
      return (
        <Page section="Response" title="Quản lý Response" className="next-response-list-page" go={go}>
          {feedback}
          <Card title="Response do tôi phụ trách">
            {error && !visibleResponses.length ? <div className="next-scenario-empty centered"><strong>Không thể tải danh sách Response</strong><span>Kiểm tra kết nối rồi thử lại.</span><Button onClick={() => setReload(value => value + 1)}>Thử tải lại</Button></div> : !loading && !visibleResponses.length ? <div className="next-scenario-empty centered"><strong>Không tìm thấy Response phù hợp</strong><span>Chưa có Response phù hợp trong phạm vi phụ trách {responseWindow === "30" ? "30 ngày gần nhất" : "đã chọn"}.</span><Button onClick={() => setResponseWindow("all")}>Điều chỉnh bộ lọc</Button></div> : <Table
              heads={[
                "Mã / Khách hàng",
                "Thời gian nhận",
                "Loại phản hồi",
                "Trạng thái",
                "Thao tác",
              ]}
              selectedRow={Math.max(0, visibleResponses.findIndex(item => item.id === selected))} onSelect={index => setSelected(visibleResponses[index].id)}
              rows={visibleResponses.map((item) => [
                `RSP-${item.id} · ${item.customer_name}`,
                date(item.received_at),
                kinds[item.kind],
                responseStatuses[item.status],
                <button type="button"
                  key={item.id}
                  onClick={() => choose(item.id, "response-detail")}
                >
                  Xem chi tiết
                </button>,
              ])}
            />}
          </Card>
          <div className="next-actions-bar">
            <Button disabled={!visibleResponses.length} onClick={() => choose(activeResponse!.id, "response-hide")}>Ẩn Response</Button>
            <Button primary onClick={() => { setName(""); setEmail(""); setPhone(""); setBody(""); go("response-add"); }}>Thêm Response</Button>
          </div>

        </Page>
      );
    if (screen === "response-add")
      return (
        <Page section="Response" title="Thêm Response" className="next-figma-form" go={go}>
          {feedback}{customerLoadError && <p role="alert" className="next-error">{customerLoadError}<Button onClick={() => { setCustomerLoadError(""); setReload(value => value + 1); }}>Tải lại khách hàng</Button></p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    api("responses", "POST", {
                      customerName: name,
                      email,
                      phone,
                      content: body,
                    }),
                  "Đã lưu Response.",
                  "response-list",
                );
              }}
            >
          <Card title="Thông tin Response ngoại tuyến">
            <div className="next-grid">
              <Field disabled={busy}
                label="Khách hàng"
                value={name}
                options={customers.map(item => `${item.full_name || item.company || "Contact"} · ${item.email}`)}
                set={value => { const contact = customers.find(item => `${item.full_name || item.company || "Contact"} · ${item.email}` === value); setName(contact?.full_name || contact?.company || value); if (contact) setEmail(contact.email); }}
                required
                placeholder="Chọn khách hàng"
              />
              <Field disabled={busy}
                label="Email"
                value={email}
                set={setEmail}
                type="email"
                placeholder="Nhập email"
              />
              <Field disabled={busy} label="Số điện thoại" value={phone} set={setPhone} type="tel" placeholder="Nhập số điện thoại" />
              <Field disabled={busy}
                label="Nội dung phản hồi"
                value={body}
                set={setBody}
                rows={1}
                required
                placeholder="Nhập nội dung khách hàng phản hồi"
              />
            </div>
              <p className="next-hint">Mã Response và thời gian nhận được hệ thống tự ghi khi lưu. Trạng thái ban đầu: Mới.</p>
          </Card>
              <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("response-list")}>Hủy</Button>

                <Button type="submit" primary disabled={busy}>
                  Lưu Response
                </Button>

            </div>
            </form>
        </Page>
      );
    const d = detail as ResponseItem | null;
    const current = d?.id === responseItem?.id ? d : responseItem;
    if (!current)
      return (
        <Page section="Response" title="Chi tiết Response" go={go}>
          {feedback}
          <Card>Chưa có Response.</Card>
        </Page>
      );
    if (screen === "response-hide" && (!["spam", "unsubscribe"].includes(current.kind) || current.followups?.length || current.interactions?.some(item => ["email", "sms"].includes(item.channel)))) return <Page section="Response" title="Không thể ẩn Response" go={go}>{feedback}<FigmaState error title="Response không đủ điều kiện để ẩn" description="Response đã được xử lý hoặc có lịch Follow-up/tương tác. Dữ liệu được giữ nguyên." actions={<Button onClick={() => go("response-detail")}>Về chi tiết Response</Button>} /></Page>;
    if (screen === "response-hide") return <Page section="Response" title="Xác nhận ẩn Response" description={`RSP-${current.id} · ${current.customer_name}`} go={go}>
      {feedback}
      <div className="next-compact-confirmation">
        <section><span>XÁC NHẬN ẨN RESPONSE</span><h2>Ẩn Response của {current.customer_name}?</h2>
          <label className="next-field">Response cần ẩn<select value={current.id} onChange={event => choose(event.target.value, "response-hide")}>{responses.map(item => <option key={item.id} value={item.id}>RSP-{item.id} · {item.customer_name}</option>)}</select></label>
          <p>Chỉ ẩn Response loại Rác hoặc Từ chối nhận email khi chưa có phản hồi và Follow-up. Dữ liệu vẫn được giữ trong lịch sử.</p>
        </section>
        <div className="next-confirmation-actions"><Button primary disabled={busy || !["spam", "unsubscribe"].includes(current.kind) || !!current.interactions?.length || !!current.followups?.length} onClick={() => void run(() => api(`responses/${current.id}/hide`, "POST"), "Đã ẩn Response khỏi danh sách.", "response-list")}>Xác nhận ẩn</Button><Button disabled={busy} onClick={() => go("response-list")}>Hủy</Button></div>
      </div>
    </Page>;
    if (screen === "response-history")
      return <Page section="Response" title="Lịch sử phản hồi đã gửi" className="next-history-page" go={go}>
        {feedback}
        <Card title={`Phản hồi gửi đi · ${current.interactions?.length || 0} lượt`}>
          <Table heads={["Thời điểm gửi", "Kênh / Người gửi", "Người nhận", "Nội dung"]}
            rows={(current.interactions || []).map(item => [date(item.created_at), `${item.channel.toUpperCase()} · ${item.actor_id || "Hệ thống"}`, item.channel === "sms" ? current.phone || "—" : current.email, item.content])} />
        </Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status-history")
      return <Page section="Response" title="Lịch sử trạng thái Response" className="next-history-page" go={go}>
        {feedback}
        <Card title={`Lịch sử xử lý · ${(current.status_history?.length || 0) + 1} mốc`}>
          <Table heads={["Thời điểm", "Trạng thái mới", "Ghi chú"]}
            rows={[[date(current.received_at), responseStatuses[current.status_history?.[0]?.from_status || "new"] || "Mới", "Hệ thống tiếp nhận Response."], ...(current.status_history || []).map(item => [date(item.changed_at), responseStatuses[item.to_status] || item.to_status, item.note || `Nhân viên ${item.actor_id} cập nhật trạng thái.`])]} />
        </Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status") {
      const nextStatus = { new: "processing", processing: "replied", replied: "closed" }[current.status];
      return <Page section="Response" title="Cập nhật trạng thái" className="next-figma-form" go={go}>
        {feedback}
        <Card title={`Trạng thái xử lý · RSP-${current.id}`}>
          <div className="next-grid">
            <div className="next-field"><label htmlFor="current-response-status">Trạng thái hiện tại</label><input id="current-response-status" value={responseStatuses[current.status]} readOnly /></div>
            <div className="next-field"><label htmlFor="new-response-status">Trạng thái mới</label><select id="new-response-status" defaultValue={nextStatus || ""} key={current.status} disabled={!nextStatus}><option value={nextStatus || ""}>{nextStatus ? responseStatuses[nextStatus] : "Không còn bước tiếp theo"}</option></select></div>
          </div>
          <div className="next-field"><label htmlFor="response-status-note">Lý do / Ghi chú</label><input id="response-status-note" value={statusNote} maxLength={1000} onChange={event => setStatusNote(event.target.value)} /></div>
          <p className="next-hint">Chuyển trạng thái theo luồng xử lý hợp lệ.</p>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("response-detail")}>Hủy thao tác</Button><Button primary disabled={busy || !nextStatus} onClick={() => void run(() => api(`responses/${current.id}`, "PATCH", { status: nextStatus, note: statusNote }), "Đã cập nhật trạng thái.", "response-detail").then(saved => { if (saved) setStatusNote(""); })}>Xác nhận</Button>
            </div>
      </Page>;
    }
    if (screen === "response-edit" && !["new", "processing"].includes(current.status)) return <Page section="Response" title="Không thể cập nhật Response" go={go}>{feedback}<FigmaState error title="Response không còn được phép chỉnh sửa" description="Chỉ sửa Response Mới hoặc Đang xử lý. Nội dung đã lưu được giữ nguyên." actions={<Button onClick={() => go("response-detail")}>Về chi tiết Response</Button>} /></Page>;
    if (screen === "response-edit")
      return (
        <Page section="Response" title="Cập nhật Response" className="next-figma-form next-response-edit-page" description={`RSP-${current.id} · ${current.customer_name} · Nhận ${date(current.received_at)} · Trạng thái ${responseStatuses[current.status]}`} go={go}>
          {feedback}
          <section className="next-card next-response-edit-info"><h2>Thông tin khách hàng</h2>
            <Field disabled={busy} label="Khách hàng" value={name} set={setName} required />
            <div className="next-grid"><Field disabled={busy} label="Email" value={email} set={setEmail} type="email" /><Field disabled={busy} label="Số điện thoại" value={phone} set={setPhone} type="tel" /></div>
            <p className="next-hint">Mã Response, thời điểm nhận và loại phản hồi do hệ thống quản lý; không chỉnh sửa tại đây. Chỉ cập nhật khi trạng thái Mới hoặc Đang xử lý.</p>
          </section>
          <Card>
            <Field disabled={busy}
              label="Nội dung phản hồi"
              value={body}
              set={setBody}
              rows={6}
              required
            />
          </Card>
            <div className="next-actions-bar next-response-edit-actions"><Button disabled={busy} onClick={() => go("response-detail")}>Hủy</Button>

              <Button
                primary
                disabled={busy || !name.trim() || !body.trim()}
                onClick={() =>
                  void run(
                    () =>
                      api(`responses/${current.id}`, "PATCH", {
                        customerName: name,
                        email,
                        phone,
                        content: body,
                      }),
                    "Đã cập nhật Response.",
                    "response-detail",
                  )
                }
              >
                Lưu thay đổi
              </Button>

            </div>
        </Page>
      );
    if (screen === "response-reply")
      return (
        <Page section="Response" title="Soạn phản hồi" className="next-figma-form next-reply-page" go={go}>
          {feedback}
          <section className="next-card next-summary next-reply-card">
            <h2>Soạn phản hồi · RSP-{current.id}</h2>
            <div className="next-reply-grid">
              <label className="next-field">Kênh gửi *
                <select value={replyChannel} onChange={event => setReplyChannel(event.target.value as "email" | "sms")}>
                  <option value="email" disabled={!current.email}>Email</option><option value="sms">SMS</option>
                </select>
              </label>
              <div className="next-field"><label htmlFor="reply-recipient">Người nhận</label><input id="reply-recipient" readOnly value={replyChannel === "email" ? current.email : current.phone || ""} /></div>
              <label className="next-field">Mẫu phản hồi
                <select defaultValue="" onChange={event => {
                  const template = templates.find(item => item.id === event.target.value);
                  if (template) { setSubject(template.subject); setBody(template.body); }
                }}>
                  <option value="">Soạn nội dung mới</option>
                  {templates.filter(item => !/\[\[|\{\{/.test(item.body)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <Field disabled={busy} label="Nội dung phản hồi" value={body} set={setBody} rows={7} required />
              {replyChannel === "email" && <>
                <label className="next-field">Tài khoản gửi *
                  <select value={senderId} onChange={event => setSenderId(event.target.value)}>
                    <option value="">Chọn tài khoản gửi</option>
                    {senders.filter(item => item.status === "active" && item.configured).map(item => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}
                  </select>
                </label>
                <Field disabled={busy} label="Tiêu đề email" value={subject} set={setSubject} required />
              </>}
            </div>
            <p className="next-hint">{replyChannel === "email" ? "Email được gửi qua tài khoản SMTP đã cấu hình." : "SMS cần gửi ngoài hệ thống. Thao tác này chỉ ghi nhận nội dung vào lịch sử."}</p>
          </section>
            <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("response-detail")}>Hủy</Button>
              <Button
                disabled={busy || (replyChannel === "email" && !current.email)}
                primary
                onClick={() =>
                  void run(
                    () => replyChannel === "email"
                      ? api(`responses/${current.id}/reply`, "POST", { senderAccountId: idNumber(senderId), subject, content: body })
                      : api(`responses/${current.id}/interactions`, "POST", { channel: "sms", content: body }),
                    replyChannel === "email" ? "Đã gửi email và lưu lịch sử tương tác." : "Đã ghi nhận SMS đã gửi ngoài hệ thống.",
                    "response-detail",
                  )
                }
              >
                {replyChannel === "email" ? "Gửi phản hồi" : "Ghi nhận SMS"}
              </Button>

            </div>
        </Page>
      );
    return (
      <Page section="Response" title="Chi tiết Response" go={go}>
        {feedback}
        <section className="next-card next-response-detail"><h2>RSP-{current.id} · {current.customer_name}</h2>
          <div className="next-response-fields">
            <div><span>Loại phản hồi</span><strong>{kinds[current.kind]}</strong></div>
            <div><span>Trạng thái</span><strong>{responseStatuses[current.status]}</strong></div>
            <div><span>Phụ trách</span><strong>{current.assignee_id}</strong></div>
            <div><span>Thời gian nhận</span><strong>{date(current.received_at)}</strong></div>
            <div><span>Email</span><strong>{current.email || "—"}</strong></div>
            <div><span>Số điện thoại</span><strong>{current.phone || "—"}</strong></div>
            <div><span>Chiến dịch</span><strong>{current.campaign_name || "—"}</strong></div>
          </div>
          <div className="next-response-body"><span>Nội dung khách hàng</span><strong>{current.content}</strong></div>
          {current.email_deliveries?.some(
            (item) => item.state === "sending",
          ) && (
            <p role="alert">
              Có email chưa rõ trạng thái gửi. Kiểm tra hộp thư trước khi gửi
              lại.
            </p>
          )}
        </section>
        <section className="next-card next-response-history"><h2>Lịch sử và lịch hẹn liên quan</h2>
          <Table heads={["Nội dung", "Thông tin hiện tại", "Thao tác"]} rows={[
            ["Phản hồi đã gửi", current.interactions?.at(-1) ? date(current.interactions.at(-1)?.created_at) : "Chưa có phản hồi gửi đi", <Button key="reply-history" onClick={() => go("response-history")}>Xem lịch sử</Button>],
            ["Lịch sử trạng thái", `${date(current.received_at)} · ${responseStatuses[current.status]}`, <Button key="status-history" onClick={() => go("response-status-history")}>Xem lịch sử</Button>],
            ["Lịch Follow-up", current.followups?.at(-1) ? date(current.followups.at(-1)?.due_at) : "Chưa có lịch Follow-up", <Button key="followup-history" onClick={() => go("followup-list")}>Xem lịch sử</Button>],
          ]} />
        </section>
          <div className="next-actions-bar">
            {["spam", "unsubscribe"].includes(current.kind) && (
              <Button disabled={busy} onClick={() => {
                ask("Ẩn Response", "Response này sẽ không còn trong danh sách hiện hành.", () =>
                  void run(() => api(`responses/${current.id}/hide`, "POST"), "Đã ẩn Response.", "response-list"));
              }}>Ẩn Response</Button>
            )}
            <div className="next-delete-other-actions">
            <Button primary
              onClick={() => {
                setReplyChannel(current.email ? "email" : "sms");
                setBody("");
                setSubject("");
                go("response-reply");
              }}
            >
              Phản hồi
            </Button>
            <Button
              onClick={() => {
                setSelected(current.id);
                go(current.kind === "unsubscribe" ? "followup-optout" : "followup-create");
              }}
            >
              Tạo lịch Follow-up
            </Button>
            {["new", "processing", "replied"].includes(current.status) && (
              <Button
                disabled={busy}
                onClick={() => { setStatusNote(""); go("response-status"); }}
              >
                Cập nhật trạng thái
              </Button>
            )}
            {["new", "processing"].includes(current.status) && (
              <Button
                onClick={() => {
                setName(current.customer_name);
                setEmail(current.email);
                setPhone(current.phone || "");
                  setBody(current.content);
                  go("response-edit");
                }}
              >
                Sửa thông tin
              </Button>
            )}
            </div>
          </div>
      </Page>
    );
  }

  if (group === "followups") {
    if (screen === "followup-list")
      return (
        <Page section="Follow-up" title="Quản lý lịch Follow-up" go={go}>
          {feedback}
          <Card title="Công việc Follow-up của tôi">
            {error && !followups.length ? <div className="next-scenario-empty centered"><strong>Không thể tải lịch Follow-up</strong><span>Kiểm tra kết nối rồi thử lại.</span><Button onClick={() => setReload(value => value + 1)}>Thử tải lại</Button></div> : !loading && !followups.length ? <div className="next-scenario-empty centered"><strong>Chưa có lịch Follow-up</strong><span>Mở Response để lập lịch chăm sóc khách hàng.</span></div> : <Table
              heads={[
                "Khách hàng / Response",
                "Ngày giờ / Hình thức",
                "Lần / Tối đa",
                "Trạng thái",
                "Thao tác",
              ]}
              selectedRow={Math.max(0, followups.findIndex(item => item.id === selected))} onSelect={index => setSelected(followups[index].id)}
              rows={followups.map((item) => [
                `${item.customer_name} · RSP-${item.response_id}`,
                <span key={item.id + "-due"}>{date(item.due_at)}<small style={{ display: "block" }}>{item.channel === "phone" ? "Gọi điện" : item.channel.toUpperCase()}</small></span>,
                `${n(item.attempt)} / ${n(item.max_attempts)}`,
                item.status === "pending"
                  ? item.overdue
                    ? "Quá hạn"
                    : "Chờ thực hiện"
                  : item.outcome === "responded"
                    ? "Có phản hồi"
                    : item.outcome === "no_response"
                      ? "Không phản hồi"
                      : "Đang chờ phản hồi",
                <button type="button"
                  key={item.id}
                  onClick={() => choose(item.id, "followup-result")}
                >
                  {item.status === "pending" ? "Xem chi tiết" : "Xem kết quả"}
                </button>,
              ])}
            />}
          </Card>
          <div className="next-rule"><strong>Quy tắc thao tác</strong><span>Lịch mới tự xuất hiện trong công việc cá nhân. Chỉ lịch Chờ thực hiện được phép Ẩn.</span></div>
          <div className="next-actions-bar">
            <Button disabled={!followups.length} onClick={() => { if (followup) choose(followup.id, "followup-delete"); }}>Ẩn lịch Follow-up</Button>
            <Button primary onClick={() => go("response-list")}>Xem hồ sơ / Lập lịch</Button>
          </div>
        </Page>
      );
    if (screen === "followup-duplicate" || screen === "followup-optout")
      return <Page section="Follow-up" title="Lập lịch Follow-up" go={go}>
        <div className="next-state" role="alert"><div><span>{screen === "followup-duplicate" ? "LỊCH FOLLOW-UP ĐANG TỒN TẠI" : "EMAIL ĐÃ BỊ TỪ CHỐI"}</span><h2>{screen === "followup-duplicate" ? "Không thể tạo thêm lịch Follow-up" : "Không thể tạo Follow-up qua Email"}</h2><p>{error || (screen === "followup-duplicate" ? "Response này đã có lịch hẹn chờ thực hiện." : `Khách hàng ${responses.find(item => item.id === selected)?.customer_name || "đang chọn"} đã từ chối nhận Email.`)}</p><small>Biểu mẫu được giữ nguyên để chọn lại hoặc điều chỉnh kênh liên hệ.</small></div><div className="next-state-actions"><Button primary onClick={() => { setError(""); go("followup-create"); }}>{"Quay lại biểu mẫu"}</Button></div></div>
      </Page>;
    if (screen === "followup-create") {
      const selectedFollowChannel = followChannel === "email" && responses.some(item => item.id === selected && !item.email) ? "phone" : followChannel;
      return (
        <Page section="Follow-up" title="Tạo lịch Follow-up" className="next-figma-form" go={go}>
          {feedback}
          <Card title="Thiết lập lịch">
            <div className="next-grid">
            <label className="next-field next-form-wide">
              Response
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
              >
                <option value="">Chọn Response</option>
                {responses
                  .filter(
                    (item) =>
                      !["unsubscribe", "spam", "bounce"].includes(item.kind) &&
                      item.status !== "closed",
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      RSP-{item.id} · {item.customer_name}
                    </option>
                  ))}
              </select>
            </label>
            <Field disabled={busy}
              label="Ngày giờ hẹn (để trống: sau 2 ngày làm việc)" error={followupErrors.due}
              value={due}
              set={setDue}
              type="datetime-local"
            />
            <label className="next-field">
              Hình thức chăm sóc
              <select
                value={selectedFollowChannel}
                onChange={(e) => setFollowChannel(e.target.value)}
              >
                <option value="email" disabled={!responses.find(item => item.id === selected)?.email}>Email</option>
                <option value="sms">SMS</option>
                <option value="phone">Gọi điện</option>
              </select>
            </label>
            <Field disabled={busy}
              label="Nội dung / Mục tiêu" error={followupErrors.goal}
              value={goal}
              set={setGoal}
              rows={1}
              required
            />
              <Field disabled={busy}
                label="Nhắc trước (phút)" error={followupErrors.reminderMinutes}
                value={reminderMinutes}
                set={setReminderMinutes}
                type="number"
              />
              <Field disabled={busy}
                label="Chờ phản hồi (ngày)" error={followupErrors.waitDays}
                value={waitDays}
                set={setWaitDays}
                type="number"
              />
              <Field disabled={busy}
                label="Số lần tối đa" error={followupErrors.maxAttempts}
                value={maxAttempts}
                set={setMaxAttempts}
                type="number"
              />
              <Field disabled={busy}
                label="Khoảng cách giữa các lần (ngày)" error={followupErrors.intervalDays}
                value={intervalDays}
                set={setIntervalDays}
                type="number"
              />
            </div>
            <p>
              Nhân viên thực hiện thủ công; hệ thống chỉ lưu lịch và nhắc việc.
            </p>
          </Card>
            <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("response-detail")}>Hủy</Button>

              <Button
                primary
                disabled={busy || !selected}
                onClick={() => {
                  const errors = followupValidation({ goal, due, reminderMinutes, waitDays, maxAttempts, intervalDays });
                  setFollowupErrors(errors);
                  if (Object.keys(errors).length) { setError("Thông tin lịch Follow-up chưa hợp lệ. Kiểm tra các ô được đánh dấu."); return; }
                  void run<Followup>(
                    () =>
                      api<Followup>("followups", "POST", {
                        responseId: idNumber(selected),
                        ...(due ? { dueAt: new Date(due).toISOString() } : {}),
                        channel: selectedFollowChannel,
                        goal,
                        reminderMinutes: Number(reminderMinutes),
                        waitDays: Number(waitDays),
                        maxAttempts: Number(maxAttempts),
                        intervalDays: Number(intervalDays),
                      }),
                    "Đã lưu lịch Follow-up.",
                    undefined,
                    failure => {
                      if (failure.message.includes("đã có lịch Follow-up")) go("followup-duplicate");
                      else if (failure.message.includes("từ chối nhận email")) go("followup-optout");
                    },
                  ).then(item => { if (item) { setCreatedFollowup(item); go("followup-success", { key: "followupId", id: item.id }); } });
                }}
              >
                Thêm Follow-up
              </Button>

            </div>
        </Page>
      );
    }
    if (screen === "followup-success") return <Page section="Follow-up" title="Lập lịch Follow-up" go={go}>
      {feedback}<div className="next-state success"><div><span>ĐÃ LƯU LỊCH FOLLOW-UP</span><h2>{createdFollowup ? `Đã thêm lịch Follow-up FU-${createdFollowup.id}` : "Lịch Follow-up đã lưu"}</h2>
        <p>{createdFollowup ? `Response RSP-${createdFollowup.response_id} · Kênh ${createdFollowup.channel === "phone" ? "Gọi điện" : createdFollowup.channel.toUpperCase()}.` : "Xem danh sách để kiểm tra lịch đã lưu."}</p>
        {createdFollowup && <small>Hẹn {date(createdFollowup.due_at)} · Tối đa {createdFollowup.max_attempts} lần · Trạng thái: Chờ thực hiện.</small>}
      </div><div className="next-state-actions"><Button primary onClick={() => go("response-list")}>Tạo lịch khác</Button><Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button></div></div>
    </Page>;
    if (screen === "followup-result" && followup?.worker_error) return <Page section="Follow-up" title="Kết quả Follow-up" go={go}>{feedback}<FigmaState error title={followup.worker_error_stage === "chain" ? "Không thể tạo lịch Follow-up tiếp theo" : "Cập nhật trạng thái chưa thành công"} description={followup.worker_error} actions={<Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button>} /></Page>;
    if (screen === "followup-result" && followup && isFollowupExhausted(followup)) {
      const deadline = followupDeadline(followup.completed_at, followup.wait_days);
      return <Page section="Follow-up" title="Kết quả Follow-up" description="Đã kết thúc thời gian chờ phản hồi" go={go}>
        {feedback}
        <ExhaustedFollowup attempt={followup.attempt} maxAttempts={followup.max_attempts}
          details={`${followup.customer_name} · RSP-${followup.response_id} · ${followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()}${deadline ? ` · hết hạn ${date(deadline)}` : ""}.`}
          onNote={() => { setDecisionNote(followup.note || ""); go("followup-note"); }}
          onBack={() => go("followup-list")} />
      </Page>;
    }
    if (screen === "followup-result" && followup)
      return <Page section="Follow-up" title="Kết quả Follow-up" go={go}>
        {feedback}
        <section className="next-card next-summary next-followup-summary">
          <h2>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"} · {followup.customer_name} · RSP-{followup.response_id}</h2>
          <div className="next-result-grid">
            <div><span>Trạng thái</span><strong>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"}</strong></div>
            <div><span>Lịch hẹn</span><strong>{date(followup.due_at)}</strong></div>
            <div><span>Hình thức</span><strong>{followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()}</strong></div>
            <div><span>Lần Follow-up</span><strong>{followup.attempt} / {followup.max_attempts}</strong></div>
            <div><span>Cập nhật lúc</span><strong>{date(["responded", "no_response"].includes(followup.outcome || "") ? followup.resolved_at : followup.completed_at || followup.created_at)}</strong></div>
            <div><span>Nguồn cập nhật</span><strong>{["responded", "no_response"].includes(followup.outcome || "") ? "Hệ thống" : followup.assignee_id}</strong></div>
            <div className="wide"><span>Nội dung / Mục tiêu</span><strong>{followup.goal}</strong></div>
          </div>
        </section>
        <Card title="Lịch sử Follow-up"><Table heads={["Thời điểm", "Trạng thái mới", "Người thực hiện"]} rows={[
          [date(followup.created_at), "Chờ thực hiện", followup.assignee_id || "—"],
          ...(followup.completed_at ? [[date(followup.completed_at), "Đang chờ phản hồi", followup.assignee_id]] : []),
          ...(["responded", "no_response"].includes(followup.outcome || "") ? [[date(followup.resolved_at), followup.outcome === "responded" ? "Có phản hồi" : "Không phản hồi", "Hệ thống"]] : []),
        ]} /></Card>
        <div className="next-actions-bar">
          {followup.status === "pending" && <Button onClick={() => { if (followup) choose(followup.id, "followup-delete"); }}>Ẩn lịch Follow-up</Button>}
          <div className="next-delete-other-actions">
          <Button primary onClick={() => { setDecisionNote(followup.note || ""); go("followup-note"); }}>Bổ sung ghi chú</Button>
          {followup.status === "pending" && <Button onClick={() => go("followup-detail")}>Ghi nhận kết quả</Button>}
          <Button onClick={() => go("followup-list")}>Về danh sách</Button>
          </div>
        </div>
      </Page>;
    if (screen === "followup-note" && followup)
      return <Page section="Follow-up" title="Ghi chú kết quả" className="next-figma-form" go={go}>
        {feedback}
        <Card title={`Ghi chú kết quả · ${followup.customer_name}`}>
          <div className="next-grid">
            <div className="next-field"><label htmlFor="followup-auto-result">Kết quả tự động</label><input id="followup-auto-result" readOnly value={followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"} /></div>
            <Field disabled={busy} label="Ghi chú kết quả" value={decisionNote} set={setDecisionNote} rows={1} />
          </div>
          <p className="next-hint">Hủy hoặc lỗi lưu ghi chú không thay đổi kết quả đã được hệ thống cập nhật.</p>
        </Card>
        <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("followup-result")}>Hủy</Button><Button primary disabled={busy} onClick={() => void run(() => api(`followups/${followup.id}/note`, "PATCH", { note: decisionNote }), "Đã lưu ghi chú.", "followup-result")}>Lưu ghi chú</Button>
            </div>
      </Page>;
    if (screen === "followup-delete" && followup && followup.status !== "pending") return <Page section="Follow-up" title="Không thể ẩn lịch Follow-up" go={go}>{feedback}<FigmaState error title="Lịch Follow-up không được phép ẩn" description="Chỉ lịch Chờ thực hiện được phép ẩn. Kết quả và lịch sử được giữ nguyên." actions={<Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button>} /></Page>;
    if (screen === "followup-delete" && followup)
      return <Page section="Follow-up" title="Xác nhận ẩn lịch" description={`${followup.customer_name} · RSP-${followup.response_id}`} go={go}>
        {feedback}
        <div className="next-compact-confirmation">
          <section><span>XÁC NHẬN ẨN LỊCH</span><h2>Ẩn lịch Follow-up của {followup.customer_name}?</h2>
            <p>RSP-{followup.response_id} · {followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()} · {date(followup.due_at)} · {followup.status === "pending" ? "Chờ thực hiện" : "Đã xử lý"}.</p>
            <p>Lịch chuyển sang Đã hủy; dữ liệu không bị xóa vật lý.</p>
          </section>
          <div className="next-confirmation-actions"><Button primary disabled={busy || followup.status !== "pending"} onClick={() => void run(() => api(`followups/${followup.id}`, "DELETE"), "Đã hủy lịch Follow-up.", "followup-list")}>Xác nhận ẩn</Button><Button disabled={busy} onClick={() => go("followup-list")}>Hủy</Button></div>
        </div>
      </Page>;
    return (
      <Page section="Follow-up" title="Chi tiết Follow-up" go={go}>
        {feedback}
        {followup ? (
          <Card title={followup.customer_name}>
            <p>
              {followup.email} · Lần {followup.attempt}/{followup.max_attempts}{" "}
              · Hẹn {date(followup.due_at)} · Kênh{" "}
              {followup.channel === "phone"
                ? "Gọi điện"
                : followup.channel.toUpperCase()}
            </p>
            <p>Mục tiêu: {followup.goal}</p>
            <p>
              Nhắc trước {followup.reminder_minutes} phút · Chờ phản hồi{" "}
              {followup.wait_days} ngày · Cách lần tiếp theo{" "}
              {followup.interval_days} ngày.
            </p>
            <p>
              Kết quả:{" "}
              {followup.status === "pending"
                ? "Chờ thực hiện"
                : followup.outcome === "responded"
                  ? "Có phản hồi"
                  : followup.outcome === "no_response"
                    ? "Không phản hồi"
                    : "Đang chờ phản hồi"}
            </p>
            <p>{followup.note || "Chưa có ghi chú kết quả."}</p>
            {followup.status === "pending" && (
              <>
                <Field disabled={busy}
                  label="Kết quả làm việc"
                  value={body}
                  set={setBody}
                  rows={4}
                  required
                />
                <label className="next-choice">
                  <input
                    type="checkbox"
                    checked={needsNext}
                    onChange={(e) => setNeedsNext(e.target.checked)}
                  />{" "}
                  Cần lập lịch tiếp theo nếu chưa có phản hồi
                </label>
                <div className="next-actions-bar">
                  <Button
                    primary
                    disabled={busy || !body.trim()}
                    onClick={() =>
                      void run(
                        () =>
                          api(`followups/${followup.id}/complete`, "PATCH", {
                            note: body,
                            needsNext,
                          }),
                        "Đã lưu kết quả Follow-up.",
                        "followup-list",
                      )
                    }
                  >
                    Hoàn tất
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      ask(
                        "Hủy lịch Follow-up",
                        "Lịch đang chờ sẽ được hủy và giữ lại trong lịch sử.",
                        () =>
                          void run(
                            () => api(`followups/${followup.id}`, "DELETE"),
                            "Đã hủy lịch; lịch sử vẫn được giữ.",
                            "followup-list",
                          ),
                      );
                    }}
                  >
                    Hủy lịch
                  </Button>
                </div>
              </>
            )}
          </Card>
        ) : (
          <Card>Chưa có lịch Follow-up.</Card>
        )}
      </Page>
    );
  }

  if (group === "senders") {
    if (screen === "manager-account-check" && !loading && !senders.length) return <Page section="Tài khoản gửi" title="Chưa có tài khoản gửi email" go={go}>{feedback}<FigmaState title="Chưa có tài khoản để kiểm tra" description="Danh sách tài khoản gửi đang trống." actions={<Button primary onClick={() => go("manager-account-list")}>Về danh sách</Button>} /></Page>;
    if (screen === "manager-account-check") {
      const active = senders.find(item => item.id === selected) || senders[0];
      return <Page section="Tài khoản gửi" title="Kiểm tra tài khoản gửi" go={go}>
        {feedback}
        <section className="mgr-panel"><h2>Tài khoản đã cấu hình</h2>
          <div className="next-table-wrap"><table className="next-table"><thead><tr><th>Email người gửi</th><th>Trạng thái</th><th>Giới hạn 3 ngày</th><th>Đã gửi</th><th>Còn lại</th></tr></thead><tbody>
            {senders.length ? senders.map(item => <tr key={item.id} className={active?.id === item.id ? "selected" : ""}>
              <td><button type="button" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.email}</button></td>
              <td>{item.status === "active" ? "Hoạt động" : item.status === "blocked" ? "Bị khóa" : "Ngừng hoạt động"}</td>
              <td>{n(item.quota_3_days)}</td><td>{n(item.used_3_days)}</td><td>{n(Math.max(0, item.quota_3_days - item.used_3_days))}</td>
            </tr>) : <tr><td colSpan={5}>Chưa có tài khoản gửi email để kiểm tra.</td></tr>}
          </tbody></table></div>
          <p className="mgr-callout">Kết quả kiểm tra và hạn mức được hiển thị cho từng tài khoản.</p>
        </section>
        <div className="mgr-actions"><button className="mgr-primary" type="button" disabled={busy || !active} onClick={() => {
          if (!active) return;
          setBusy(true); setError("");
          api<{ connected: boolean }>(`sender-accounts/${active.id}/verify`, "POST")
            .then(result => { setSenderCheckResult({ id: active.id, connected: result.connected, message: "Kết nối SMTP thành công." }); setSelected(active.id); go("manager-account-result-good"); })
            .catch(reason => { setSenderCheckResult({ id: active.id, connected: false, message: reason instanceof Error ? reason.message : "Không thể kiểm tra tài khoản gửi." }); setSelected(active.id); go("manager-account-result-error"); })
            .finally(() => setBusy(false));
        }}>Kiểm tra tình trạng</button></div>
      </Page>;
    }
    if (screen.startsWith("manager-account-result")) {
      const checked = selectedRecord(senders, selected);
      const result = senderCheckResult?.id === checked?.id ? senderCheckResult : null;
      const quota = checked?.quota_3_days ?? 0;
      const used = checked?.used_3_days ?? 0;
      const remaining = Math.max(0, quota - used);
      const percent = quota > 0 ? Math.round(used * 100 / quota) : 0;
      const nearQuota = checked?.quota_warning ?? (quota > 0 && used >= quota * 0.8);
      const status = checked?.status === "active" ? "Hoạt động" : checked?.status === "blocked" ? "Bị khóa" : "Ngừng hoạt động";
      const resultTitle = !result ? "Chưa có kết quả kiểm tra" : result.connected ? "Kết nối tốt" : /xác thực|EAUTH|535|credentials/i.test(result.message) ? "Lỗi xác thực" : "Lỗi kết nối dịch vụ";
      return <Page section="Tài khoản gửi" title="Kết quả kiểm tra tài khoản" description={checked?.email || null} crumbLabel="Kiểm tra tình trạng" className="manager-account-result" go={go} backTo="manager-account-check">
        {feedback}
        <section className="mgr-panel"><h2>{resultTitle}</h2>
          {result ? <>
            <Table heads={["Chỉ tiêu", "Kết quả"]} rows={[
              ["Trạng thái hiện tại", status],
              ["Kết quả kiểm tra", result.connected ? "Xác thực hợp lệ, kết nối thành công." : result.message],
              ["Giới hạn 3 ngày / Đã gửi / Còn lại", `${n(quota)} / ${n(used)} / ${n(remaining)}`],
              ...(result.connected ? [["Cảnh báo", nearQuota ? `Gần ngưỡng · Đã sử dụng ${percent}% giới hạn trong 3 ngày.` : "Không có cảnh báo hạn mức."]] : []),
              ["Thông báo", "Kiểm tra tình trạng tài khoản gửi email hoàn tất."],
            ]} />
            <p className="mgr-callout">{result.connected
              ? `Hạn mức còn lại là ${n(remaining)} email.${quota > 0 ? ` Tài khoản đã dùng ${percent}% giới hạn trong 3 ngày.` : ""}`
              : `Kiểm tra không làm thay đổi trạng thái ${status} của tài khoản.`}</p>
          </> : <p role="status">Chọn tài khoản và kiểm tra tình trạng để xem kết quả.</p>}
        </section>
        <div className="mgr-actions"><button type="button" onClick={() => go("manager-account-check")}>Quay lại</button><button className="mgr-primary" type="button" onClick={() => go("manager-account-list")}>Thêm hoặc đổi tài khoản</button></div>
      </Page>;
    }
    if (
      screen === "manager-account-list" ||
      screen === "manager-account-check" ||
      screen === "sender-list"
    )
      return (
        <Page
          section="Tài khoản gửi"
          title={
            screen === "manager-account-check"
              ? "Kiểm tra tài khoản gửi"
              : "Tài khoản gửi"
          }
          go={go}
        >
          {feedback}
          {!loading && !senders.length ? <FigmaState title="Chưa có tài khoản gửi" description="Thêm tài khoản gửi để cấu hình email của phòng Marketing." /> : <Card title="Danh sách tài khoản">
            <Table
              heads={["Tên tài khoản", "Mã", "Địa chỉ email người gửi", "Hạn mức 3 ngày", "Trạng thái"]}
              selectedRow={Math.max(0, senders.findIndex(item => item.id === selected))}
              onSelect={index => choose(senders[index].id, manager ? "manager-account-detail" : "sender-detail")}
              rows={senders.map(item => [
                <button className="next-text-link" key={item.id} type="button" onClick={() => choose(item.id, manager ? "manager-account-detail" : "sender-detail")}>{item.name}</button>,
                item.code || `TK-${item.id}`,
                item.email,
                `${n(item.used_3_days)} / ${n(item.quota_3_days)}`,
                item.status === "active" ? "Hoạt động" : item.status === "blocked" ? "Bị khóa" : "Ngừng hoạt động",
              ])}
            />
            <p className="mgr-callout">Thêm hoặc cập nhật email của V5 dùng gửi thư cho đối tác, khách hàng tiềm năng.</p>
          </Card>}
          {manager && <div className="next-actions-bar">
            <Button disabled={busy || !sender} onClick={() => { if (sender) choose(sender.id, "manager-account-edit"); }}>Cập nhật tài khoản</Button>
              <Button
                primary
                onClick={() => {
                  setSenderForm({
                    name: "",
                    code: "",
                    email: "",
                    smtpHost: "smtp.gmail.com",
                    smtpPort: "465",
                    smtpUser: "",
                    smtpPassword: "",
                    status: "inactive",
                    quota3Days: "100",
                    inboundEnabled: false,
                  });
                  go("manager-account-add");
                }}
              >
                Thêm tài khoản gửi mới
              </Button>
          </div>}

        </Page>
      );
    if (screen === "manager-account-saved")
      return <Page section="Tài khoản gửi" title="Đã lưu tài khoản gửi email" go={go}>
        {feedback}
        <section className="mgr-panel"><h2>Lưu thông tin tài khoản thành công</h2>
          <Table heads={["Tên tài khoản", "Mã", "Địa chỉ email người gửi", "Hạn mức 3 ngày", "Trạng thái"]}
            rows={senders.map(item => [item.name, item.code || `TK-${item.id}`, item.email, n(item.quota_3_days), item.status === "active" ? "Hoạt động" : "Ngừng hoạt động"])} />
          <p className="mgr-callout success">Thông tin tài khoản gửi đã được lưu.</p>
        </section>
        <div className="mgr-actions"><button className="mgr-primary" type="button" onClick={() => go("manager-account-list")}>Về danh sách</button></div>
      </Page>;
    if (screen === "manager-account-edit" && !senders.some(item => item.id === senderEditId))
      return <Page section="Tài khoản gửi" title="Cập nhật tài khoản gửi" go={go}>
        <Card title="Chưa xác định tài khoản cần sửa">
          <p>Vui lòng mở chi tiết tài khoản từ danh sách rồi chọn Sửa để cập nhật đúng tài khoản.</p>
          <Button onClick={() => go("manager-account-list")}>Về danh sách tài khoản gửi</Button>
        </Card>
      </Page>;
    if (screen === "manager-account-add" || screen === "manager-account-edit")
      return (
        <Page
          section="Tài khoản gửi"
          title={
            screen === "manager-account-add"
              ? "Thêm tài khoản gửi"
              : "Cập nhật tài khoản gửi"
          }
          className="next-sender-form"
          go={go}
        >
          {feedback}
          {screen === "manager-account-edit" && (() => {
            const editing = senders.find(item => item.id === senderEditId)!;
            const dirty = senderForm.code !== (editing.code || `TK-${editing.id}`) || senderForm.email !== editing.email || senderForm.name !== editing.name ||
              senderForm.smtpHost !== (editing.smtp_host || "") || Number(senderForm.smtpPort) !== editing.smtp_port ||
              senderForm.smtpUser !== (editing.smtp_user || "") || !!senderForm.smtpPassword ||
              senderForm.status !== editing.status || Number(senderForm.quota3Days) !== editing.quota_3_days ||
              senderForm.inboundEnabled !== editing.inbound_enabled;
            return googleConnection(editing, dirty);
          })()}
          <Card title="Thông tin tài khoản gửi"><p className="mgr-callout">Tên tối đa 50 ký tự. Các thay đổi chỉ được áp dụng sau khi lưu thành công.</p>
            <form id="sender-account-form" noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const errors = senderValidation(senderForm);
                setSenderErrors(errors);
                if (Object.keys(errors).length) { setError("Thông tin tài khoản chưa hợp lệ. Kiểm tra các ô được đánh dấu."); return; }
                setError("");
                void run(
                  async () => {
                    const saved = await api<Sender>(
                      `sender-accounts${screen === "manager-account-edit" ? `/${senderEditId}` : ""}`,
                      screen === "manager-account-edit" ? "PATCH" : "POST",
                      {
                        name: senderForm.name,
                        code: senderForm.code,
                        email: senderForm.email,
                        status: senderForm.status,
                        quota3Days: Number(senderForm.quota3Days),
                        smtpHost: senderForm.smtpHost,
                        smtpPort: Number(senderForm.smtpPort),
                        smtpUser: senderForm.smtpUser,
                        ...(senderForm.smtpPassword
                          ? { smtpPassword: senderForm.smtpPassword }
                          : {}),
                        inboundEnabled: senderForm.inboundEnabled,
                      },
                    );
                    setSelected(saved.id);
                    setSenders(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
                    return saved;
                  },
                  "Đã lưu tài khoản gửi.",
                  "manager-account-saved",
                );
              }}
            >
              {screen === "manager-account-add" && <p className="mgr-callout">Để dùng Google OAuth: lưu tài khoản ở trạng thái Ngừng hoạt động, để trống mật khẩu và chưa bật IMAP; sau đó mở chi tiết để kết nối Google.</p>}
              <div className="next-grid">
              <Field disabled={busy}
                label="Tên tài khoản"
                error={senderErrors.name}
                value={senderForm.name}
                set={(value) => setSenderForm({ ...senderForm, name: value })}
                required
              />
              <Field disabled={busy} label="Mã tài khoản gửi" value={senderForm.code} set={value => setSenderForm({ ...senderForm, code: value })} error={senderErrors.code} required />
              <Field
                label="Địa chỉ email người gửi"
                error={senderErrors.email}
                disabled={busy || (screen === "manager-account-edit" && !!senders.find(item => item.id === senderEditId)?.google_status)}
                value={senderForm.email}
                set={(value) => setSenderForm({ ...senderForm, email: value })}
                type="email"
                required
              />
              <Field
                label="Máy chủ SMTP"
                error={senderErrors.smtpHost}
                disabled={busy || (screen === "manager-account-edit" && !!senders.find(item => item.id === senderEditId)?.google_status)}
                value={senderForm.smtpHost}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpHost: value })
                }
                required
              />
              <Field
                label="Cổng SMTP"
                error={senderErrors.smtpPort}
                disabled={busy || (screen === "manager-account-edit" && !!senders.find(item => item.id === senderEditId)?.google_status)}
                value={senderForm.smtpPort}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpPort: value })
                }
                type="number"
                required
              />
              <Field
                label="Tên đăng nhập SMTP"
                error={senderErrors.smtpUser}
                disabled={busy || (screen === "manager-account-edit" && !!senders.find(item => item.id === senderEditId)?.google_status)}
                value={senderForm.smtpUser}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpUser: value })
                }
                required
              />
              <Field
                label="Mật khẩu ứng dụng Gmail"
                disabled={busy || (screen === "manager-account-edit" && !!senders.find(item => item.id === senderEditId)?.google_status)}
                value={senderForm.smtpPassword}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpPassword: value })
                }
                type="password"
                placeholder="Để trống khi dùng kết nối Google"
              />
              <Field disabled={busy}
                label="Hạn mức email / 3 ngày"
                error={senderErrors.quota3Days}
                value={senderForm.quota3Days}
                set={(value) =>
                  setSenderForm({ ...senderForm, quota3Days: value })
                }
                type="number"
                required
              />
              <label className="next-field">
                Trạng thái
                <select
                  value={senderForm.status}
                  onChange={(e) =>
                    setSenderForm({ ...senderForm, status: e.target.value })
                  }
                >
                  <option value="inactive">Ngừng hoạt động</option>
                  <option value="active">Hoạt động</option>
                  <option value="blocked">Bị khóa</option>
                </select>
              </label>
              </div>
              <label className="next-choice">
                <input
                  type="checkbox"
                  checked={senderForm.inboundEnabled}
                  onChange={(e) =>
                    setSenderForm({
                      ...senderForm,
                      inboundEnabled: e.target.checked,
                    })
                  }
                />{" "}
                Đồng bộ thư đến qua Gmail IMAP
              </label>

            </form>
          </Card>
          <div className="next-actions-bar"><Button disabled={busy} onClick={() => go(screen === "manager-account-edit" ? "manager-account-detail" : "manager-account-list")}>Hủy</Button><button className="next-button primary" type="submit" form="sender-account-form" disabled={busy}>Lưu tài khoản</button></div>
        </Page>
      );
    return (
      <Page section="Tài khoản gửi" title="Chi tiết tài khoản" go={go} backTo={manager ? "manager-account-list" : "sender-list"}>
        {feedback}
        <div className="next-actions-bar"><Button onClick={() => go(manager ? "manager-account-list" : "sender-list")}>Quay lại danh sách</Button></div>
        {manager && sender && googleConnection(sender)}
        {sender ? (
          <Card title={sender.name}><dl className="next-details"><dt>Mã tài khoản gửi</dt><dd>{sender.code || `TK-${sender.id}`}</dd><dt>Ngày tạo</dt><dd>{date(sender.created_at)}</dd><dt>Cập nhật lần cuối</dt><dd>{date(sender.updated_at)}</dd></dl>
            <p>
              {sender.email} ·{" "}
              {sender.status === "active" ? "Hoạt động" : "Ngừng hoạt động"}
            </p>
            <p>
              Đã dùng {n(sender.used_3_days)} / {n(sender.quota_3_days)} email
              trong 3 ngày · SMTP:{" "}
              {sender.configured ? "Đã lưu thông tin kết nối" : "Cần kết nối"} · Gmail
              IMAP: {sender.inbound_enabled ? "Bật" : "Tắt"}
            </p>
            {manager && (
              <div className="next-actions-bar">
                <Button disabled={busy} onClick={() => {
                  ask("Ẩn tài khoản gửi", "Chỉ có thể Ẩn tài khoản chưa dùng trong chiến dịch.", () =>
                    void run(() => api(`sender-accounts/${sender.id}`, "DELETE"), "Đã Ẩn tài khoản gửi.", "manager-account-list"));
                }}>Ẩn</Button>
                <div className="next-delete-other-actions">
                <Button
                  onClick={() => {
                    setSenderEditId(sender.id);
                    loadedSenderEditId.current = sender.id;
                    setSenderForm({
                      name: sender.name,
                      code: sender.code || `TK-${sender.id}`,
                      email: sender.email,
                      smtpHost: sender.smtp_host || "",
                      smtpPort: String(sender.smtp_port || 465),
                      smtpUser: sender.smtp_user || "",
                      smtpPassword: "",
                      status: sender.status,
                      quota3Days: String(sender.quota_3_days),
                      inboundEnabled: sender.inbound_enabled,
                    });
                    go("manager-account-edit", { key: "senderId", id: sender.id });
                  }}
                >
                  Sửa
                </Button>
                <Button
                  disabled={busy || !sender.configured}
                  onClick={() =>
                    void run(
                      () => api(`sender-accounts/${sender.id}/verify`, "POST"),
                      "Kết nối SMTP thành công.",
                    )
                  }
                >
                  Kiểm tra SMTP
                </Button>
                <Button
                  disabled={busy || !sender.inbound_enabled}
                  onClick={() =>
                    void run(
                      () =>
                        api(
                          `sender-accounts/${sender.id}/verify-inbox`,
                          "POST",
                        ),
                      "Kết nối Gmail IMAP thành công.",
                    )
                  }
                >
                  Kiểm tra IMAP
                </Button>
                <Button
                  disabled={busy || !sender.inbound_enabled}
                  onClick={() =>
                    void run(
                      () =>
                        api(`sender-accounts/${sender.id}/sync-inbox`, "POST"),
                      "Đã đồng bộ hộp thư đến.",
                    )
                  }
                >
                  Đồng bộ thư đến
                </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card>Chưa có tài khoản gửi.</Card>
        )}
      </Page>
    );
  }

  return (
    <Page section="Trang chính" title="Chức năng" go={go}>
      {feedback}
      <Card>Chọn chức năng trong menu để bắt đầu.</Card>
    </Page>
  );
}
