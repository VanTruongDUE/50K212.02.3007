import Notification from "./Notification";
import { campaignStage, campaignLabel, campaignNext } from "./campaignWorkflow";
import { invalidEmailVariable } from "./campaignContent";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ApiError, api, idNumber } from "./api";
import { recordContext, recordKey, recordRequired, selectedRecord, type Navigate, type RecordContext } from "./recordNavigation";
import { createContactExport, type ExportFormat } from "./exportContacts";
import { CampaignInfo, Dialog, ExhaustedFollowup, PreviewBody, Stepper } from "./NextFlows";
import { followupDeadline, isFollowupExhausted } from "./followupResult";
import { selectionOptions } from "./criteriaOptions";
import { senderProfileValidation } from "./senderValidation";
import FigmaState from "./FigmaState";
import { followupValidation } from "./followupValidation";
import CampaignEditor, { type EditorHandle } from "./CampaignEditor";
import { expectedFinish, scheduleError, scheduleFieldErrors, sendDuration } from "./campaignSchedule";
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
  campaign_id?: string | null;
  campaign_name?: string | null;
  source_list_names?: string[];
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
type RecipientFilter = { original: number; valid: number; excluded: number; duplicate: number; invalid: number; unsubscribe: number; bounce?: number; recent?: number };
type Campaign = {
  filter_summary?: RecipientFilter;
  id: string;
  name: string;
  description?: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  pending_count?: number;
  manager_comment?: string | null;
  reviewed_at?: string | null;
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
  quota_daily: number;
  quota_hourly: number;
  used_today: number;
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
  contact_id?: string | null;
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
              ? "manager-account-home"
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
        {(section === title && !crumbLabel) ||
         (section === "Tài khoản gửi" && title === "Kiểm tra tài khoản gửi") ? (
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
function EditorIcon({ name }: { name: "list" | "image" | "button" | "variable" | "attachment" | "file" | "check" | "eye" | "calendar" | "edit" | "mail" | "key" }) {
  const paths = {
    list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></>,
    button: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
    variable: <><path d="M9 3H7a2 2 0 0 0-2 2v4l-2 3 2 3v4a2 2 0 0 0 2 2h2M15 3h2a2 2 0 0 1 2 2v4l2 3-2 3v4a2 2 0 0 1-2 2h-2" /></>,
    attachment: <path d="m21 11-8 8a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.9l8.5-8.5" />,
    file: <><path d="M14 2H5v20h14V7zM14 2v5h5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    edit: <><path d="m16 3 5 5L8 21H3v-5zM14 5l5 5" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    key: <><circle cx="7" cy="16" r="4" /><path d="m10 13 10-10M16 7l3 3M18 5l3 3" /></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
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
        {required && <span className="next-required-marker" aria-hidden="true"> *</span>}
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
function ContactEmail({contact, compact = false}: {contact: Contact; compact?: boolean}) {
  if (compact) return <span title={contact.search_provenance ? "Email công khai và hợp lệ cú pháp; chưa xác minh khả năng nhận thư. Thông tin suy đoán: Chưa đảm bảo." : undefined}>{contact.email}</span>;
  return <>{contact.email}{contact.search_provenance && <small className="search-source-note"><br/><span title="Email công khai trên website nguồn và hợp lệ cú pháp; chưa xác minh khả năng nhận thư.">Đã xác nhận</span> · Chức vụ/ngành/khu vực suy đoán: Chưa đảm bảo{contact.source_url && <> · <a href={contact.source_url} target="_blank" rel="noreferrer">Nguồn</a></>}</small>}</>;
}
function ContactAudit({ list, criteria = false }: { list: ContactList; criteria?: boolean }) {
  const labels: Record<string, string> = { role: "Chức vụ Contact", industry: "Ngành nghề / lĩnh vực", location: "Địa điểm / khu vực", keyword: "Từ khóa doanh nghiệp", size: "Quy mô doanh nghiệp", email: "Trạng thái email" };
  return <div className="next-contact-audit">
    <p className="next-hint">Nguồn: {list.criteria?.source || "Danh sách Contact"} · {list.search_started_at ? date(list.search_started_at) : date(list.created_at)}</p>
    {criteria && <div className="next-confirmation-status"><span>Kết quả kiểm tra: {list.employee_review === "passed" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"}</span><span>Trạng thái xác nhận: {list.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</span></div>}
    <div className="mgr-stats">{[
      ["Contact nhận được", list.search_received], ["Không hợp lệ", list.search_invalid],
      ["Trùng lặp", list.search_duplicate], ["Contact mới hợp lệ", list.search_new_count],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{typeof value === "number" ? `${n(value)} Contact` : "—"}</strong></div>)}</div>
    {criteria && <><h3>Tiêu chí đã sử dụng</h3><dl className="next-criteria-summary">{Object.entries(labels).map(([key, label]) => { const value = list.criteria?.[key]; return <div key={key}><dt>{label}</dt><dd>{Array.isArray(value) ? value.join(", ") || "—" : value || "—"}</dd></div>; })}</dl></>}
  </div>;
}
function Table({ heads, rows, rowKeys, selectedRow, onSelect }: { heads: string[]; rows: ReactNode[][]; rowKeys?: string[]; selectedRow?: number; onSelect?: (index: number) => void }) {
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
              <tr key={rowKeys?.[i] ?? i} className={onSelect && i === selectedRow ? "selected" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? event => { if (!(event.target as HTMLElement).closest("button,a,input")) onSelect(i); } : undefined} onKeyDown={onSelect ? event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(i); } } : undefined}>
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
  const [recipientDraft, setRecipientDraft] = useState<Campaign | null>(null);
  const [recipientCampaign, setRecipientCampaign] = useState<Campaign | null>(null);
  const [deleteCampaign, setDeleteCampaign] = useState<Campaign | null>(null);
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
      history.replaceState(history.state, "", url);
    }
  }

  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [senderDetail, setSenderDetail] = useState<Sender | null>(null);
  const [senderDetailError, setSenderDetailError] = useState("");
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
  const [stepNotice, setStepNotice] = useState<{ target: string; message: string } | null>(null);
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
    variable_errors?: string[];
  } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "phone">("desktop");
  const [previewContactId, setPreviewContactId] = useState("");
  const editorBodyRef = useRef<EditorHandle>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<
    { id: string; kind: string; file_name: string; size_bytes?: number }[]
  >([]);
  const [showLogoLibrary, setShowLogoLibrary] = useState(false);
  const [buttonBlock, setButtonBlock] = useState<{ label: string; url: string } | null>(null);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"scheduled" | "now" | null>(null);
  const [scheduleCalculated, setScheduleCalculated] = useState<boolean | null>(null);
  const [scheduleAttempted, setScheduleAttempted] = useState(false);
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
    quotaDaily: "",
    quotaHourly: "",
    inboundEnabled: false,
  });
  const go = useCallback((next: string, context?: RecordContext) => {
    if (next === "campaign-confirm" || next === "campaign-resume") { setEditingSection(false); setSchedule(null); setSendMode(null); setSendRate(null); setWindowFrom(null); setWindowTo(null); setSenderName(null); }
    navigate(next, context ?? (selectionRef.current.key === recordKey(next) ? selectionRef.current : undefined));
  }, [navigate]);
  useEffect(() => {
    // A retry belongs to the failed payload; editing must submit the current form instead.
    queueMicrotask(() => setRetryAction(null));
  }, [name, description, criteria, senderForm, subject, body, email, phone, senderId, senderName, schedule, sendMode, sendRate, windowFrom, windowTo, goal, due, reminderMinutes, waitDays, maxAttempts, intervalDays, decisionNote, pauseReason, selectedLists, replyChannel, followChannel, statusNote, needsNext, exportFormat, editCampaign, selected]);
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
      setScheduleAttempted(false);
      setRetryAction(null);
      setError("");
      setFailureDialog(null);
      setStepNotice(value => value?.target === screen ? value : null);
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
      } else if (screen === "followup-note") {
        if (!followup) return;
        setDecisionNote(followup.note || "");
      } else if (screen === "campaign-sender") {
        if (!campaign) return;
        setSenderCheckResult(null);
        setSenderId(campaign.sender_account_id || "");
        setSenderName(campaign.sender_name || senders.find(item => item.id === campaign.sender_account_id)?.name || "");
      } else if (["manager-account-edit", "manager-account-connection"].includes(screen)) {
        if (!sender) return;
        setSenderEditId(sender.id);
        setSenderForm({ code: sender.code || `TK-${sender.id}`, name: sender.name, email: sender.email, smtpHost: sender.smtp_host || "",
          smtpPort: String(sender.smtp_port || 465), smtpUser: sender.smtp_user || "", smtpPassword: "",
          status: sender.status, quotaDaily: String(sender.quota_daily), quotaHourly: String(sender.quota_hourly), inboundEnabled: sender.inbound_enabled });
      } else {
        loadedForm.current = "";
        return;
      }
      loadedForm.current = formKey;
    });
    return () => { active = false; };
  }, [screen, selected, filters, responseItem, sender, campaign, senders, followup]);
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
            setSenderEditId(editing.id);
            setSenderForm({
              name: editing.name,
              code: editing.code || `TK-${editing.id}`,
              email: editing.email,
              smtpHost: editing.smtp_host || "",
              smtpPort: String(editing.smtp_port || 465),
              smtpUser: editing.smtp_user || "",
              smtpPassword: "",
              status: editing.status,
              quotaDaily: String(editing.quota_daily), quotaHourly: String(editing.quota_hourly),
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
    api<{ id: string; kind: string; file_name: string; size_bytes?: number }[]>(
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
    api<{ subject: string; body: string; variable_errors?: string[] }>(`campaigns/${assetCampaignId}/preview`, "POST", { ...(previewContactId ? { contactId: idNumber(previewContactId) } : {}), ...(previewDraft || {}) })
      .then(result => { if (active) setPreviewResult(result); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Không tạo được bản xem trước."); });
    return () => { active = false; };
  }, [screen, assetCampaignId, previewContactId, previewDraft]);
  useEffect(() => {
    if (screen !== "campaign-sender" || !campaign?.id || !senderId) return;
    let active = true;
    api(`campaigns/${campaign.id}/sender-check`, "POST", { senderAccountId: idNumber(senderId) })
      .then(() => { if (active) setSenderCheckResult({ id: senderId, connected: true, message: "" }); })
      .catch(reason => { if (active) setSenderCheckResult({ id: senderId, connected: false, message: reason.message }); });
    return () => { active = false; };
  }, [screen, campaign?.id, senderId]);
  useEffect(() => {
    if (!selected || !["manager-account-detail", "manager-account-edit", "manager-account-delete", "manager-account-connection"].includes(screen)) return;
    let active = true;
    api<Sender>(`sender-accounts/${selected}`).then(value => { if (active) { setSenderDetail(value); setSenderDetailError(""); } }).catch(reason => { if (active) setSenderDetailError(reason.message); });
    return () => { active = false; };
  }, [screen, selected, reload]);
  useEffect(() => {
    if (group !== "campaigns" || !campaign || loading) return;
    const preparation = ["campaign-email", "campaign-editor", "campaign-preview", "campaign-sender", "campaign-schedule", "campaign-confirm"];
    const blocked = preparation.includes(screen) && !["approved", "paused", "scheduled"].includes(campaign.status);
    if (!blocked) return;
    const target = campaignNext(campaign) || (campaign.status === "pending_approval" ? "campaign-pending" : "campaign-list");
    const message = ["pending_approval", "rejected", "draft"].includes(campaign.status) ? "Danh sách người nhận chưa được Trưởng phòng duyệt." : "Chiến dịch không ở bước chuẩn bị hoặc tạm dừng.";
    let active = true;
    queueMicrotask(() => { if (active) { go(target); setStepNotice({target, message}); } });
    return () => { active = false; };
  }, [screen, group, campaign, loading, go]);
  async function run<T>(
    action: () => Promise<T>,
    message: string,
    next?: string,
    onError?: (error: Error) => void,
    onSuccess?: (result: T) => void,
  ) {
    const startedSearch = location.search;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (group === "campaigns" && location.search !== startedSearch) return undefined;
      setNotice(message);
      setConfirmAction(null);
      setReload((x) => x + 1);
      if (next) go(next);
      onSuccess?.(result);
      return result;
    } catch (e) {
      if (group === "campaigns" && location.search !== startedSearch) return undefined;
      const failure = e instanceof Error ? e : new Error("Không thể hoàn tất thao tác. Vui lòng thử lại.");
      setError(failure.message);
      setRetryAction(group === "campaigns" && failure instanceof ApiError && failure.status < 500 ? null : () => () => { void run(action, message, next, onError, onSuccess); });
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
  const ask = (title: string, message: string, action: () => void, danger = true) => {
    setClock(Date.now());
    setConfirmAction({ title, message, action, danger });
  };
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
  const completionEstimate = (item: Campaign, now: number) => {
    const account = senders.find(value => value.id === item.sender_account_id);
    const count = Math.max(0, item.pending_count ?? item.recipient_count - item.sent_count);
    const rate = Math.min(item.send_rate ?? 50, account?.quota_hourly ?? 50);
    const from = item.window_start?.slice(0,5) || "08:00", to = item.window_end?.slice(0,5) || "17:00";
    return item.status === "paused" ? sendDuration(count, rate, from, to)
      : item.send_mode === "now" ? sendDuration(count, rate)
      : date(expectedFinish(item.scheduled_at || "", count, rate, from, to, false, account?.quota_daily, account?.used_today, now));
  };
  const feedback = (
    <>
      {manager && group === "senders" && googleResult && googleResult !== "connected" && googleMessages[googleResult] && (
        <p role="alert" className="mgr-callout">{googleMessages[googleResult]}</p>
      )}
      {stepNotice?.target === screen && <p className="mgr-callout" role="status">{stepNotice.message}</p>}
      {loading && (
        <p role="status" className="next-card">
          Đang tải dữ liệu…
        </p>
      )}
      {error && (
        <div role="alert" className="next-error"><strong>{screen === "export" ? "Xuất dữ liệu không thành công" : screen === "check" ? "Không thể lưu kết quả kiểm tra" : screen === "confirm" ? "Không thể xác nhận danh sách" : screen === "campaign-editor" ? "Không thể lưu nội dung email" : screen === "campaign-filtered" ? "Không thể lưu danh sách người nhận" : screen === "response-add" ? "Thông tin Response chưa hợp lệ" : screen === "response-edit" ? "Thông tin cập nhật chưa hợp lệ" : screen === "followup-create" ? "Thông tin lịch Follow-up chưa hợp lệ" : screen === "followup-note" ? "Không thể lưu ghi chú" : screen === "response-reply" ? "Gửi phản hồi chưa thành công" : screen === "campaign-schedule" ? "Không thể lưu lịch gửi" : screen === "campaign-sender" ? "Không thể lưu tài khoản gửi" : screen === "campaign-confirm" ? "Không thể xác nhận chiến dịch" : screen === "campaign-resume" ? "Không thể tiếp tục gửi" : "Không thể hoàn tất thao tác"}</strong><p>{error}</p>{retryAction && <Button disabled={busy} onClick={retryAction}>{screen === "response-reply" ? "Thử gửi lại" : screen === "followup-note" ? "Thử lưu ghi chú" : screen === "confirm" ? "Thử xác nhận lại" : screen === "check" ? "Thử lưu" : "Thử lại"}</Button>}</div>
      )}
      {notice && !(group === "campaigns" && screen === "campaign-list") && (
        <Notification key={notice} className="mgr-toast" onClose={() => setNotice("")}>
          <strong>{notice}</strong>
          <span>Thông tin đã được cập nhật.</span>
        </Notification>
      )}
      {confirmAction && (
        <Dialog pending={busy}
          className={group === "campaigns" ? "next-campaign-dialog" : ""}
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
          {(group !== "campaigns" || confirmAction.danger) && <p>{confirmAction.message}</p>}{error && <p role="alert" className="next-error">{error}</p>}
          {group === "campaigns" && campaign && !confirmAction.danger && <dl className="next-details"><dt>Số email sẽ gửi</dt><dd>{n((campaign.pending_count ?? Math.max(0, campaign.recipient_count - campaign.sent_count)))}</dd><dt>Tài khoản gửi</dt><dd>{senders.find(item => item.id === campaign.sender_account_id)?.email || "—"}</dd><dt>Thời điểm bắt đầu</dt><dd>{campaign.status === "paused" ? "Sau 15 phút kể từ khi tiếp tục" : campaign.send_mode === "now" ? "Ngay sau khi xác nhận" : date(campaign.scheduled_at)}</dd><dt>Thời điểm hoàn tất dự kiến</dt><dd>{completionEstimate(campaign, clock)}</dd></dl>}
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
      <Page section="Tìm kiếm Contact" title="Filter Template" className="next-template-list" go={go}>
        {feedback}
        <section className="flow-panel">
          {loading ? <p role="status">Đang tải Filter Template…</p> : filters.length ? <>
            <div className="template-table-wrap"><table className="flow-table">
              <colgroup><col style={{width: "24%"}} /><col style={{width: "21.4%"}} /><col style={{width: "18%"}} /><col style={{width: "15.6%"}} /><col style={{width: "21%"}} /></colgroup>
              <thead><tr><th>Template</th><th>Chức vụ Contact</th><th>Từ khóa</th><th>Khu vực</th><th>Quy mô doanh nghiệp</th></tr></thead>
              <tbody>{filters.map((item) => <tr key={item.id} className={active?.id === item.id ? "selected-row" : ""}>
                <td><button className="table-select" type="button" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.name}<small>FT-{item.id}</small></button></td>
                <td>{item.criteria.role.join(", ") || "—"}</td>
                <td>{item.criteria.keyword || "—"}</td>
                <td>{item.criteria.location.join(", ") || "—"}</td>
                <td>{item.criteria.size.join(", ") || "—"}</td>
              </tr>)}</tbody>
            </table></div>
            <p className="panel-footnote">Đang chọn: {active ? `FT-${active.id} · ${active.name}` : "Chưa chọn Template"}</p>
          </> : <FigmaState title="Chưa có Filter Template" description="Tạo Template để lưu bộ tiêu chí tìm kiếm." actions={<Button primary onClick={() => go("template-create")}>Tạo Filter Template</Button>} />}
        </section>
        <div className="flow-actions"><div>
          <Button disabled={!active} onClick={() => { if (!active) return; setSelected(active.id); setCriteria(active.criteria); setName(active.name); go("template-edit", { key: "filterId", id: active.id }); }}>Cập nhật Template</Button>
          <Button onClick={() => { setName(""); setCriteria(emptyCriteria); go("template-create"); }}>Tạo Template</Button>
        </div><div><Button primary disabled={!active} onClick={() => { if (!active) return; sessionStorage.setItem("v5-applied-filter", JSON.stringify(active.criteria)); go("criteria"); }}>Xem / áp dụng tiêu chí</Button></div></div>
      </Page>
    ) : (
      <Page section="Tìm kiếm Contact" title={edit ? "Cập nhật Filter Template" : "Tạo Filter Template"} className={"next-template-figma" + (edit ? " is-editing" : "")} go={go}>
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
        return <Page section="Kiểm tra danh sách" title="Nhận xét danh sách" description={current.campaign_name || current.name} className="next-manager-review-reject" go={go}>
          {feedback}
          <Card title="Lý do không đạt"><dl className="next-details"><dt>Chiến dịch</dt><dd>{current.campaign_name || "—"}</dd><dt>Danh sách đã kiểm tra</dt><dd>{current.source_list_names?.length ? current.source_list_names.join("; ") : current.name}</dd></dl>
            <Field disabled={busy} label="Nhận xét của trưởng phòng" value={decisionNote} set={setDecisionNote} rows={5} required />
            <p className="mgr-callout">Nhận xét này sẽ đi cùng kết quả gửi cho nhân viên tạo chiến dịch.</p>
          </Card>
          <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("manager-review-detail")}>Hủy</Button><Button primary disabled={busy || !decisionNote.trim()} onClick={() => void run(() => api(`contact-lists/${current.id}/approval`, "POST", { decision: "rejected", comment: decisionNote }), "Đã trả danh sách kèm nhận xét.", "manager-review-rejected")}>Xác nhận không đạt</Button></div>
        </Page>;
      if (screen === "manager-review-approved" || screen === "manager-review-rejected")
        return <Page section="Kiểm tra danh sách" title="Kết quả kiểm tra danh sách" className="next-manager-review-result" description={current.campaign_name || current.name} crumbLabel="Chi tiết danh sách" go={go}>
          {feedback}
          <Card title={current.manager_review === "approved" ? "Đã duyệt" : current.manager_review === "rejected" ? "Danh sách không đạt" : "Chờ duyệt"}>
            <Table heads={["Thông tin", "Giá trị"]} rows={[
              [current.campaign_id ? "Trạng thái chiến dịch" : "Trạng thái danh sách", current.manager_review === "approved" ? "Danh sách đã duyệt" : current.manager_review === "rejected" ? "Danh sách không đạt" : "Chờ duyệt"],
              ["Người duyệt · thời điểm", `Trưởng phòng Marketing · ${date(current.reviewed_at)}`],
              ...(current.manager_review !== "approved" ? [["Nhận xét", current.manager_comment || decisionNote || "—"]] : []),
              ["Thông báo kết quả", current.campaign_id ? "Đã thông báo cho nhân viên tạo chiến dịch" : "Nhân viên tạo danh sách có thể xem kết quả kiểm tra"],
            ]} />
            <p className={`mgr-callout ${current.manager_review === "approved" ? "success" : ""}`}>{current.campaign_id ? current.manager_review === "approved" ? "Nhân viên tạo chiến dịch có thể xem kết quả duyệt." : "Nhân viên tạo chiến dịch nhận kết quả cùng nhận xét của trưởng phòng." : "Nhân viên tạo danh sách có thể xem kết quả cùng nhận xét của trưởng phòng."}</p>
          </Card>
          <div className="next-actions-bar"><Button primary onClick={() => go("manager-review")}>Về danh sách</Button></div>
        </Page>;
      if (screen === "manager-review-detail")
        return <Page section="Kiểm tra danh sách" title="Chi tiết danh sách Contact" description={current.name} className="next-manager-review-detail" go={go}>
          {feedback}
          <Card title="Kết quả lọc người nhận">
            <div className="mgr-stats">{[["Contact ban đầu", n(current.search_received ?? current.contact_count)], ["Email không hợp lệ", n(invalid)], ["Email trùng", n(duplicates)], ["Người nhận hợp lệ", n(valid)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <div className="mgr-list-heading"><h2>Người nhận hợp lệ</h2><button type="button" onClick={() => go("manager-review-all-contacts")}>Xem toàn bộ danh sách</button></div>
            <Table heads={["Họ tên", "Địa chỉ email", "Chức vụ", "Doanh nghiệp"]} rows={contacts.filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)).slice(0, 5).map(item => [item.full_name || "—", <ContactEmail key={item.id} contact={item} compact />, item.job_title || "—", item.company || "—"])} />
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
      if (screen === "all-contacts") return <Page section="Danh sách Contact" title="Toàn bộ Contact" description={null} className="next-all-contacts-page" go={go}>
        {feedback}<Card><p className="next-hint">Nguồn: {current.criteria?.source || "Danh sách Contact"} · {date(current.search_started_at || current.created_at)}</p><h2>Toàn bộ Contact</h2><p>Hiển thị {current.contacts?.length ? (contactPage - 1) * 10 + 1 : 0}–{Math.min(contactPage * 10, current.contacts?.length || 0)} trong {n(current.contact_count)} Contact · Trang {contactPage}/{Math.max(1, Math.ceil((current.contacts?.length || 0) / 10))}</p>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice((contactPage - 1) * 10, contactPage * 10).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} compact />, c.job_title || "—", c.company || "—"])} />
          <details className="next-contact-evidence"><summary>Nguồn và thông tin kiểm tra email</summary><p>Email công khai và hợp lệ cú pháp; chưa xác minh khả năng nhận thư. Thông tin suy đoán: Chưa đảm bảo.</p>{(current.contacts || []).slice((contactPage - 1) * 10, contactPage * 10).map(contact => <p key={contact.id}>{contact.email}{contact.source_url && <> · <a href={contact.source_url} target="_blank" rel="noreferrer">Website nguồn</a></>}</p>)}</details>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go(contactReturnScreen)}>Quay lại kiểm tra</Button><Button disabled={contactPage <= 1} onClick={() => setContactPage(p => p - 1)}>Trang trước</Button><Button primary disabled={contactPage >= Math.ceil((current.contacts?.length || 0) / 10)} onClick={() => setContactPage(p => p + 1)}>Trang tiếp</Button></div>
      </Page>;
      if (screen === "check-rejected") return <Page section="Danh sách Contact" title="Danh sách chưa đạt yêu cầu" go={go}>{feedback}<FigmaState error title="Danh sách chưa đạt yêu cầu" description="Kết quả kiểm tra đã được lưu. Danh sách chưa được xác nhận." actions={<><Button onClick={() => go("check")}>Kiểm tra lại</Button><Button primary onClick={() => go("contact-lists")}>Quay lại danh sách</Button></>} /></Page>;
      if (screen === "check") return <Page section="Danh sách Contact" title="Kiểm tra danh sách Contact" description="Rà soát danh sách và lưu kết quả kiểm tra." className="next-contact-review next-contact-check" go={go}>
        {feedback}<Card>
          <ContactAudit list={current} />
          <div className="mgr-list-heading"><button type="button" onClick={() => showAll(screen)}>Hiển thị toàn bộ contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} compact />, c.job_title || "—", c.company || "—"])} />
          <div className="next-review-guidance"><p>Rà soát chức danh, ngành nghề, quy mô, vị trí và chất lượng email.</p><p>Email: định dạng · tên miền · khả năng sử dụng từ nguồn · trùng lặp.</p><p>Lưu kết quả kiểm tra không tự xác nhận danh sách.</p></div>
        </Card>
        <div className="next-actions-bar"><Button disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "failed" }), "Đã ghi kết quả không đạt.", "check-rejected")}>Lưu: Chưa đạt yêu cầu</Button><Button primary disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "passed" }), "Đã ghi kết quả đạt.", "confirm")}>Lưu: Đạt yêu cầu</Button></div>
      </Page>;
      if (screen === "confirm") return <Page section="Danh sách Contact" title="Xác nhận danh sách Contact" description="Danh sách đạt yêu cầu và đang chờ xác nhận." className="next-contact-review next-contact-confirm" go={go}>
        {feedback}<Card title={`${current.name} · DS-${current.id}`}><ContactAudit list={current} criteria />
          <div className="mgr-list-heading"><h2>Contact trong danh sách</h2><button type="button" onClick={() => showAll("confirm")}>Hiển thị toàn bộ contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} compact />, c.job_title || "—", c.company || "—"])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("check")}>Quay lại</Button><Button primary disabled={busy || current.employee_review !== "passed" || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/confirm`, "POST"), "Đã xác nhận danh sách và gửi Trưởng phòng duyệt.", "confirmed")}>Xác nhận danh sách</Button></div>
      </Page>;
      if (screen === "confirmed") return <Page section="Danh sách Contact" title="Danh sách đã xác nhận" description={`Hiển thị ${Math.min(5, current.contacts?.length || 0)} trong ${n(current.contact_count)} Contact đã xác nhận.`} className="next-contact-review next-contact-confirmed" go={go}>
        {feedback}<Card><ContactAudit list={current} /><div className="mgr-list-heading"><button type="button" onClick={() => showAll("confirmed")}>Hiển thị toàn bộ contact</button></div><Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", <ContactEmail key={c.id} contact={c} compact />, c.job_title || "—", c.company || "—"])} /><div className="next-review-guidance"><p>Kết quả kiểm tra: {current.employee_review === "passed" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"}</p><p>Trạng thái danh sách: {current.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</p></div></Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("export")}>Xuất danh sách</Button></div>
      </Page>;
      if (screen === "export-success") return <Page section="Danh sách Contact" title="Xuất dữ liệu thành công" description="Tệp xuất đã sẵn sàng." className="next-export-page" go={go}>{feedback}<section className="flow-notice success next-export-success" role="status"><div><p>Tệp đã được tạo và sẵn sàng tải xuống.</p>{exportFile && <a className="flow-download" download={exportFile.name} href={exportFile.url}>{exportFile.name}</a>}</div></section><div className="next-actions-bar"><Button onClick={() => go("confirmed")}>Quay lại danh sách</Button></div></Page>;
      if (screen === "export") return <Page section="Danh sách Contact" title="Xuất danh sách Contact" description={exportFormat ? `Định dạng đã chọn: ${exportFormat} (.${exportFormat.toLowerCase()}).` : "Chọn định dạng tệp để xuất danh sách."} className="next-export-page" go={go}>
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
        <Page section="Chiến dịch" title="Chiến dịch" className="next-campaign-list-page" go={go}>
          {feedback}
          <div className="next-toolbar">
            <Button
              primary
              onClick={() => {
                setSelected(""); setRecipientDraft(null); setRecipientCampaign(null);
                setName("");
                setDescription("");
                setSelectedLists([]);
                go("campaign-contacts");
              }}
            >
              ＋ Tạo chiến dịch mới
            </Button>
          </div>
          {notice && <Notification key={notice} className="next-campaign-notice" onClose={() => setNotice("")}><strong>{notice.includes("tạm dừng") ? "Tạm dừng thành công" : notice.includes("tiếp tục") ? "Tiếp tục gửi thành công" : notice.includes("xác nhận") ? "Xác nhận thành công" : "Cập nhật thành công"}</strong><span>{notice}</span></Notification>}
          <div className="next-table-wrap"><table className="next-table next-campaign-table"><thead><tr>
            <th>Tên</th><th>Trạng thái</th><th>Tiến độ</th><th>Ngày tạo</th><th>Thao tác</th>
          </tr></thead><tbody>{campaigns.length ? campaigns.map(item => <tr key={item.id}>
            <td><strong>{item.name}</strong></td><td><span className={`next-campaign-status status-${campaignStage(item)}`}>{campaignLabel(item)}</span></td>
            <td>{n(item.sent_count)}/{n(item.recipient_count)}</td><td>{date(item.created_at)}</td>
            <td className="next-row-actions"><div className="next-campaign-actions">
              <button onClick={() => { setBusy(true); setError(""); void api<Campaign>(`campaigns/${item.id}`).then(setCampaignOverview).catch(reason => setFailureDialog({ title: "Không thể xem thông tin chiến dịch", message: reason.message })).finally(() => setBusy(false)); }}>Xem</button>
              {campaignNext(item) && <button onClick={() => {
                if (item.status === "rejected") {
                  setBusy(true); setError("");
                  void api<Campaign>(`campaigns/${item.id}`).then(value => { setRecipientCampaign(value); setName(value.name); setDescription(value.description || ""); setSelectedLists(value.lists?.map(list => list.id) || []); setRecipientDraft(null); choose(item.id, "campaign-contacts"); }).catch(reason => setError(reason.message)).finally(() => setBusy(false));
                } else choose(item.id, campaignNext(item));
              }}>Mở</button>}
              {["confirmation", "scheduled", "paused"].includes(campaignStage(item)) && <button onClick={() => { if (item.status === "scheduled" && item.scheduled_at && Date.parse(item.scheduled_at) < Date.now() + 15 * 60000) { setFailureDialog({ title: "Không thể chỉnh sửa chiến dịch", message: "Không thể chỉnh sửa chiến dịch trước giờ gửi dưới 15 phút." }); return; } setSelected(item.id); setShowCampaignEditChoice(true); }}>Chỉnh sửa</button>}
              {item.status === "paused" && <button className="next-resume-action" onClick={() => choose(item.id, "campaign-resume")}>Tiếp tục gửi</button>}
              {["scheduled", "sending"].includes(item.status) && <button className="next-pause-action" onClick={() => openCampaignPause(item)}>Tạm dừng</button>}
              {!["sending", "completed"].includes(item.status) && <button className="danger-link" onClick={() => {
                if (item.sent_count > 0) { setFailureDialog({ title: "Không thể xóa chiến dịch", message: "Chiến dịch đã gửi email nên không thể xóa. Lịch sử gửi được giữ nguyên." }); return; }
                setDeleteCampaign(item);
              }}>Xóa chiến dịch</button>}
            </div></td>
          </tr>) : <tr><td colSpan={5}>Chưa có chiến dịch. Tạo chiến dịch mới để bắt đầu.</td></tr>}</tbody></table></div>
          {deleteCampaign && <Dialog pending={busy} title="Xóa chiến dịch" className="next-campaign-dialog next-campaign-delete" cancelLabel="Hủy" confirmLabel="Xóa" danger onClose={() => setDeleteCampaign(null)} onConfirm={() => {
            void run(() => api(`campaigns/${deleteCampaign.id}`, "DELETE"), `Đã xóa chiến dịch “${deleteCampaign.name}”.`).then(saved => { if (saved) setDeleteCampaign(null); });
          }}><dl className="next-details"><dt>Tên chiến dịch</dt><dd>{deleteCampaign.name}</dd></dl><div className="next-delete-warning" role="alert"><strong>Thao tác không thể hoàn tác</strong><p>Chiến dịch đã xóa không thể khôi phục.</p></div></Dialog>}
          {campaignEditDialog}
          {showCampaignEditChoice && campaign && <Dialog pending={busy} title={`Chỉnh sửa chiến dịch "${campaign.name}"`} className="next-campaign-dialog next-campaign-edit-choice" cancelLabel="Hủy" onClose={() => setShowCampaignEditChoice(false)}><p>Chọn mục cần sửa:</p><div className="next-dialog-links"><Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEdit(campaign); }}><EditorIcon name="edit" />Thông tin chung</Button><Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEmail(campaign); }}><EditorIcon name="mail" />Nội dung email</Button><Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); go("campaign-sender"); }}><EditorIcon name="key" />Tài khoản gửi</Button><Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); go("campaign-schedule"); }}><EditorIcon name="calendar" />Lịch gửi</Button></div></Dialog>}
          {campaignOverview && <Dialog pending={busy} title="Thông tin chiến dịch" className={"next-campaign-dialog next-campaign-overview" + (campaignOverview.status === "paused" ? " next-paused-detail" : "")} onClose={() => setCampaignOverview(null)}>
            <dl className="next-details">
              <dt>Tên</dt><dd>{campaignOverview.name}</dd>
              <dt>Trạng thái</dt><dd><span className="next-overview-status">{campaignLabel(campaignOverview)}</span></dd>
              <dt>Số người nhận</dt><dd>{n(campaignOverview.recipient_count)}</dd>
              <dt>Tiêu đề email</dt><dd>{campaignOverview.subject || "Chưa có nội dung"}</dd>
              <dt>Tài khoản gửi</dt><dd>{senders.find(item => item.id === campaignOverview.sender_account_id)?.email || "Chưa chọn"}</dd>
              <dt>Thời điểm bắt đầu</dt><dd>{campaignOverview.scheduled_at ? <time dateTime={campaignOverview.scheduled_at}>{new Date(campaignOverview.scheduled_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })} {new Date(campaignOverview.scheduled_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" })}</time> : "—"}</dd>
              {campaignOverview.status === "paused" && <><dt>Thời điểm tạm dừng</dt><dd>{date(campaignOverview.paused_at)}</dd><dt>Lý do tạm dừng</dt><dd>{campaignOverview.pause_reason || "Không ghi lý do"}</dd></>}
            </dl>
          </Dialog>}
        </Page>
      );
    if (screen === "campaign-contacts" || screen === "campaign-filtered") {
      const filtered = screen === "campaign-filtered" ? recipientDraft : null;
      return <Page section="Chiến dịch" title={recipientCampaign?.name || "Tạo chiến dịch mới"} description={null} className="next-campaign-contacts-page" go={go}>
        {feedback}
        <Stepper current={1} />
        {recipientCampaign && <div className="next-delete-warning next-recipient-review" role="alert"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg><div><strong>Nhận xét của Trưởng phòng</strong><p>{recipientCampaign.manager_comment}</p></div></div>}
        <form onSubmit={event => {
          event.preventDefault(); setBusy(true); setError(""); setNotice("");
          void api<Campaign>("campaigns/recipients/filter", "POST", { name: name.trim(), description: description.trim(), listIds: selectedLists.map(idNumber) })
            .then(result => { setRecipientDraft({ ...result, id: "", status: "draft", sent_count: 0 }); go("campaign-filtered"); })
            .catch(reason => setError(reason.message)).finally(() => setBusy(false));
        }}>
          <div className="next-grid">
            <Card title="Thông tin chiến dịch">
              <div className="next-field"><label htmlFor="new-campaign-name">Tên chiến dịch <small>(bắt buộc)</small></label><input id="new-campaign-name" disabled={busy} readOnly={!!filtered} value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Nhập tên chiến dịch" required /></div>
              <p className="next-hint">Tối đa 100 ký tự.</p>
              <div className="next-field"><label htmlFor="new-campaign-description">Mô tả</label><textarea id="new-campaign-description" disabled={busy} readOnly={!!filtered} value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={2000} /></div>
            </Card>
            <Card title='Danh sách contact “Đã xác nhận”'>
              {lists.filter(item => item.confirmed_at).map(item => <label key={item.id} className="next-choice"><input type="checkbox" disabled={busy || !!filtered} checked={selectedLists.includes(item.id)} onChange={event => setSelectedLists(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span>{item.name}</span><small>{n(item.contact_count)} contact</small></label>)}
              {!lists.some(item => item.confirmed_at) && <p>Chưa có danh sách Contact đã xác nhận.</p>}
            </Card>
          </div>
          {filtered?.filter_summary && <>
            <Card title="Kết quả lọc"><div className="next-filter-stats"><div><strong>{n(filtered.filter_summary.original)}</strong><span>Tổng số contact ban đầu</span></div><div><strong>{n(filtered.filter_summary.excluded)}</strong><span>Số contact bị loại</span></div><div><strong>{n(filtered.recipient_count)}</strong><span>Số contact hợp lệ</span></div></div></Card>
            {!filtered.recipient_count && <div className="next-error next-recipient-error" role="alert"><strong>Danh sách không đủ dữ liệu hợp lệ</strong><p>Số contact bị loại theo lý do: email trùng {n(filtered.filter_summary.duplicate)}; khách hàng đã từ chối nhận email {n(filtered.filter_summary.unsubscribe)}; email trống hoặc sai định dạng {n(filtered.filter_summary.invalid)}.</p></div>}
          </>}
          <div className="next-actions-bar">
            {/* Distinct keys prevent a reselect click from submitting the newly rendered Apply button. */}
            {filtered ? <><Button key="reselect" primary={!filtered.recipient_count} disabled={busy} onClick={() => { setRecipientDraft(null); setError(""); go("campaign-contacts"); }}>Chọn lại</Button>
              {!!filtered.recipient_count && <Button primary disabled={busy} onClick={() => {
                void run(async () => {
                  const saved = await api<Campaign>("campaigns", "POST", { name: name.trim(), description: description.trim(), listIds: selectedLists.map(idNumber), ...(recipientCampaign ? { campaignId: idNumber(recipientCampaign.id) } : {}) });
                  setCampaigns(items => [saved, ...items.filter(item => item.id !== saved.id)]); setSelected(saved.id); setRecipientDraft(null);
                  go("campaign-pending", { key: "campaignId", id: saved.id }); return saved;
                }, "");
              }}>Xác nhận danh sách người nhận</Button>}</> : <Button key="apply" type="submit" primary disabled={busy || !name.trim() || name.length > 100 || selectedLists.length === 0}>Áp dụng</Button>}
          </div>
        </form>
      </Page>;
    }
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
    if (["campaign-email", "campaign-editor", "campaign-preview", "campaign-sender", "campaign-schedule", "campaign-confirm"].includes(screen) && !["approved", "scheduled", "paused"].includes(current.status)) return <Page section="Chiến dịch" title="Không thể chỉnh sửa chiến dịch" go={go}>{feedback}<FigmaState error title="Chiến dịch không ở bước chuẩn bị hoặc tạm dừng" description="Tạm dừng chiến dịch trước khi thay đổi nội dung, tài khoản hoặc lịch gửi. Lịch sử gửi được giữ nguyên." actions={<Button onClick={() => go("campaign-list")}>Về danh sách chiến dịch</Button>} /></Page>;
    const cancelEdit = editingSection ? <Button disabled={busy} onClick={() => { setEditingSection(false); go(current.status === "paused" ? "campaign-resume" : "campaign-confirm"); }}>Hủy</Button> : null;
    const logo = assets.find(item => item.kind === "logo");
    const effectiveRate = Math.min(Number(sendRate ?? current.send_rate ?? 50), senders.find(item => item.id === current.sender_account_id)?.quota_hourly ?? 50);
    const effectiveFrom = windowFrom ?? current.window_start?.slice(0, 5) ?? "08:00";
    const effectiveTo = windowTo ?? current.window_end?.slice(0, 5) ?? "17:00";
    const remainingCount = Math.max(0, current.pending_count ?? current.recipient_count - current.sent_count);
    const contentReady = !!current.subject && !!current.body && !invalidEmailVariable(current.subject + "\n" + current.body);
    const senderReady = senders.some(item => item.id === current.sender_account_id && item.status === "active" && item.configured && item.used_today < item.quota_daily * 0.8 && item.quota_daily - item.used_today >= remainingCount);
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
    if (screen === "campaign-pending")
      return <Page section="Chiến dịch" title={current.name} description={null} className="next-campaign-pending-page" go={go}>
        {feedback}
        {!editingSection && <Stepper current={1} />}
        <div className="next-notice next-recipient-notice" role="status"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6667" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><path d="m7 10 2 3 5-5" /></svg><div><strong>Danh sách đã được gửi kiểm tra</strong><span>Chiến dịch chuyển sang “Chờ kiểm tra danh sách”. Trưởng phòng đã nhận được yêu cầu kiểm tra danh sách.</span></div></div>
        <section className="next-card next-pending-card"><h2>Chiến dịch</h2><dl className="next-details"><dt>Tên chiến dịch</dt><dd>{current.name}</dd><dt>Trạng thái</dt><dd><span className="next-recipient-status">{campaignLabel(current)}</span></dd><dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd></dl></section>
      </Page>;
    if (screen === "campaign-layouts")
      return (
        <Page section="Chiến dịch" title={current.name} description={null} go={go}>
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <Card title="Bố cục trống">
            <div className="next-layout-grid">{[1, 2, 3].map(number =>
              <div className="next-layout-option" key={number}>
                <div aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></svg></div>
                <strong>Bố cục trống {number}</strong>
                <Button onClick={() => { setSubject(""); setBody(""); setPreviewResult(null); go("campaign-editor"); }}>Chọn bố cục</Button>
              </div>)}</div>
          </Card>
        </Page>
      );
    if (screen === "campaign-email")
      return (
        <Page section="Chiến dịch" title={current.name} description={null} className="next-email-library-page" go={go}>
          {feedback}
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-toolbar compact"><Button onClick={() => go("campaign-layouts")}>＋ Soạn email mới</Button></div>
          <Card title="Thư viện mẫu email" className="next-email-library">
            <Table
              heads={["Tên mẫu", "Danh mục", "Ngày cập nhật", ""]}
              rows={templates.map((item) => [
                item.name,
                item.category || "Mẫu đã lưu",
                item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }) : "—",
                <Button
                  key={item.id}
                  onClick={() => {
                    const namedOnly = ["Giới thiệu sản phẩm", "Bản tin định kỳ"].includes(item.name);
                    if (namedOnly) { setSubject(""); setBody(""); go("campaign-editor"); return; }
                    void run(() => api<{ subject: string; body: string; variable_errors?: string[] }>(`email-templates/${item.id}/apply`, "POST", { campaignId: idNumber(current.id) }), "Đã chọn mẫu email.", undefined, undefined, applied => {
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
        <Page section="Chiến dịch" title={current.name} description={null} className="next-live-editor" go={go}>
          {feedback}
          {!editingSection && <Stepper current={2} />}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-editor-layout">
            <section className="next-card next-editor-main">
              <h2>Trình soạn thảo</h2>
              <div className="next-field"><label htmlFor="campaign-subject">Tiêu đề email <small>(bắt buộc)</small></label>
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
              <Card title="Khối kéo thả" className="next-editor-blocks">
                <input ref={imageInputRef} className="sr-only" type="file" accept="image/png,image/jpeg" aria-label="Chọn ảnh nội dung email" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id, "image").then(saved => { if (saved) insertEditorText(`[[Hình ảnh:${saved.id}]]`); }); event.target.value = ""; }} />
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("text/plain", "\n")} onClick={() => insertEditorText("\n")}><EditorIcon name="list" />Văn bản</button>
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("application/x-v5-block", "image")} onClick={() => imageInputRef.current?.click()}><EditorIcon name="image" />Hình ảnh</button>
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("application/x-v5-block", "button")} onClick={() => { setError(""); setButtonBlock({ label: "", url: "" }); }}><EditorIcon name="button" />Nút</button>
                <button className="next-button" type="button" draggable onDragStart={event => event.dataTransfer.setData("text/plain", "[[Đường phân cách]]")} onClick={() => insertEditorText("[[Đường phân cách]]")}><EditorIcon name="list" />Đường phân cách</button>
              </Card>
              <Card title="Chèn" className="next-editor-insert">
                <Button onClick={() => insertEditorText("{{Họ tên}}")}><EditorIcon name="variable" />Chèn biến cá nhân hóa</Button>
                <Button onClick={() => { setError(""); setShowLogoLibrary(true); }}><EditorIcon name="image" />Chọn logo từ thư viện</Button>
                <label className="next-button next-file-button"><EditorIcon name="image" />Tải ảnh logo lên
                  <input type="file" disabled={busy} accept="image/png,image/jpeg,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
                <label className="next-button next-file-button"><EditorIcon name="attachment" />Đính kèm brochure PDF
                  <input type="file" disabled={busy} accept="application/pdf" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
              </Card>
              <Card title="Tệp đính kèm" className="next-editor-attachments">
                {assets.length ? assets.map(item => <div key={item.id} className="next-editor-attachment"><span><EditorIcon name={item.kind === "pdf" ? "file" : "image"} /><span>{item.file_name}{item.size_bytes !== undefined && ` (${(item.size_bytes / (item.size_bytes >= 1048576 ? 1048576 : 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${item.size_bytes >= 1048576 ? "MB" : "KB"})`}</span></span><Button disabled={busy} onClick={() => void run(() => api(`campaigns/${current.id}/assets/${item.id}`, "DELETE"), "Đã Ẩn tệp.").then(deleted => { if (deleted) { setPreviewResult(null); if (item.kind === "image") setBody(current => current.replaceAll(`[[Hình ảnh:${item.id}]]`, "")); } })}>Ẩn</Button></div>) : <p>Chưa có tệp đính kèm</p>}
              </Card>

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
          <p className={"next-editor-preview-status" + (previewResult ? " viewed" : "")} role="status">{previewResult && <EditorIcon name="check" />}Nội dung {previewResult ? "đã được xem trước sau lần chỉnh sửa cuối" : "chưa được xem trước sau lần chỉnh sửa cuối"}.</p>
          <div className="next-actions-bar">{cancelEdit}
            <Button disabled={busy} onClick={() => {
              if (!subject.trim() || !body.trim()) { setError("Vui lòng nhập tiêu đề và nội dung email."); return; }
              setError("");
              setPreviewResult(null);
              setPreviewDraft({ subject, body });
              go("campaign-preview");
            }}><EditorIcon name="eye" />Xem trước</Button>
            <Button primary disabled={busy || !previewResult || !!previewResult.variable_errors?.length} onClick={() => update("content", "PATCH", { subject, body, requirePreview: true }, "Đã lưu nội dung email.", current.status === "paused" ? "campaign-resume" : editingSection ? "campaign-confirm" : "campaign-sender")}>Lưu nội dung</Button>
          </div>

        </Page>
      );
    if (screen === "campaign-preview" && error && !previewResult)
      return <Page section="Chiến dịch" title="Xem trước email" crumbLabel={current.name} description={null} className="next-campaign-preview" go={go}>
        <Card title="Không tạo được bản xem trước">
          <p role="alert">{error}</p>
          <p>Nội dung đang soạn được giữ nguyên.</p>
          <Button primary onClick={() => go("campaign-editor")}>Quay lại trình soạn thảo</Button>
        </Card>
      </Page>;
    if (screen === "campaign-preview")
      return (
        <Page section="Chiến dịch" title="Xem trước email" crumbLabel={current.name} description={null} className="next-campaign-preview" go={go}>
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
          {!!previewResult?.variable_errors?.length && <div className="next-error next-variable-errors" role="alert"><strong><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7.5" /><path d="M10 5.5v5M10 13v1" /></svg>Biến lỗi</strong><p>Biến sai cú pháp hoặc không tồn tại: {previewResult.variable_errors.join(", ")}.</p></div>}
          <section className="next-preview-stage">
            <div className={"next-card next-mail " + (previewDevice === "phone" ? "phone" : "")}>
              {previewResult ? <>
                <h2>Tiêu đề: <PreviewBody value={previewResult.subject} variableErrors={previewResult.variable_errors} /></h2>
                {logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}
                <div className="next-mail-body" style={{ whiteSpace: "pre-wrap" }}><PreviewBody value={previewResult.body} campaignId={current.id} variableErrors={previewResult.variable_errors} /></div>
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
    if (screen === "campaign-sender") {
      const availableSenders = senders.filter(item => item.status === "active").sort((a, b) => Number(b.id === current.sender_account_id) - Number(a.id === current.sender_account_id));
      const checked = senderCheckResult?.id === senderId ? senderCheckResult : null;
      const selectedSender = availableSenders.find(item => item.id === senderId);
      return (
        <Page section="Chiến dịch" title={current.name} description={null} className="next-sender-page" go={go}>
          {feedback}
          {!editingSection && <Stepper current={3} />}
          <div className="next-campaign-info"><div><span>Chiến dịch</span><strong>{current.name}</strong></div><div><span>Số người nhận</span><strong>{n(current.recipient_count)}</strong></div></div>
          <Card title={'Tài khoản gửi "Hoạt động"'} className="next-sender-accounts">
            <Table
              heads={["Địa chỉ email", "Tên hiển thị", "Giới hạn gửi mỗi ngày", "Đã gửi trong ngày", "Hạn mức còn lại"]}
              selectedRow={availableSenders.findIndex(item => item.id === senderId)}
              onSelect={index => {
                const item = availableSenders[index];
                if (!busy) { setSenderCheckResult(null); setSenderId(item.id); setSenderName(item.name); }
              }}
              rows={availableSenders.map((item) => [
                  <label key={item.id} className="next-sender-option"><input
                    type="radio"
                    name="sender"
                    aria-label={`Chọn ${item.name}`}
                    checked={senderId === item.id}
                    disabled={busy}
                    onChange={() => { setSenderCheckResult(null); setSenderId(item.id); setSenderName(item.name); }}
                  /><span>{item.email}</span></label>,
                  item.name,
                  `${n(item.quota_daily)}/ngày`,
                  n(item.used_today),
                  n(Math.max(0, item.quota_daily - item.used_today)),
                ])}
            />
          </Card>
          {selectedSender && checked?.connected && <div className="next-sender-eligible" role="status"><EditorIcon name="check" /><div><strong>Tài khoản đủ điều kiện gửi</strong><span>{selectedSender.email}: kết nối máy chủ email thành công; hạn mức đã dùng dưới 80%; hạn mức còn lại {n(Math.max(0, selectedSender.quota_daily - selectedSender.used_today))} không nhỏ hơn số người nhận {n(remainingCount)}.</span></div></div>}
          {senderId && !checked && <p role="status">Đang kiểm tra kết nối máy chủ email…</p>}
          {checked && !checked.connected && <div className="next-error" role="alert"><strong>Tài khoản chưa đủ điều kiện gửi</strong><p>{checked.message}</p></div>}
          {senderId && <Card title="Người gửi" className="next-sender-identity">
            <div className="next-field"><label htmlFor="campaign-sender-name">Tên người gửi hiển thị <small>(bắt buộc)</small></label><input id="campaign-sender-name" disabled={busy} value={senderName ?? current.sender_name ?? selectedSender?.name ?? ""} onChange={event => setSenderName(event.target.value)} maxLength={50} required aria-describedby="campaign-sender-name-help" /><small id="campaign-sender-name-help">Tối đa 50 ký tự.</small>{error && (!senderName?.trim() || senderName.length > 50) && <p className="next-field-error" role="alert">Vui lòng nhập tên người gửi, tối đa 50 ký tự.</p>}</div>
            <div className="next-field"><label htmlFor="campaign-sender-email">Địa chỉ email gửi</label><input id="campaign-sender-email" value={selectedSender?.email || ""} readOnly aria-describedby="campaign-sender-email-help" /><small id="campaign-sender-email-help">Không sửa địa chỉ email gửi ở bước này.</small></div>
          </Card>}
          {!senders.some(item => item.status === "active" && item.configured && item.quota_daily - item.used_today >= remainingCount) && <FigmaState error title="Chưa có tài khoản gửi phù hợp" description="Tài khoản phải hoạt động, có kết nối và đủ hạn mức cho người nhận chưa gửi." actions={<Button onClick={() => setReload(value => value + 1)}>Tải lại tài khoản</Button>} />}
          {senderId && <div className="next-actions-bar">{cancelEdit}
            <Button primary disabled={busy || !checked?.connected || !senders.some(item => item.id === senderId && item.status === "active" && item.configured && item.quota_daily - item.used_today >= remainingCount)}
              onClick={() => update("sender", "PATCH", { senderAccountId: idNumber(senderId), senderName: senderName ?? current.sender_name ?? senders.find(item => item.id === senderId)?.name }, "Đã chọn tài khoản gửi.", current.status === "paused" ? "campaign-resume" : editingSection ? "campaign-confirm" : "campaign-schedule")}>Xác nhận tài khoản</Button>
          </div>}
        </Page>
      );
    }
    if (screen === "campaign-schedule") {
      const selectedMode = sendMode ?? current.send_mode ?? "scheduled";
      const scheduleValue = schedule ?? (current.scheduled_at ? new Date(new Date(current.scheduled_at).getTime() + 7 * 3600000).toISOString().slice(0, 16) : "");
      const calculated = scheduleCalculated ?? !!current.scheduled_at;
      const scheduleFields = scheduleAttempted ? scheduleFieldErrors(scheduleValue, effectiveRate, effectiveFrom, effectiveTo, selectedMode === "now", clock) : {};
      return (
        <Page section="Chiến dịch" title={current.name} description={null} className="next-schedule-page" go={go}>
          {feedback}
          {!editingSection && <Stepper current={4} />}
          <div className="next-campaign-info">
            <div><span>Số người nhận</span><strong>{n(current.recipient_count)}</strong></div>
            <div><span>Tài khoản gửi</span><strong>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</strong></div>
            <div><span>Giới hạn gửi mỗi ngày</span><strong>{n(senders.find(item => item.id === current.sender_account_id)?.quota_daily)}</strong></div>
          </div>
          <Card title="Lịch gửi" className="next-schedule-form">
            <div className="next-field"><label>Kiểu gửi</label><div className="next-inline">
              <label><input type="radio" name="campaign-send-mode" checked={selectedMode === "scheduled"} onChange={() => { setSendMode("scheduled"); setScheduleCalculated(false); }} /> Hẹn giờ</label>
              <label><input type="radio" name="campaign-send-mode" checked={selectedMode === "now"} onChange={() => { setSendMode("now"); setScheduleCalculated(true); }} /> Gửi ngay</label>
            </div></div>
            <div className="next-grid">
              <div className="next-field"><label htmlFor="campaign-send-date">Ngày bắt đầu</label>{selectedMode === "now" ? <input id="campaign-send-date" value="Ngay sau khi chiến dịch được xác nhận" readOnly /> : <div className="next-schedule-control"><input id="campaign-send-date" aria-invalid={!!scheduleFields.date} aria-describedby={scheduleFields.date ? "campaign-date-error" : undefined} className={!scheduleValue.slice(0, 10) ? "is-empty" : ""} type="date" value={scheduleValue.slice(0, 10)} onChange={event => { setSchedule(event.target.value + "T" + (scheduleValue.slice(11, 16) || "09:00")); setScheduleCalculated(false); }} />{!scheduleValue.slice(0, 10) && <span aria-hidden="true">dd/MM/yyyy</span>}</div>}<small>Múi giờ GMT+7</small>{scheduleFields.date && <small role="alert" id="campaign-date-error">{scheduleFields.date}</small>}</div>
              <div className="next-field"><label htmlFor="campaign-send-time">Giờ bắt đầu</label>{selectedMode === "now" ? <input id="campaign-send-time" value="--:--" readOnly /> : <div className="next-schedule-control"><input id="campaign-send-time" aria-invalid={!!scheduleFields.time} aria-describedby={scheduleFields.time ? "campaign-time-error" : undefined} className={!scheduleValue.slice(11, 16) ? "is-empty" : ""} type="time" value={scheduleValue.slice(11, 16)} onChange={event => { setSchedule((scheduleValue.slice(0, 10) || new Date(clock).toISOString().slice(0, 10)) + "T" + event.target.value); setScheduleCalculated(false); }} /><span aria-hidden="true" className={scheduleValue.slice(11, 16) ? "has-value" : ""}>{scheduleValue.slice(11, 16) || "HH:mm"}</span></div>}<small>HH:mm</small>{scheduleFields.time && <small role="alert" id="campaign-time-error">{scheduleFields.time}</small>}</div>
            </div>
            <div className="next-grid next-three">
              <div className="next-field"><label htmlFor="campaign-speed">Tốc độ gửi (email/giờ)</label><input id="campaign-speed" aria-invalid={!!scheduleFields.rate} aria-describedby={scheduleFields.rate ? "campaign-speed-error" : undefined} type="number" min="1" max={senders.find(item => item.id === current.sender_account_id)?.quota_hourly ?? 100} value={sendRate === "" ? "" : effectiveRate} onChange={event => { setSendRate(event.target.value); setScheduleCalculated(false); }} /><small>Mặc định {Math.min(50, senders.find(item => item.id === current.sender_account_id)?.quota_hourly ?? 50)} email/giờ.</small>{scheduleFields.rate && <small role="alert" id="campaign-speed-error">{scheduleFields.rate}</small>}</div>
              <div className="next-field"><label htmlFor="campaign-from">Khung giờ gửi - từ</label><div className="next-schedule-control"><input id="campaign-from" aria-invalid={!!scheduleFields.from} aria-describedby={scheduleFields.from ? "campaign-from-error" : undefined} type="time" value={effectiveFrom} onChange={event => { setWindowFrom(event.target.value); setScheduleCalculated(false); }} /><span aria-hidden="true" className="has-value">{effectiveFrom}</span></div><small>Mặc định 08:00</small>{scheduleFields.from && <small role="alert" id="campaign-from-error">{scheduleFields.from}</small>}</div>
              <div className="next-field"><label htmlFor="campaign-to">Khung giờ gửi - đến</label><div className="next-schedule-control"><input id="campaign-to" aria-invalid={!!scheduleFields.to} aria-describedby={scheduleFields.to ? "campaign-to-error" : undefined} type="time" value={effectiveTo} onChange={event => { setWindowTo(event.target.value); setScheduleCalculated(false); }} /><span aria-hidden="true" className="has-value">{effectiveTo}</span></div><small>Mặc định 17:00</small>{scheduleFields.to && <small role="alert" id="campaign-to-error">{scheduleFields.to}</small>}</div>
            </div>
          </Card>
          {calculated && <Card title="Lịch dự kiến" className="next-schedule-projection"><dl className="next-details"><dt>Thời điểm bắt đầu</dt><dd>{selectedMode === "now" ? "Ngay sau khi chiến dịch được xác nhận" : date(scheduleValue)}</dd><dt>Số email mỗi giờ</dt><dd>{effectiveRate}</dd><dt>Thời điểm hoàn tất dự kiến</dt><dd>{date(expectedFinish(selectedMode === "now" ? new Date(clock).toISOString() : scheduleValue + "+07:00", remainingCount, effectiveRate, effectiveFrom, effectiveTo, selectedMode === "now", senders.find(item => item.id === current.sender_account_id)?.quota_daily, senders.find(item => item.id === current.sender_account_id)?.used_today, clock))}</dd></dl></Card>}
          <div className="next-actions-bar">{cancelEdit}
            {<Button primary={!calculated} disabled={busy} onClick={() => {
              if (calculated) { setScheduleCalculated(false); setScheduleAttempted(false); return; }
              setScheduleAttempted(true);
              const issues = scheduleFieldErrors(scheduleValue, effectiveRate, effectiveFrom, effectiveTo, selectedMode === "now", Date.now());
              if (Object.keys(issues).length) { setError(""); return; }
              setError(""); setScheduleCalculated(true);
            }}>{!calculated && <EditorIcon name="calendar" />}{calculated ? "Điều chỉnh" : "Tính lịch dự kiến"}</Button>}
            {calculated && <Button primary disabled={busy} onClick={() => update("schedule", "PATCH", { sendNow: selectedMode === "now", scheduledAt: selectedMode === "now" ? undefined : new Date(scheduleValue + "+07:00").toISOString(), rate: effectiveRate, windowStart: effectiveFrom, windowEnd: effectiveTo }, "Đã lưu lịch gửi.", current.status === "paused" ? "campaign-resume" : "campaign-confirm")}>Lưu lịch gửi</Button>}
          </div>
        </Page>
      );
    }
    if (screen === "campaign-confirm")
      return (
        <Page section="Chiến dịch" title={current.name} description={null} className="next-confirm-page" go={go}>
          {feedback}
          <Stepper current={5} />
          <div className="next-grid next-confirm-grid">
            <Card title="Danh sách người nhận"><p className={"next-validity" + (remainingCount > 0 ? "" : " invalid")}>{remainingCount > 0 ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Tên danh sách</dt><dd>{current.lists?.map(item => item.name).join("; ") || lists.filter(item => selectedLists.includes(item.id)).map(item => item.name).join("; ") || "—"}</dd>
              <dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd>
              <dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd><dt>Thời điểm duyệt</dt><dd>{current.reviewed_at ? date(current.reviewed_at) : current.lists?.map(item => `${item.name}: ${date(item.reviewed_at)}`).join("; ") || "—"}</dd>
            </dl></Card>
            <Card title="Nội dung email"><p className={"next-validity" + (contentReady ? "" : " invalid")}>{contentReady ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Tiêu đề</dt><dd>{current.subject || "" || "—"}</dd>
              <dt>Ảnh thu nhỏ nội dung</dt><dd><div className="next-mail-thumb"><strong>{current.subject || ""}</strong><span>{(current.body || "").slice(0, 160)}</span></div></dd>
              <dt>Biến cá nhân hóa</dt><dd>{(current.body || "").match(/\{\{[^}]+\}\}/g)?.join(", ") || "—"}</dd>
              <dt>Tệp đính kèm</dt><dd>{assets.filter(item => item.kind === "pdf").map(item => item.file_name).join(", ") || "Không có"}</dd>
            </dl></Card>
            <Card title="Tài khoản gửi"><p className={"next-validity" + (senderReady ? "" : " invalid")}>{senderReady ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Địa chỉ email</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</dd>
              <dt>Tên người gửi</dt><dd>{current.sender_name || senders.find(item => item.id === current.sender_account_id)?.name || "—"}</dd>
              <dt>Hạn mức còn lại</dt><dd>{n(Math.max(0, (senders.find(item => item.id === current.sender_account_id)?.quota_daily || 0) - (senders.find(item => item.id === current.sender_account_id)?.used_today || 0)))}</dd>
            </dl></Card>
            <Card title="Lịch gửi"><p className={"next-validity" + (current.send_mode === "now" || (current.scheduled_at && !scheduleError(current.scheduled_at)) ? "" : " invalid")}>{current.send_mode === "now" || (current.scheduled_at && !scheduleError(current.scheduled_at)) ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
              <dt>Thời điểm bắt đầu</dt><dd>{current.send_mode === "now" ? "Ngay sau khi xác nhận" : date(current.scheduled_at)}</dd>
              <dt>Tốc độ gửi</dt><dd>{effectiveRate} email/giờ</dd>
              <dt>Thời điểm hoàn tất dự kiến</dt><dd>{completionEstimate(current, clock)}</dd><dt>Khung giờ gửi</dt><dd>{current.send_mode === "now" ? "Gửi ngay" : `${effectiveFrom}–${effectiveTo}`}</dd>
            </dl></Card>
          </div>
          <div className="next-actions-bar">
            <Button disabled={busy} onClick={() => {
              setBusy(true); setError(""); setPreviewResult(null);
              void api<{ subject: string; body: string; variable_errors?: string[] }>(`campaigns/${current.id}/preview`, "POST", {})
                .then(result => { setPreviewResult(result); setShowConfirmEmail(true); })
                .catch(reason => setError(reason instanceof Error ? reason.message : "Không xem được nội dung email."))
                .finally(() => setBusy(false));
            }}>Xem nội dung email</Button>
            <Button onClick={() => setShowCampaignEditChoice(true)}>Chỉnh sửa</Button>
            <Button primary disabled={busy || !confirmEmailViewed || !contentReady || !senderReady || remainingCount < 1 || !current.sender_account_id || !current.scheduled_at || (current.send_mode !== "now" && !!scheduleError(current.scheduled_at))} onClick={() => ask("Xác nhận chiến dịch", `Gửi ${n(current.recipient_count)} email từ ${senders.find(item => item.id === current.sender_account_id)?.email || "tài khoản đã chọn"}, bắt đầu ${current.send_mode === "now" ? "ngay sau khi xác nhận" : date(current.scheduled_at)}?`, () => update("confirm", "POST", undefined, current.send_mode === "now" ? "Đã xác nhận. Chiến dịch bắt đầu gửi ngay." : "Đã xác nhận và lên lịch chiến dịch.", "campaign-list"), false)}>{current.send_mode === "now" ? "Xác nhận gửi ngay" : "Xác nhận gửi"}</Button>
          </div>
          {showConfirmEmail && previewResult && <Dialog pending={busy} title="Nội dung email" className="next-email-dialog" onClose={() => { setShowConfirmEmail(false); setConfirmEmailViewed(!previewResult.variable_errors?.length); }}><p>Contact đầu tiên: {current.recipients?.[0]?.full_name || current.recipients?.[0]?.email || "—"} - {current.recipients?.[0]?.email || "—"}</p><div className="next-email-dialog-body"><strong>{previewResult.subject}</strong>{logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}<div><PreviewBody value={previewResult.body} campaignId={current.id} variableErrors={previewResult.variable_errors} /></div>{assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>Đính kèm: {item.file_name}</small>)}</div></Dialog>}
          {showCampaignEditChoice && <Dialog pending={busy} title={`Chỉnh sửa chiến dịch "${current.name}"`} className="next-campaign-dialog next-campaign-edit-choice" cancelLabel="Hủy" onClose={() => setShowCampaignEditChoice(false)}><p>Chọn mục cần sửa:</p><div className="next-dialog-links">
            <Button onClick={() => { setShowCampaignEditChoice(false); openCampaignEdit(current); }}><EditorIcon name="edit" />Thông tin chung</Button>
            <Button onClick={() => openCampaignEmail(current)}><EditorIcon name="mail" />Nội dung email</Button>
            <Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); setConfirmEmailViewed(false); go("campaign-sender"); }}><EditorIcon name="key" />Tài khoản gửi</Button>
            <Button onClick={() => { setShowCampaignEditChoice(false); setEditingSection(true); setConfirmEmailViewed(false); go("campaign-schedule"); }}><EditorIcon name="calendar" />Lịch gửi</Button>
          </div></Dialog>}
          {campaignEditDialog}
        </Page>
      );
    if (screen === "campaign-resume") {
      const needsSender = !senderReady;
      return <Page section="Chiến dịch" title={current.name} description={null} className="next-resume-page" go={go}>
        {feedback}
        {needsSender && <div className="next-notice" role="alert"><div><strong>Cần đổi tài khoản gửi</strong><span>Tài khoản gửi không đủ hạn mức cho {n(remainingCount)} email còn lại. Chiến dịch giữ trạng thái “Đã tạm dừng”.</span></div><Button onClick={() => go("campaign-sender")}>Đổi tài khoản gửi</Button></div>}
        <Card title="Tình trạng gửi" className="next-send-status"><dl className="next-details">
          <dt>Số email đã gửi</dt><dd>{n(current.sent_count)}</dd>
          <dt>Số contact “Chưa gửi”</dt><dd>{n(remainingCount)}</dd>
          <dt>Thời điểm tạm dừng</dt><dd>{date(current.paused_at)}</dd>
          <dt>Lý do tạm dừng</dt><dd>{current.pause_reason || "Không ghi lý do"}</dd>
        </dl></Card>
        <div className="next-grid next-confirm-grid">
          <Card title="Danh sách người nhận"><p className={"next-validity" + (remainingCount > 0 ? "" : " invalid")}>{remainingCount > 0 ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Tên danh sách</dt><dd>{current.lists?.map(item => item.name).join("; ") || "—"}</dd>
            <dt>Số contact hợp lệ</dt><dd>{n(remainingCount)} (chưa gửi)</dd>
            <dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd>
            <dt>Thời điểm duyệt</dt><dd>{current.reviewed_at ? date(current.reviewed_at) : current.lists?.map(item => `${item.name}: ${date(item.reviewed_at)}`).join("; ") || "—"}</dd>
          </dl></Card>
          <Card title="Nội dung email"><p className={"next-validity" + (contentReady ? "" : " invalid")}>{contentReady ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Tiêu đề</dt><dd>{current.subject || "—"}</dd>
            <dt>Ảnh thu nhỏ nội dung</dt><dd><div className="next-mail-thumb"><strong>{current.subject || "—"}</strong><span>{(current.body || "").slice(0, 160)}</span></div></dd>
            <dt>Biến cá nhân hóa</dt><dd>{(current.body || "").match(/\{\{[^}]+\}\}/g)?.join(", ") || "—"}</dd>
            <dt>Tệp đính kèm</dt><dd>{assets.filter(item => item.kind === "pdf").map(item => item.file_name).join(", ") || "Không có"}</dd>
          </dl></Card>
          <Card title="Tài khoản gửi"><p className={"next-validity" + (senderReady ? "" : " invalid")}>{senderReady ? "Hợp lệ" : "Cần xử lý"}</p><dl className="next-details">
            <dt>Địa chỉ email</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</dd>
            <dt>Tên người gửi</dt><dd>{current.sender_name || senders.find(item => item.id === current.sender_account_id)?.name || "—"}</dd>
            <dt>Hạn mức còn lại</dt><dd>{n(Math.max(0, (senders.find(item => item.id === current.sender_account_id)?.quota_daily || 0) - (senders.find(item => item.id === current.sender_account_id)?.used_today || 0)))}</dd>
          </dl></Card>
          <Card title="Lịch gửi"><p className="next-validity">Hợp lệ</p><dl className="next-details">
            <dt>Thời điểm bắt đầu</dt><dd>Sau 15 phút kể từ khi tiếp tục</dd>
            <dt>Tốc độ gửi</dt><dd>{effectiveRate} email/giờ</dd>
            <dt>Thời điểm hoàn tất dự kiến</dt><dd>{completionEstimate(current, clock)}</dd>
          </dl></Card>
        </div>
        <div className="next-actions-bar"><Button onClick={() => go("campaign-list")}>Để sau</Button><Button disabled={busy} onClick={() => {
          setBusy(true); setError(""); setPreviewResult(null);
          void api<{ subject: string; body: string; variable_errors?: string[] }>(`campaigns/${current.id}/preview`, "POST", {})
            .then(result => { setPreviewResult(result); setShowConfirmEmail(true); })
            .catch(reason => setError(reason instanceof Error ? reason.message : "Không xem được nội dung email."))
            .finally(() => setBusy(false));
        }}>Xem nội dung email</Button><Button primary disabled={busy || needsSender || current.status !== "paused" || !resumeEmailViewed || remainingCount < 1 || !contentReady} onClick={() => ask("Tiếp tục gửi chiến dịch", `Tiếp tục gửi cho ${n(remainingCount)} contact chưa gửi?`, () => update("resume", "POST", undefined, `Đã tiếp tục chiến dịch “${current.name}”.`, "campaign-list"), false)}>Tiếp tục gửi</Button></div>
        {showConfirmEmail && previewResult && <Dialog pending={busy} title="Nội dung email" className="next-email-dialog" onClose={() => { setShowConfirmEmail(false); setResumeEmailViewed(!previewResult.variable_errors?.length); }}><p>Contact đầu tiên: {current.recipients?.[0]?.full_name || current.recipients?.[0]?.email || "—"} - {current.recipients?.[0]?.email || "—"}</p><div className="next-email-dialog-body"><strong>{previewResult.subject}</strong>{logo && <img className="next-preview-logo" src={`/api/campaigns/${current.id}/assets/${logo.id}`} alt="Logo V5" />}<div><PreviewBody value={previewResult.body} campaignId={current.id} variableErrors={previewResult.variable_errors} /></div>{assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>Đính kèm: {item.file_name}</small>)}</div></Dialog>}
      </Page>;
    }
    return (
      <Page section="Chiến dịch" title={current.name} description={null} go={go}>
        {feedback}
        <Card title="Thông tin chiến dịch">
          <p>
            Trạng thái: {campaignLabel(current)} ·
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
                ask("Xóa chiến dịch", "Thao tác không thể hoàn tác. Chiến dịch đã xóa không thể khôi phục.", () =>
                  void run(() => api(`campaigns/${current.id}`, "DELETE"), "Đã xóa chiến dịch.", "campaign-list"));
              }}>Xóa chiến dịch</Button>
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
    const activeResponse = visibleResponses.find(item => item.id === selected);
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
              rowKeys={visibleResponses.map(item => item.id)} onSelect={index => setSelected(visibleResponses[index].id)}
              rows={visibleResponses.map((item) => [
                `RSP-${item.id} · ${item.customer_name}`,
                <time key={item.id} className="next-response-received" dateTime={item.received_at}>{new Date(item.received_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })}<br />{new Date(item.received_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" })}</time>,
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
            <Button primary onClick={() => { setName(""); setEmail(""); setPhone(""); setBody(""); go("response-add"); }}>Thêm Response</Button>
            <Button disabled={!activeResponse} onClick={() => { if (activeResponse) choose(activeResponse.id, "response-hide"); }}>Ẩn Response</Button>
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
    const hideBlocked = !["spam", "unsubscribe"].includes(current.kind) ? "Chỉ Response loại Rác hoặc Từ chối nhận email được phép ẩn."
      : current.followups?.length ? "Response đã có lịch Follow-up nên không thể ẩn."
      : current.interactions?.some(item => ["email", "sms"].includes(item.channel)) ? "Response đã có phản hồi gửi đi nên không thể ẩn." : "";
    if (screen === "response-hide") return <Page section="Response" title="Xác nhận ẩn Response" crumbLabel="Ẩn Response" description={`RSP-${current.id} · ${current.customer_name}`} go={go}>
      {feedback}
      <div className="next-compact-confirmation">
        <section><span>XÁC NHẬN ẨN RESPONSE</span><h2>Ẩn Response RSP-{current.id} khỏi danh sách?</h2>
          <p>{current.customer_name} · loại {kinds[current.kind]}{!hideBlocked && " · chưa có lịch sử gửi hoặc Follow-up."}</p>
          <p>Thao tác chỉ ẩn khỏi danh sách làm việc, không xóa dữ liệu gốc.</p>
          {hideBlocked && <p role="alert">{hideBlocked}</p>}
        </section>
        <div className="next-confirmation-actions"><Button primary disabled={busy || d?.id !== current.id || !!hideBlocked} onClick={() => void run(() => api(`responses/${current.id}/hide`, "POST"), "Đã ẩn Response khỏi danh sách.", "response-list")}>Xác nhận ẩn</Button><Button disabled={busy} onClick={() => go("response-list")}>Hủy</Button></div>
      </div>
    </Page>;
    if (screen === "response-history")
      return <Page section="Response" title="Lịch sử phản hồi đã gửi" description={`RSP-${current.id} · ${current.customer_name}`} className="next-history-page" go={go}>
        {feedback}
        <Card title={`Phản hồi gửi đi · ${current.interactions?.length || 0} lượt`}>
          <Table heads={["Thời điểm gửi", "Kênh / Người gửi", "Người nhận", "Nội dung"]}
            rows={(current.interactions || []).map(item => [date(item.created_at), `${item.channel.toUpperCase()} · ${item.actor_id || "Hệ thống"}`, item.channel === "sms" ? current.phone || "—" : current.email, item.content])} />
        </Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status-history")
      return <Page section="Response" title="Lịch sử trạng thái Response" description={`RSP-${current.id} · Phụ trách ${current.assignee_id}`} className="next-history-page" go={go}>
        {feedback}
        <Card title={`Lịch sử xử lý · ${(current.status_history?.length || 0) + 1} mốc`}>
          <Table heads={["Thời điểm", "Trạng thái mới", "Ghi chú"]}
            rows={[[date(current.received_at), responseStatuses[current.status_history?.[0]?.from_status || "new"] || "Mới", "Hệ thống tiếp nhận Response."], ...(current.status_history || []).map(item => [date(item.changed_at), responseStatuses[item.to_status] || item.to_status, item.note || `Nhân viên ${item.actor_id} cập nhật trạng thái.`])]} />
        </Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status") {
      const nextStatus = { new: "processing", processing: "replied", replied: "closed" }[current.status];
      return <Page section="Response" title="Cập nhật trạng thái" className="next-figma-form next-response-status-page" description={`RSP-${current.id} · Trạng thái hiện tại: ${responseStatuses[current.status]}`} go={go}>
        {feedback}
        <Card title={`Trạng thái xử lý · RSP-${current.id}`}>
          <div className="next-grid">
            <div className="next-field"><label htmlFor="current-response-status">Trạng thái hiện tại</label><input id="current-response-status" value={responseStatuses[current.status]} readOnly /></div>
            <div className="next-field"><label htmlFor="new-response-status">Trạng thái mới</label><select id="new-response-status" defaultValue={nextStatus || ""} key={current.status} disabled={!nextStatus}><option value={nextStatus || ""}>{nextStatus ? responseStatuses[nextStatus] : "Không còn bước tiếp theo"}</option></select></div>
          </div>
          <div className="next-field"><label htmlFor="response-status-note">Lý do / Ghi chú</label><input id="response-status-note" value={statusNote} maxLength={1000} onChange={event => setStatusNote(event.target.value)} /></div>
          <p className="next-hint">{nextStatus ? `Luồng hợp lệ: ${responseStatuses[current.status]} → ${responseStatuses[nextStatus]}` : "Không còn bước chuyển trạng thái tiếp theo."}</p>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("response-detail")}>Hủy thao tác</Button><Button primary disabled={busy || !nextStatus} onClick={() => void run(() => api(`responses/${current.id}`, "PATCH", { status: nextStatus, note: statusNote }), "Đã cập nhật trạng thái.", "response-detail").then(saved => { if (saved) setStatusNote(""); })}>Xác nhận</Button>
            </div>
      </Page>;
    }
    if (screen === "response-edit" && !["new", "processing"].includes(current.status)) return <Page section="Response" title="Không thể cập nhật Response" go={go}>{feedback}<FigmaState error title="Response không còn được phép chỉnh sửa" description="Chỉ sửa Response Mới hoặc Đang xử lý. Nội dung đã lưu được giữ nguyên." actions={<Button onClick={() => go("response-detail")}>Về chi tiết Response</Button>} /></Page>;
    if (screen === "response-edit")
      return (
        <Page section="Response" title="Cập nhật Response" className="next-figma-form next-response-edit-page" description={`RSP-${current.id} · ${current.customer_name} · Nhận ${new Date(current.received_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).replace(",", "")} · Trạng thái ${responseStatuses[current.status]}`} go={go}>
          {feedback}
          <section className="next-card next-response-edit-info"><h2>Thông tin khách hàng</h2>
            <div className="next-field"><label htmlFor="response-edit-customer">Khách hàng *</label><select id="response-edit-customer" required disabled={busy} value={name} onChange={event => setName(event.target.value)}>{[...new Set([current.customer_name, ...customers.map(item => item.full_name || item.company || "Contact")])].map(customer => <option key={customer} value={customer}>{customer}</option>)}</select></div>
            <div className="next-grid"><Field disabled={busy} label="Email" value={email} set={setEmail} type="email" /><Field disabled={busy} label="Số điện thoại" value={phone} set={setPhone} type="tel" /></div>
            <p className="next-hint">Mã Response, thời điểm nhận và loại phản hồi do hệ thống quản lý; không chỉnh sửa tại đây. Chỉ cập nhật khi trạng thái Mới hoặc Đang xử lý.</p>
          </section>
          <section className="next-response-edit-content">
            <Field disabled={busy}
              label="Nội dung phản hồi"
              value={body}
              set={setBody}
              rows={3}
              required
            />
          </section>
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
        <Page section="Response" title="Soạn phản hồi" description={`RSP-${current.id} · ${current.customer_name}`} className="next-figma-form next-reply-page" go={go}>
          {feedback}
          <section className="next-card next-summary next-reply-card">
            <h2>Soạn phản hồi · RSP-{current.id}{current.contact_id ? ` · KH-${current.contact_id}` : ""}</h2>
            <div className="next-reply-grid">
              <label className="next-field">Kênh gửi *
                <select value={replyChannel} onChange={event => setReplyChannel(event.target.value as "email" | "sms")}>
                  <option value="email" disabled={!current.email}>Email</option><option value="sms">SMS</option>
                </select>
              </label>
              <div className="next-field"><label htmlFor="reply-recipient">Người nhận *</label><input id="reply-recipient" readOnly aria-required="true" value={replyChannel === "email" ? current.email : current.phone || ""} /></div>
              <label className="next-field">Mẫu phản hồi
                <select defaultValue="" onChange={event => {
                  const template = templates.find(item => item.id === event.target.value);
                  if (template) setBody(template.body);
                }}>
                  <option value="">Soạn nội dung mới</option>
                  {templates.filter(item => !/\[\[|\{\{/.test(item.body)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <Field disabled={busy} label="Nội dung phản hồi" value={body} set={setBody} rows={1} required />
            </div>
            <p className="next-hint">{replyChannel === "email" ? "Có thể chọn mẫu hoặc nhập nội dung mới. Mã Response, mã khách hàng, thời gian và người gửi được lưu tự động." : "SMS cần gửi ngoài hệ thống. Thao tác này chỉ ghi nhận nội dung vào lịch sử."}</p>
          </section>
            <div className="next-actions-bar"><Button disabled={busy} onClick={() => go("response-detail")}>Hủy</Button>
              <Button
                disabled={busy || (replyChannel === "email" && !current.email)}
                primary
                onClick={() =>
                  void run(
                    () => replyChannel === "email"
                      ? api(`responses/${current.id}/reply`, "POST", { content: body })
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
    const responseTime = (value?: string) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).replace(",", "") : "—";
    const receivedTime = responseTime(current.received_at);
    return (
      <Page section="Response" title="Chi tiết Response" description={`RSP-${current.id} · ${current.customer_name}`} className="next-response-detail-page" go={go}>
        {feedback}
        <section className="next-card next-response-detail"><h2>RSP-{current.id} · {current.customer_name}{current.contact_id ? ` · KH-${current.contact_id}` : ""}</h2>
          <div className="next-response-fields">
            <div><span>Loại phản hồi</span><strong>{kinds[current.kind]}</strong></div>
            <div><span>Trạng thái</span><strong>{responseStatuses[current.status]}</strong></div>
            <div><span>Phụ trách</span><strong>{current.assignee_id}</strong></div>
            <div><span>Thời gian nhận</span><strong>{receivedTime}</strong></div>
            <div><span>Email</span><strong>{current.email || "—"}</strong></div>
            <div><span>Số điện thoại</span><strong>{current.phone || "—"}</strong></div>
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
            ["Phản hồi đã gửi", current.interactions?.at(-1) ? responseTime(current.interactions.at(-1)?.created_at) : "Chưa có phản hồi gửi đi", <Button key="reply-history" onClick={() => go("response-history")}>Xem lịch sử</Button>],
            ["Lịch sử trạng thái", `${responseTime(current.status_history?.at(-1)?.changed_at || current.received_at)} · ${responseStatuses[current.status]}`, <Button key="status-history" onClick={() => go("response-status-history")}>Xem lịch sử</Button>],
            ["Lịch Follow-up", current.followups?.at(-1) ? `${responseTime(current.followups.at(-1)?.due_at)} · ${{ pending: "Chờ thực hiện", done: "Đã thực hiện", cancelled: "Hủy" }[current.followups.at(-1)!.status] || current.followups.at(-1)!.status}` : "Chưa có lịch Follow-up", <Button key="followup-history" onClick={() => go("followup-list")}>Xem lịch sử</Button>],
          ]} />
        </section>
          <div className="next-actions-bar">
            {["spam", "unsubscribe"].includes(current.kind) && (
              <Button disabled={busy} onClick={() => go("response-hide")}>Ẩn Response</Button>
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
                go(current.kind === "unsubscribe" ? "followup-optout" : "followup-list");
              }}
            >
              Xem lịch Follow-up
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
        <Page section="Follow-up" title="Quản lý lịch Follow-up" crumbLabel="Quản lý lịch Follow-up" className="next-followup-list-page" go={go}>
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
            <Button disabled={!followups.length} onClick={() => { if (followup) choose(followup.id, "followup-delete"); }}>Xóa lịch Follow-up</Button>
            <Button primary onClick={() => go("followup-create")}>Xem hồ sơ / Lập lịch</Button>
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
        <Page section="Follow-up" title="Tạo lịch Follow-up" description={responses.find(item => item.id === selected) ? `${responses.find(item => item.id === selected)?.customer_name} · Response RSP-${selected}` : "Chọn Response để thiết lập lịch chăm sóc."} className="next-figma-form" go={go}>
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
              label="Mốc thời gian" error={followupErrors.due}
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
                label="Thời gian chờ phản hồi (ngày)" error={followupErrors.waitDays}
                value={waitDays}
                set={setWaitDays}
                type="number"
              />
              <Field disabled={busy}
                label="Số lần Follow-up tối đa" error={followupErrors.maxAttempts}
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
              Để trống mốc thời gian để hẹn sau 2 ngày làm việc. Thời gian chờ, số lần tối đa và khoảng cách phải là số nguyên dương.
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
                  ).then(item => { if (item) { setCreatedFollowup({ ...item, customer_name: item.customer_name || responses.find(response => response.id === String(item.response_id))?.customer_name || "—" }); go("followup-success", { key: "followupId", id: item.id }); } });
                }}
              >
                Thêm Follow-up
              </Button>

            </div>
        </Page>
      );
    }
    if (screen === "followup-success") {
      const saved = createdFollowup || followup;
      return <Page section="Follow-up" title="Lập lịch Follow-up" description="Xác nhận kết quả lưu" go={go}>
        {feedback}<div className="next-state success"><div><span>ĐÃ LƯU LỊCH FOLLOW-UP</span><h2>{saved ? `Đã thêm lịch Follow-up FU-${saved.id}` : "Lịch Follow-up đã lưu"}</h2>
          <p>{saved ? `Khách hàng ${saved.customer_name || "—"} · Response RSP-${saved.response_id} · Kênh ${saved.channel === "phone" ? "Gọi điện" : saved.channel.toUpperCase()}.` : "Xem danh sách để kiểm tra lịch đã lưu."}</p>
          {saved && <small>Hẹn {date(saved.due_at)} · Nhắc trước {saved.reminder_minutes} phút · Tối đa {saved.max_attempts} lần · Trạng thái: {saved.status === "pending" ? "Chờ thực hiện" : "Đã thực hiện"}.</small>}
        </div><div className="next-state-actions"><Button primary onClick={() => { setCreatedFollowup(null); go("followup-create"); }}>Tạo lịch khác</Button><Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button></div></div>
      </Page>;
    }
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
    const followupUpdatedAt = followup && (["responded", "no_response"].includes(followup.outcome || "") ? followup.resolved_at : followup.completed_at || followup.created_at);
    if (screen === "followup-result" && followup)
      return <Page section="Follow-up" title="Kết quả Follow-up" description={`${followup.customer_name} · Response RSP-${followup.response_id}`} className="next-followup-result-page" go={go}>
        {feedback}
        <section className="next-card next-summary next-followup-summary">
          <h2>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"} · {followup.customer_name} · RSP-{followup.response_id}</h2>
          <div className="next-result-grid">
            <div><span>Trạng thái</span><strong>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"}</strong></div>
            <div><span>Lịch hẹn</span><strong>{date(followup.due_at)}</strong></div>
            <div><span>Hình thức</span><strong>{followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()}</strong></div>
            <div><span>Lần Follow-up</span><strong>{followup.attempt} / {followup.max_attempts}</strong></div>
            <div><span>Cập nhật lúc</span><strong>{followupUpdatedAt ? date(followupUpdatedAt) : "-"}</strong></div>
            <div><span>Nguồn cập nhật</span><strong>{["responded", "no_response"].includes(followup.outcome || "") ? "Hệ thống" : followup.assignee_id}</strong></div>
            <div className="wide"><span>Nội dung / Mục tiêu</span><strong>{followup.goal}</strong></div>
          </div>
        </section>
        <Card title="Lịch sử Follow-up" className="next-followup-history"><Table heads={["Thời điểm", "Trạng thái mới", "Người thực hiện"]} rows={[
          [date(followup.created_at), "Chờ thực hiện", followup.assignee_id || "—"],
          ...(followup.completed_at ? [[date(followup.completed_at), "Đang chờ phản hồi", followup.assignee_id]] : []),
          ...(["responded", "no_response"].includes(followup.outcome || "") ? [[followup.resolved_at ? date(followup.resolved_at) : "-", followup.outcome === "responded" ? "Có phản hồi" : "Không phản hồi", "Hệ thống"]] : []),
        ]} /></Card>
        <div className="next-actions-bar">
          {followup.status === "pending" && <Button onClick={() => { if (followup) choose(followup.id, "followup-delete"); }}>Xóa lịch Follow-up</Button>}
          <div className="next-delete-other-actions">
          <Button primary onClick={() => { setDecisionNote(followup.note || ""); go("followup-note"); }}>Bổ sung ghi chú</Button>
          {followup.status === "pending" && <Button onClick={() => go("followup-detail")}>Ghi nhận kết quả</Button>}
          <Button onClick={() => go("followup-list")}>Về danh sách</Button>
          </div>
        </div>
      </Page>;
    if (screen === "followup-note" && followup)
      return <Page section="Follow-up" title="Ghi chú kết quả" description={`${followup.customer_name} · Kết quả hiện tại: ${followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"}`} className="next-figma-form" go={go}>
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
    if (screen === "followup-delete" && followup && followup.status !== "pending") return <Page section="Follow-up" title="Không thể xóa lịch Follow-up" go={go}>{feedback}<FigmaState error title="Lịch Follow-up không được phép xóa" description="Chỉ lịch Chờ thực hiện được phép xóa. Kết quả và lịch sử được giữ nguyên." actions={<Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button>} /></Page>;
    if (screen === "followup-delete" && followup)
      return <Page section="Follow-up" title="Xác nhận xóa lịch" description={`${followup.customer_name} · RSP-${followup.response_id}`} go={go}>
        {feedback}
        <div className="next-compact-confirmation">
          <section><span>XÁC NHẬN XÓA LỊCH</span><h2>Xóa lịch Follow-up của {followup.customer_name}?</h2>
            <p>RSP-{followup.response_id} · {followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()} · {date(followup.due_at)} · {followup.status === "pending" ? "Chờ thực hiện" : "Đã xử lý"}.</p>
            <p>Lịch được xóa khỏi danh sách làm việc. Dữ liệu và lịch sử vẫn được giữ lại.</p>
          </section>
          <div className="next-confirmation-actions"><Button primary disabled={busy || followup.status !== "pending"} onClick={() => void run(() => api(`followups/${followup.id}`, "DELETE"), "Đã xóa lịch Follow-up.", "followup-list")}>Xác nhận xóa</Button><Button disabled={busy} onClick={() => go("followup-list")}>Hủy</Button></div>
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
                        "Xóa lịch Follow-up",
                        "Lịch đang chờ sẽ được xóa khỏi danh sách và giữ lại trong lịch sử.",
                        () =>
                          void run(
                            () => api(`followups/${followup.id}`, "DELETE"),
                            "Đã xóa lịch; lịch sử vẫn được giữ.",
                            "followup-list",
                          ),
                      );
                    }}
                  >
                    Xóa lịch Follow-up
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
      return <Page section="Tài khoản gửi" title="Kiểm tra tài khoản gửi email" description="Kiểm tra địa chỉ email dùng gửi thư cho khách hàng, kết nối dịch vụ và hạn mức gửi." crumbLabel="Kiểm tra tình trạng" className="manager-account-check" go={go} backTo="manager-account-check">
        {feedback}
        <section className="mgr-panel"><h2>Tài khoản đã cấu hình</h2>
          <div className="next-table-wrap"><table className="next-table"><thead><tr><th>Email người gửi</th><th>Trạng thái</th><th>Giới hạn ngày</th><th>Đã gửi</th><th>Còn lại</th></tr></thead><tbody>
            {senders.length ? senders.map(item => <tr key={item.id} className={active?.id === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}>
              <td><button type="button" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.email}</button></td>
              <td>{item.status === "active" ? "Hoạt động" : item.status === "blocked" ? "Bị khóa" : "Ngừng hoạt động"}</td>
              <td>{n(item.quota_daily)}</td><td>{n(item.used_today)}</td><td>{n(Math.max(0, item.quota_daily - item.used_today))}</td>
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
      const quota = checked?.quota_daily ?? 0;
      const used = checked?.used_today ?? 0;
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
              ["Giới hạn ngày / Đã gửi / Còn lại", `${n(quota)} / ${n(used)} / ${n(remaining)}`],
              ...(result.connected ? [["Cảnh báo", nearQuota ? `Gần ngưỡng · Đã sử dụng ${percent}% giới hạn trong ngày.` : "Không có cảnh báo hạn mức."]] : []),
              ["Thông báo", "Kiểm tra tình trạng tài khoản gửi email hoàn tất."],
            ]} />
            <p className="mgr-callout">{result.connected
              ? `Hạn mức còn lại là ${n(remaining)} email.${quota > 0 ? ` Tài khoản đã dùng ${percent}% giới hạn trong ngày.` : ""}`
              : `Kiểm tra không làm thay đổi trạng thái ${status} của tài khoản.`}</p>
          </> : <p role="status">Chọn tài khoản và kiểm tra tình trạng để xem kết quả.</p>}
        </section>
        <div className="mgr-actions"><button type="button" onClick={() => go("manager-account-check")}>Quay lại</button><button className="mgr-primary" type="button" onClick={() => go("manager-account-switch")}>Thêm hoặc đổi tài khoản</button></div>
      </Page>;
    }
    const senderStatus = (value: string) => value === "active" ? "Hoạt động" : value === "blocked" ? "Bị khóa" : "Ngừng hoạt động";
    const senderDay = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
    const backFromSender = () => {
      if (typeof history.state?.previousScreen === "string") history.back();
      else go("manager-account-list");
    };
    const openAddSender = () => {
      setSenderErrors({}); setError(""); setNotice("");
      setSenderForm({ name: "", code: "", email: "", quotaDaily: "", quotaHourly: "", smtpHost: "smtp.gmail.com", smtpPort: "465", smtpUser: "", smtpPassword: "", status: "inactive", inboundEnabled: false });
      go("manager-account-add");
    };
    if (manager && screen === "manager-account-switch") return <Page section="Tài khoản gửi" title="Tài khoản gửi" description="Email của V5 dùng để gửi thư cho đối tác và khách hàng tiềm năng." crumbLabel="Danh sách tài khoản" backTo="manager-account-check" className="manager-account-switch" go={go}>
      {feedback}
      <Card title="Danh sách tài khoản">
        <Table heads={["Tên tài khoản", "Mã", "Địa chỉ email người gửi", "Trạng thái"]}
          rowKeys={senders.map(item => item.id)} selectedRow={senders.findIndex(item => item.id === selected)} onSelect={index => setSelected(senders[index].id)}
          rows={senders.map(item => [item.name, item.code || `TK-${item.id}`, item.email, senderStatus(item.status)])} />
        <p className="mgr-callout">Thêm hoặc cập nhật email của V5 dùng gửi thư cho đối tác, khách hàng tiềm năng.</p>
      </Card>
      <div className="next-actions-bar">
        <Button disabled={busy || !senders.some(item => item.id === selected)} onClick={() => choose(selected, "manager-account-edit")}>Cập nhật tài khoản</Button>
        <Button onClick={() => { if (history.state?.previousScreen?.startsWith("manager-account-result")) history.back(); else go("manager-account-check"); }}>Quay lại</Button>
        <Button primary onClick={openAddSender}>Thêm tài khoản gửi mới</Button>
      </div>
    </Page>;
    if (screen === "manager-account-home") return <Page section="Tài khoản gửi" title="Tài khoản gửi" className="thao-sender-home" go={go}>
      <div className="thao-sender-menu">
        <button onClick={() => go("manager-account-list")}>Xem tài khoản gửi</button>
        <button onClick={openAddSender}>Thêm tài khoản gửi</button>
        <button onClick={() => go("manager-account-update-list")}>Cập nhật tài khoản gửi</button>
        <button onClick={() => go("manager-account-delete-list")}>Xóa tài khoản gửi</button>
      </div>
    </Page>;
    if (manager && ["manager-account-list", "manager-account-update-list", "manager-account-delete-list", "manager-account-added", "manager-account-updated", "manager-account-deleted", "manager-account-saved"].includes(screen)) {
      const mode = screen === "manager-account-update-list" ? "edit" : screen === "manager-account-delete-list" ? "delete" : "view";
      const saved = ["manager-account-added", "manager-account-updated", "manager-account-saved"].includes(screen);
      return <Page section="Tài khoản gửi" title={saved ? "Đã lưu tài khoản gửi email" : "Tài khoản gửi"} description={saved ? "Danh sách đã được tải lại" : "Danh sách tài khoản gửi trong phạm vi quyền được cấp."} crumbLabel={saved ? "Danh sách tài khoản" : mode === "edit" ? "Cập nhật tài khoản gửi" : mode === "delete" || screen === "manager-account-deleted" ? "Xóa tài khoản gửi" : "Xem tài khoản gửi"} backTo="manager-account-home" className={"thao-sender-list" + (saved ? " thao-sender-saved" : "")} go={go}>
        {feedback}
        {!saved && <div className="thao-sender-list-toolbar"><Button primary onClick={openAddSender}>Thêm tài khoản gửi</Button></div>}
        <Card title={saved ? "Lưu thông tin tài khoản thành công" : undefined}>
          <Table heads={["Tên tài khoản", "Mã tài khoản", "Email", "Giới hạn/ngày", "Giới hạn/giờ", "Trạng thái", "Ngày tạo", "Cập nhật gần nhất"]}
            rowKeys={senders.map(item => item.id)} selectedRow={senders.findIndex(item => item.id === selected)} onSelect={index => { setSenderDetail(null); setSenderDetailError(""); choose(senders[index].id, mode === "edit" ? "manager-account-edit" : mode === "delete" ? "manager-account-delete" : "manager-account-detail"); }}
            rows={senders.map(item => [item.name, item.code || `TK-${item.id}`, item.email, n(item.quota_daily), n(item.quota_hourly), <span key={item.id} className={item.status !== "active" ? "thao-status-paused" : ""}>{senderStatus(item.status)}</span>, senderDay(item.created_at), senderDay(item.updated_at)])} />
          {saved && screen !== "manager-account-added" && <p className="mgr-callout thao-saved-message" role="status">Thông tin tài khoản{senderDetail ? ` ${senderDetail.name}` : " gửi"} đã được lưu thành công.</p>}
        </Card>
        <div className="next-actions-bar">{saved ? <Button primary onClick={() => go("manager-account-list")}>Về danh sách</Button> : <Button onClick={backFromSender}>Quay lại</Button>}</div>
        {screen === "manager-account-added" && createPortal(<Notification key={screen} className="thao-sender-success"><strong>Đã thêm tài khoản gửi</strong><span>Thông tin tài khoản{senderDetail ? ` ${senderDetail.name}` : " gửi"} đã được lưu thành công.</span></Notification>, document.body)}
        {screen === "manager-account-deleted" && <Notification key={screen} className="thao-sender-success"><strong>Đã xóa tài khoản gửi</strong><span>Tài khoản gửi đã được xóa thành công.</span></Notification>}
      </Page>;
    }
    if (manager && ["manager-account-add", "manager-account-edit"].includes(screen)) {
      const editing = screen === "manager-account-edit";
      const account = senders.find(item => item.id === senderEditId);
      if (editing && !account) return <Page section="Tài khoản gửi" title="Cập nhật tài khoản gửi" go={go}><Card>Không tìm thấy tài khoản gửi.</Card><Button onClick={() => go("manager-account-update-list")}>Quay lại danh sách</Button></Page>;
      const input = (key: "name" | "code" | "email" | "quotaDaily" | "quotaHourly", label: string, placeholder: string, type = "text") => <Field disabled={busy} label={label} type={type} value={senderForm[key]} set={value => { setSenderErrors(current => ({ ...current, [key]: "" })); setSenderForm(current => ({ ...current, [key]: value })); }} error={senderErrors[key]} placeholder={placeholder} />;
      return <Page section="Tài khoản gửi" title={editing ? "Cập nhật tài khoản gửi" : "Thêm tài khoản gửi"} description={editing ? "Chỉnh sửa thông tin của tài khoản gửi đã chọn." : "Nhập thông tin để bổ sung tài khoản gửi."} crumbLabel={editing ? "Cập nhật tài khoản gửi" : "Thêm tài khoản gửi"} backTo="manager-account-home" className={"thao-sender-form" + (editing ? " thao-sender-edit" : "")} go={go}>
        {feedback}
        <Card><form noValidate onSubmit={event => {
          event.preventDefault();
          const errors = senderProfileValidation({ name: senderForm.name, ...(editing ? {} : { code: senderForm.code }), email: senderForm.email, quotaDaily: senderForm.quotaDaily, quotaHourly: senderForm.quotaHourly });
          setSenderErrors(errors); if (Object.keys(errors).length) return;
          void run(async () => {
            const saved = await api<Sender>(`sender-accounts${editing ? `/${senderEditId}` : ""}`, editing ? "PATCH" : "POST", { name: senderForm.name.trim(), ...(editing ? {} : { code: senderForm.code }), email: senderForm.email.trim(), quotaDaily: Number(senderForm.quotaDaily), quotaHourly: Number(senderForm.quotaHourly) });
            setSelected(saved.id); setSenders(items => items.some(item => item.id === saved.id) ? items.map(item => item.id === saved.id ? saved : item) : [...items, saved]); setSenderDetail(saved); return saved;
          }, "", editing ? "manager-account-updated" : "manager-account-added");
        }}>
          <p className="thao-form-note">{editing ? `Mã tài khoản: ${account?.code || `TK-${account?.id}`}       Trạng thái: ${senderStatus(account?.status || "inactive")}` : "Các thông tin bắt buộc theo thiết kế dữ liệu của hệ thống."}</p>
          <div className="thao-form-grid">
            {input("name", "Tên tài khoản gửi", "Nhập tên tài khoản")}
            {editing ? input("email", "Email", "name@example.com", "email") : input("code", "Mã tài khoản gửi", "Theo định dạng hệ thống")}
            {editing ? input("quotaDaily", "Giới hạn gửi mỗi ngày", "Số lớn hơn 0", "number") : input("email", "Email", "name@example.com", "email")}
            {editing ? input("quotaHourly", "Giới hạn gửi mỗi giờ", "Lớn hơn 0, không vượt giới hạn/ngày", "number") : input("quotaDaily", "Giới hạn gửi mỗi ngày", "Số lớn hơn 0", "number")}
            {!editing && input("quotaHourly", "Giới hạn gửi mỗi giờ", "Lớn hơn 0, không vượt giới hạn/ngày", "number")}
          </div>
          {editing && <p className="thao-form-update-note">Mã và trạng thái hiển thị theo thông tin hiện tại</p>}
          <div className="thao-form-actions"><Button disabled={busy} onClick={backFromSender}>Hủy</Button><button type="submit" className="next-button primary" disabled={busy}>{editing ? "Lưu thay đổi" : "Thêm tài khoản gửi"}</button></div>
        </form></Card>
      </Page>;
    }
    if (manager && screen === "manager-account-delete") return <Page section="Tài khoản gửi" title="Xóa tài khoản gửi" crumbLabel="Xóa tài khoản gửi" className="thao-sender-delete-page" backTo="manager-account-home" go={go}>
      <section className="thao-sender-delete" role="dialog" aria-modal="false" aria-labelledby="sender-delete-title">
        <h2 id="sender-delete-title">Xóa tài khoản gửi</h2><p>Bạn có chắc chắn muốn xóa tài khoản gửi này?</p>
        {sender && <dl className="next-details"><dt>Tên tài khoản</dt><dd>{sender.name}</dd><dt>Mã tài khoản</dt><dd>{sender.code}</dd><dt>Email</dt><dd>{sender.email}</dd><dt>Trạng thái</dt><dd>{senderStatus(sender.status)}</dd></dl>}
        <p className="thao-delete-note">Hệ thống sẽ kiểm tra tài khoản, quyền thực hiện và các điều kiện/ràng buộc liên quan.</p>
        {error && <p className="next-error" role="alert">{error}</p>}
        <div className="thao-delete-actions"><Button disabled={busy} onClick={() => go("manager-account-delete-list")}>Hủy</Button><Button primary disabled={busy || !sender} onClick={() => void run(async () => { await api(`sender-accounts/${sender?.id}`, "DELETE"); setSenders(items => items.filter(item => item.id !== sender?.id)); setSenderDetail(null); }, "", "manager-account-deleted")}>Xóa tài khoản</Button></div>
      </section>
    </Page>;
    if (manager && screen === "manager-account-connection" && sender) return <Page section="Tài khoản gửi" title="Kết nối tài khoản gửi" description={sender.email} backTo="manager-account-detail" go={go}>
      {feedback}{googleConnection(sender)}
      <Card title="Cấu hình kết nối"><form onSubmit={event => {
        event.preventDefault(); void run(() => api(`sender-accounts/${sender.id}`, "PATCH", { status: senderForm.status, inboundEnabled: senderForm.inboundEnabled, ...(!sender.google_status ? { smtpHost: senderForm.smtpHost, smtpPort: Number(senderForm.smtpPort), smtpUser: senderForm.smtpUser, ...(senderForm.smtpPassword ? { smtpPassword: senderForm.smtpPassword } : {}) } : {}) }), "Đã lưu cấu hình kết nối.", "manager-account-detail");
      }}>
        {!sender.google_status && <div className="next-grid"><Field label="Máy chủ SMTP" value={senderForm.smtpHost} set={value => setSenderForm(current => ({...current,smtpHost:value}))} /><Field label="Cổng SMTP" type="number" value={senderForm.smtpPort} set={value => setSenderForm(current => ({...current,smtpPort:value}))} /><Field label="Tên đăng nhập SMTP" value={senderForm.smtpUser} set={value => setSenderForm(current => ({...current,smtpUser:value}))} /><Field label="Mật khẩu ứng dụng Gmail" type="password" value={senderForm.smtpPassword} set={value => setSenderForm(current => ({...current,smtpPassword:value}))} /></div>}
        <label className="next-field">Trạng thái<select value={senderForm.status} onChange={event => setSenderForm(current => ({...current,status:event.target.value}))}><option value="inactive">Ngừng hoạt động</option><option value="active">Hoạt động</option><option value="blocked">Bị khóa</option></select></label>
        <label className="next-choice"><input type="checkbox" checked={senderForm.inboundEnabled} onChange={event => setSenderForm(current => ({...current,inboundEnabled:event.target.checked}))} />Đồng bộ thư đến qua Gmail IMAP</label>
        <div className="next-actions-bar"><Button onClick={() => go("manager-account-detail")}>Hủy</Button><button type="submit" disabled={busy} className="next-button primary">Lưu cấu hình</button></div>
      </form></Card>
    </Page>;
    if (screen === "sender-list") return (<Page
          section="Tài khoản gửi"
          title="Tài khoản gửi"
          go={go}
        >
          {feedback}
          {!loading && !senders.length ? <FigmaState title="Chưa có tài khoản gửi" description="Thêm tài khoản gửi để cấu hình email của phòng Marketing." /> : <Card title="Danh sách tài khoản">
            <Table
              heads={["Tên tài khoản", "Mã", "Địa chỉ email người gửi", "Hạn mức ngày", "Trạng thái"]}
              selectedRow={Math.max(0, senders.findIndex(item => item.id === selected))}
              onSelect={index => manager ? setSelected(senders[index].id) : choose(senders[index].id, "sender-detail")}
              rows={senders.map(item => [
                manager ? item.name : <button className="next-text-link" key={item.id} type="button" onClick={() => choose(item.id, "sender-detail")}>{item.name}</button>,
                item.code || `TK-${item.id}`,
                item.email,
                `${n(item.used_today)} / ${n(item.quota_daily)}`,
                item.status === "active" ? "Hoạt động" : item.status === "blocked" ? "Bị khóa" : "Ngừng hoạt động",
              ])}
            />
            <p className="mgr-callout">Thêm hoặc cập nhật email của V5 dùng gửi thư cho đối tác, khách hàng tiềm năng.</p>
          </Card>}

</Page>);
    const currentSender = senderDetail?.id === selected ? senderDetail : sender;
    return (
      <Page section="Tài khoản gửi" title="Chi tiết tài khoản gửi" description="Thông tin tài khoản được chọn." className={"next-sender-detail-page" + (manager ? " thao-sender-detail" : "")} crumbLabel={manager ? "Xem tài khoản gửi" : undefined} go={go} backTo={manager ? "manager-account-list" : "sender-list"}>
        {feedback}
        {currentSender ? <Card><dl className="next-sender-detail-grid">{[
          ["Tên tài khoản gửi", currentSender.name], ["Mã tài khoản gửi", currentSender.code || `TK-${currentSender.id}`],
          ["Email", currentSender.email], [manager ? "Giới hạn gửi mỗi ngày" : "Hạn mức trong ngày", n(currentSender.quota_daily)],
          [manager ? "Giới hạn gửi mỗi giờ" : "Đã gửi trong ngày", n(manager ? currentSender.quota_hourly : currentSender.used_today)], ["Trạng thái", senderStatus(currentSender.status)],
          ["Ngày tạo tài khoản", manager ? senderDay(currentSender.created_at) : date(currentSender.created_at)], ["Cập nhật gần nhất", manager ? senderDay(currentSender.updated_at) : date(currentSender.updated_at)],
        ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Card> : <Card>Chưa có tài khoản gửi.</Card>}
        {senderDetailError && <Dialog title="Không tải được tài khoản gửi" onClose={() => { setSenderDetailError(""); go("manager-account-list"); }} onConfirm={() => setReload(value => value+1)} confirmLabel="Thử lại" cancelLabel="Quay lại"><p>Đã xảy ra lỗi truy xuất dữ liệu. Vui lòng thử lại sau.</p></Dialog>}
        <div className={manager ? "thao-detail-actions" : "next-actions-bar"}><Button onClick={manager ? backFromSender : () => go("sender-list")}>Quay lại danh sách</Button>{manager && <details className="next-connection-settings"><summary>Kết nối và kiểm tra tài khoản</summary><div className="next-actions-bar"><Button onClick={() => go("manager-account-connection")}>Kết nối Gmail / SMTP</Button><Button onClick={() => go("manager-account-check")}>Kiểm tra tình trạng</Button></div></details>}</div>
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
