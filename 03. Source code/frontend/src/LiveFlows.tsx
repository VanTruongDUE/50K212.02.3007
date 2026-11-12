import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, idNumber } from "./api";
import { createContactExport, type ExportFormat } from "./exportContacts";
import { CampaignInfo, Dialog, PreviewBody, Stepper } from "./NextFlows";
import "./flow.css";
import "./nextFlows.css";
import "./managerFlows.css";

type Props = { screen: string; go: (screen: string) => void; manager: boolean };
type Contact = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
};
type ContactList = {
  id: string;
  name: string;
  contact_count: number;
  employee_review: string;
  confirmed_at: string | null;
  manager_review: string;
  manager_comment: string | null;
  contacts?: Contact[];
};
type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  subject?: string | null;
  body?: string | null;
  sender_account_id?: string | null;
  scheduled_at?: string | null;
  send_mode?: "scheduled" | "now";
  created_at?: string | null;
  lists?: { id: string; name: string }[];
  recipients?: (Contact & { status: string })[];
};
type Sender = {
  id: string;
  name: string;
  email: string;
  status: string;
  quota_3_days: number;
  used_3_days: number;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  configured: boolean;
  inbound_enabled: boolean;
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
  }[];
  email_deliveries?: {
    id: string;
    state: string;
    subject: string;
    created_at: string;
  }[];
  status_history?: {
    actor_id: string;
    from_status: string;
    to_status: string;
    changed_at: string;
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
  attempt: number;
  note: string | null;
  channel: string;
  goal: string;
  reminder_minutes: number;
  wait_days: number;
  max_attempts: number;
  interval_days: number;
  overdue?: boolean;
  created_at?: string;
  completed_at?: string | null;
};
type Template = { id: string; name: string; subject: string; body: string };
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
  "Kiểm tra danh sách Contact": "Rà soát danh sách và lưu kết quả kiểm tra.",
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
  "Sửa tài khoản gửi": "Cập nhật cấu hình và hạn mức của tài khoản gửi.",
  "Chi tiết tài khoản": "Thông tin cấu hình, trạng thái và hạn mức gửi của tài khoản đang chọn.",
};

function Page({
  section,
  title,
  go,
  backTo,
  description: descriptionOverride,
  children,
}: {
  section: string;
  title: string;
  go: Props["go"];
  backTo?: string;
  description?: string;
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
  const description =
    descriptionOverride ?? pageDescriptions[title] ??
    (section === "Chiến dịch"
      ? pageDescriptions["Chi tiết chiến dịch"]
      : pageDescriptions[section]) ??
    "Chọn chức năng để bắt đầu làm việc.";
  return (
    <section className={"next-page" + (["Quản lý Response", "Quản lý lịch Follow-up"].includes(title) ? " next-list-page" : "")}>
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
            <span>{title}</span>
          </>
        )}
      </nav>
      <div className="next-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="next-card">
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
      className={"next-button" + (primary ? " primary" : "")}
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
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const id = label.replace(/\s/g, "-");
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
          onChange={(e) => set(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => set(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
function Table({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  return (
    <div className="next-table-wrap">
      <table className="next-table">
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
              <tr key={i}>
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

export default function LiveFlows({ screen, go, manager }: Props) {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [createdFollowup, setCreatedFollowup] = useState<Followup | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filters, setFilters] = useState<FilterTemplate[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<
    ContactList | Campaign | ResponseItem | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
    danger: boolean;
  } | null>(null);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [showHideResponse, setShowHideResponse] = useState(false);
  const [hideResponseId, setHideResponseId] = useState("");
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [senderId, setSenderId] = useState("");
  const [replyChannel, setReplyChannel] = useState<"email" | "sms">("email");
  const [senderCheckResult, setSenderCheckResult] = useState<{ id: string; connected: boolean; message: string } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "phone">("desktop");
  const editorBodyRef = useRef<HTMLTextAreaElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [assets, setAssets] = useState<
    { id: string; kind: string; file_name: string }[]
  >([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
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
    email: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "465",
    smtpUser: "",
    smtpPassword: "",
    status: "inactive",
    quota3Days: "100",
    inboundEnabled: false,
  });
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
  const list = lists.find((item) => item.id === selected) ??
    (manager && screen.startsWith("manager-review")
      ? lists.find(item => item.manager_review === "pending" && item.confirmed_at)
      : undefined) ?? lists[0];
  const campaign =
    campaigns.find((item) => item.id === selected) ?? campaigns[0];
  const responseItem =
    responses.find((item) => item.id === selected) ?? responses[0];
  const followup =
    followups.find((item) => item.id === selected) ?? followups[0];
  const sender = senders.find((item) => item.id === selected) ?? senders[0];
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
        setError("");
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
        if (group === "senders") setSenders(values[0] as Sender[]);
        if (group === "campaigns") {
          setCampaigns(values[0] as Campaign[]);
          setLists(values[1] as ContactList[]);
          setSenders(values[2] as Sender[]);
          setTemplates(values[3] as Template[]);
        }
        if (group === "responses") {
          setResponses(values[0] as ResponseItem[]);
          setCampaigns(values[1] as Campaign[]);
          setSenders(values[2] as Sender[]);
        }
        if (group === "followups") {
          setFollowups(values[0] as Followup[]);
          setResponses(values[1] as ResponseItem[]);
        }
        if (group === "filters") {
          const loaded = values[0] as FilterTemplate[];
          setFilters(loaded);
          if (new URLSearchParams(location.search).get("screen") === "template-edit" && loaded[0]) {
            setSelected(loaded[0].id);
            setName(loaded[0].name);
            setCriteria(loaded[0].criteria);
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
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
      !/detail|check|confirm|review|preview|history|edit|filtered|resume|status|export|all-contacts/.test(screen)
    )
      return;
    let active = true;
    api<ContactList | Campaign | ResponseItem>(`${detailResource}/${detailId}`)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [screen, group, detailResource, detailId, reload]);
  useEffect(() => {
    if (
      !assetCampaignId ||
      !["campaign-editor", "campaign-preview", "campaign-confirm"].includes(screen)
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
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [screen, assetCampaignId, reload]);
  useEffect(() => {
    if (screen !== "campaign-preview" || !assetCampaignId) return;
    let active = true;
    api<{ subject: string; body: string }>(`campaigns/${assetCampaignId}/preview`, "POST", {})
      .then(result => { if (active) setPreviewResult(result); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Không tạo được bản xem trước."); });
    return () => { active = false; };
  }, [screen, assetCampaignId]);
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
      setReload((x) => x + 1);
      if (next) go(next);
      return result;
    } catch (e) {
      const failure = e instanceof Error ? e : new Error("Không thể hoàn tất thao tác. Vui lòng thử lại.");
      setError(failure.message);
      onError?.(failure);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const choose = (id: string, next: string) => {
    setSelected(id);
    if (next.startsWith("campaign-")) { setSchedule(null); setSendMode(null); setScheduleCalculated(null); }
    setError("");
    setNotice("");
    go(next);
  };
  const insertEditorText = (before: string, after = "") => {
    const input = editorBodyRef.current;
    const start = input?.selectionStart ?? body.length;
    const end = input?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + before + body.slice(start, end) + after + body.slice(end));
    setPreviewResult(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + before.length, end + before.length);
    });
  };
  const ask = (title: string, message: string, action: () => void, danger = true) =>
    setConfirmAction({ title, message, action, danger });
  const openCampaignEdit = (item: Campaign) => {
    setEditCampaign({ id: item.id, name: item.name, description: item.description || "" });
    setEditCampaignError("");
  };
  async function uploadAsset(file: File, campaignId: string) {
    if (
      !["application/pdf", "image/png", "image/jpeg", "image/svg+xml"].includes(
        file.type,
      )
    ) {
      setError("Chỉ hỗ trợ logo PNG/JPG/SVG hoặc tệp PDF.");
      return;
    }
    const form = new FormData();
    form.append("kind", file.type === "application/pdf" ? "pdf" : "logo");
    form.append("file", file);
    const saved = await run(async () => {
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
      return response.json();
    }, "Đã tải tệp lên chiến dịch.");
    if (saved) setPreviewResult(null);
  }
  const feedback = (
    <>
      {loading && (
        <p role="status" className="next-card">
          Đang tải dữ liệu…
        </p>
      )}
      {error && (
        <p role="alert" className="next-error">
          {error}
        </p>
      )}
      {notice && (
        <div role="status" className="mgr-toast">
          <strong>Thành công</strong>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Đóng
          </button>
        </div>
      )}
      {confirmAction && (
        <Dialog
          title={confirmAction.title}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction.action;
            setConfirmAction(null);
            action();
          }}
          confirmLabel="Xác nhận"
          danger={confirmAction.danger}
        >
          <p>{confirmAction.message}</p>
        </Dialog>
      )}
    </>
  );

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
              : "Google Search chưa được kết nối. Khi được cấu hình, kết quả sẽ được kiểm tra và lưu thành danh sách Contact trước khi duyệt."}
          </p>
          {screen !== "history" && <Button disabled>Tìm kiếm</Button>}
        </Card>
      </Page>
    );

  if (screen.startsWith("template") || screen === "templates") {
    const active = filters.find((item) => item.id === selected) ?? filters[0];
    const edit = screen === "template-edit";
    return screen === "templates" ? (
      <Page section="Tìm kiếm Contact" title="Filter Template" go={go}>
        {feedback}
        <section className="flow-panel">
          {filters.length ? <>
            <table className="flow-table">
              <thead><tr><th>Template</th><th>Chức vụ Contact</th><th>Từ khóa</th><th>Khu vực</th><th>Quy mô doanh nghiệp</th></tr></thead>
              <tbody>{filters.map((item) => <tr key={item.id} className={active?.id === item.id ? "selected-row" : ""}>
                <td><button className="table-select" type="button" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.name}</button></td>
                <td>{item.criteria.role.join(", ") || "—"}</td>
                <td>{item.criteria.keyword || "—"}</td>
                <td>{item.criteria.location.join(", ") || "—"}</td>
                <td>{item.criteria.size.join(", ") || "—"}</td>
              </tr>)}</tbody>
            </table>
            <p className="panel-footnote">Đang chọn: {active.name}</p>
          </> : <p>Chưa có Filter Template. Tạo Template để lưu bộ tiêu chí tìm kiếm.</p>}
        </section>
        <div className="flow-actions"><div>
          <Button disabled={!active} onClick={() => { if (!active) return; setSelected(active.id); setCriteria(active.criteria); setName(active.name); go("template-edit"); }}>Cập nhật Template</Button>
          <Button onClick={() => { setName(""); setCriteria(emptyCriteria); go("template-create"); }}>Tạo Template</Button>
        </div><div><Button primary disabled={!active} onClick={() => { if (!active) return; sessionStorage.setItem("v5-applied-filter", JSON.stringify(active.criteria)); go("criteria"); }}>Xem / áp dụng tiêu chí</Button></div></div>
      </Page>
    ) : (
      <Page section="Tìm kiếm Contact" title={edit ? "Cập nhật Filter Template" : "Tạo Filter Template"} go={go}>
        {feedback}
        <form onSubmit={(event) => {
          event.preventDefault();
          void run(() => api(`filter-templates${edit && selected ? `/${selected}` : ""}`, edit ? "PATCH" : "POST", { name, criteria }), "Đã lưu mẫu tiêu chí.", "templates");
        }}>
          <section className="flow-panel template-editor">
            <Field label="Tên Filter Template" value={name} set={setName} required />
            <div className="editor-grid">
              {(["role", "industry", "location", "keyword", "size", "email"] as const).map((key) => <Field
                key={key}
                label={{ role: "Chức vụ Contact", industry: "Ngành nghề / lĩnh vực", location: "Địa điểm / khu vực", keyword: "Từ khóa doanh nghiệp", size: "Quy mô doanh nghiệp", email: "Trạng thái email" }[key]}
                value={key === "keyword" ? criteria.keyword : criteria[key].join(", ")}
                set={(value) => setCriteria({ ...criteria, [key]: key === "keyword" ? value : value.split(",").map((part) => part.trim()).filter(Boolean) })}
              />)}
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
          section={manager ? "Kiểm tra danh sách Contact" : "Danh sách Contact"}
          title={manager ? "Kiểm tra danh sách Contact" : "Danh sách Contact"}
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
      return <Page section="Kiểm tra danh sách Contact" title="Kiểm tra danh sách Contact" go={go}>
        {feedback}
        <Card title={pending.length ? "Danh sách chờ kiểm tra" : "Không có yêu cầu nào"}>
          <Table heads={["Danh sách", "Nhân viên kiểm tra", "Thời điểm gửi", "Contact"]}
            rows={pending.map(item => [
              <button key={item.id} type="button" className="next-followup-select" aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}>{item.name}</button>,
              item.employee_review === "passed" ? "Đạt" : "Chưa đạt",
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
      const invalid = contacts.filter(item => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)).length;
      const seen = new Set<string>();
      const duplicates = contacts.filter(item => { const email = item.email.toLowerCase(); if (seen.has(email)) return true; seen.add(email); return false; }).length;
      const valid = Math.max(0, contacts.length - invalid - duplicates);
      if (screen === "manager-review-all-contacts")
        return <Page section="Kiểm tra danh sách Contact" title="Toàn bộ danh sách Contact" go={go}>
          {feedback}
          <Card title={current.name}>
            <p>{n(current.contact_count)} Contact ban đầu · {n(valid)} hợp lệ · {n(invalid)} email không hợp lệ · {n(duplicates)} email trùng</p>
            <Table heads={["Họ tên", "Địa chỉ email", "Chức vụ", "Doanh nghiệp", "Kết quả lọc"]} rows={contacts.map(item => [item.full_name || "—", item.email, item.job_title || "—", item.company || "—", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) ? "Email không hợp lệ" : "Kiểm tra"])}/>
          </Card>
          <div className="next-actions-bar"><Button onClick={() => go("manager-review-detail")}>Quay lại kiểm tra</Button></div>
        </Page>;
      if (screen === "manager-review-reject")
        return <Page section="Kiểm tra danh sách Contact" title="Nhận xét danh sách" go={go}>
          {feedback}
          <Card title="Lý do không đạt"><dl className="next-details"><dt>Danh sách đã kiểm tra</dt><dd>{current.name}</dd><dt>Contact</dt><dd>{n(current.contact_count)}</dd></dl>
            <Field label="Nhận xét của trưởng phòng" value={decisionNote} set={setDecisionNote} rows={5} required />
            <p className="next-hint">Nhận xét này đi cùng kết quả gửi cho nhân viên tạo danh sách.</p>
          </Card>
          <div className="next-actions-bar"><Button onClick={() => go("manager-review-detail")}>Hủy</Button><Button primary disabled={busy || !decisionNote.trim()} onClick={() => void run(() => api(`contact-lists/${current.id}/approval`, "POST", { decision: "rejected", comment: decisionNote }), "Đã trả danh sách kèm nhận xét.", "manager-review-rejected")}>Xác nhận không đạt</Button></div>
        </Page>;
      if (screen === "manager-review-approved" || screen === "manager-review-rejected")
        return <Page section="Kiểm tra danh sách Contact" title="Kết quả kiểm tra danh sách" go={go}>
          {feedback}
          <Card title={screen.endsWith("approved") ? "Đã duyệt" : "Danh sách không đạt"}>
            <dl className="next-details"><dt>Danh sách</dt><dd>{current.name}</dd><dt>Trạng thái</dt><dd>{screen.endsWith("approved") ? "Đã duyệt" : "Không đạt"}</dd><dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd>{!screen.endsWith("approved") && <><dt>Nhận xét</dt><dd>{current.manager_comment || decisionNote}</dd></>}</dl>
            <p className="mgr-callout">Nhân viên tạo danh sách có thể xem kết quả kiểm tra.</p>
          </Card>
          <div className="next-actions-bar"><Button primary onClick={() => go("manager-review")}>Về danh sách</Button></div>
        </Page>;
      if (screen === "manager-review-detail")
        return <Page section="Kiểm tra danh sách Contact" title="Chi tiết danh sách Contact" go={go}>
          {feedback}
          <Card title="Kết quả lọc người nhận">
            <div className="mgr-stats">{[["Contact ban đầu", n(current.contact_count)], ["Email không hợp lệ", n(invalid)], ["Email trùng", n(duplicates)], ["Người nhận hợp lệ", n(valid)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <div className="mgr-list-heading"><h2>Người nhận hợp lệ</h2><button type="button" onClick={() => go("manager-review-all-contacts")}>Xem toàn bộ danh sách</button></div>
            <Table heads={["Họ tên", "Địa chỉ email", "Chức vụ", "Doanh nghiệp"]} rows={contacts.filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)).slice(0, 5).map(item => [item.full_name || "—", item.email, item.job_title || "—", item.company || "—"])} />
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
        {feedback}<Card title={current.name}><p>Hiển thị {current.contacts?.length ? (contactPage - 1) * 10 + 1 : 0}–{Math.min(contactPage * 10, current.contacts?.length || 0)} trong {n(current.contact_count)} Contact · Trang {contactPage}/{Math.max(1, Math.ceil((current.contacts?.length || 0) / 10))}</p>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice((contactPage - 1) * 10, contactPage * 10).map(c => [c.full_name || "—", c.email, c.job_title || "—", c.company || "—"])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go(contactReturnScreen)}>Quay lại</Button><Button disabled={contactPage <= 1} onClick={() => setContactPage(p => p - 1)}>Trang trước</Button><Button primary disabled={contactPage >= Math.ceil((current.contacts?.length || 0) / 10)} onClick={() => setContactPage(p => p + 1)}>Trang tiếp</Button></div>
      </Page>;
      if (screen === "check" || screen === "check-rejected") return <Page section="Danh sách Contact" title="Kiểm tra danh sách Contact" go={go}>
        {feedback}<Card title={current.name}>
          <p>{n(current.contact_count)} Contact · Rà soát chức danh, ngành nghề, quy mô, vị trí và chất lượng email.</p>
          <div className="mgr-list-heading"><h2>Danh sách cần kiểm tra</h2><button type="button" onClick={() => showAll(screen)}>Xem toàn bộ Contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", c.email, c.job_title || "—", c.company || "—"])} />
          <p className="next-hint">Email: định dạng · tên miền · khả năng sử dụng từ nguồn · trùng lặp. Lưu kết quả kiểm tra chưa tự xác nhận danh sách.</p>
        </Card>
        <div className="next-actions-bar"><Button disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "failed" }), "Đã ghi kết quả không đạt.", "check-rejected")}>Lưu: Chưa đạt yêu cầu</Button><Button primary disabled={busy || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/review`, "PATCH", { result: "passed" }), "Đã ghi kết quả đạt.", "confirm")}>Lưu: Đạt yêu cầu</Button></div>
      </Page>;
      if (screen === "confirm") return <Page section="Danh sách Contact" title="Xác nhận danh sách Contact" go={go}>
        {feedback}<Card title={current.name}>
          <p>Kết quả kiểm tra: {current.employee_review === "passed" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"} · Trạng thái xác nhận: {current.confirmed_at ? "Đã xác nhận" : "Chưa xác nhận"}</p>
          <div className="mgr-list-heading"><h2>Contact trong danh sách</h2><button type="button" onClick={() => showAll("confirm")}>Xem toàn bộ Contact</button></div>
          <Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", c.email, c.job_title || "—", c.company || "—"])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("check")}>Quay lại</Button><Button primary disabled={busy || current.employee_review !== "passed" || !!current.confirmed_at} onClick={() => void run(() => api(`contact-lists/${current.id}/confirm`, "POST"), "Đã xác nhận danh sách và gửi Trưởng phòng duyệt.", "confirmed")}>Xác nhận danh sách</Button></div>
      </Page>;
      if (screen === "confirmed") return <Page section="Danh sách Contact" title="Danh sách đã xác nhận" go={go}>
        {feedback}<Card title={current.name}><p>{n(current.contact_count)} Contact · Trưởng phòng: {current.manager_review === "approved" ? "Đã duyệt" : current.manager_review === "rejected" ? "Không đạt" : "Chờ duyệt"}</p><div className="mgr-list-heading"><h2>Contact trong danh sách</h2><button type="button" onClick={() => showAll("confirmed")}>Xem toàn bộ Contact</button></div><Table heads={["Contact", "Email", "Chức vụ", "Doanh nghiệp"]} rows={(current.contacts || []).slice(0, 5).map(c => [c.full_name || "—", c.email, c.job_title || "—", c.company || "—"])} /></Card>
        <div className="next-actions-bar"><Button primary onClick={() => go("export")}>Xuất danh sách</Button></div>
      </Page>;
      if (screen === "export" || screen === "export-success") return <Page section="Danh sách Contact" title={screen === "export" ? "Xuất danh sách Contact" : "Xuất danh sách thành công"} go={go}>
         {feedback}<section className="flow-panel export-panel"><h2>Danh sách: {current.name} · {n(current.contact_count)} Contact</h2><p>Chọn định dạng tệp</p>
           <div className="format-grid">{(["CSV", "XLSX", "JSON", "XML"] as const).map(format => <label key={format} className={exportFormat === format ? "selected-format" : ""}><input type="radio" name="export-format" checked={exportFormat === format} onChange={() => setExportFormat(format)} />{format} (.{format.toLowerCase()})</label>)}</div>
           <p>Giữ nguyên giá trị đang lưu; trường thiếu dữ liệu được giữ trống.</p>
         </section>
         <div className="next-actions-bar"><Button onClick={() => go("confirmed")}>Quay lại danh sách</Button><Button primary disabled={busy || !exportFormat || !current.contacts?.length} onClick={() => void run(async () => {
           if (!exportFormat) return;
           const blob = await createContactExport(exportFormat, current.contacts!.map(c => ({ name: c.full_name || "", email: c.email, role: c.job_title || "", company: c.company || "" })));
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = `contact-list-${current.id}.${exportFormat.toLowerCase()}`; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
         }, "Đã xuất danh sách Contact.", "export-success")}>{exportFormat ? `Xuất ${exportFormat}` : "Xuất tệp"}</Button></div>
      </Page>;
    }
    return (
      <Page
        section={manager ? "Kiểm tra danh sách Contact" : "Danh sách Contact"}
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
                  c.email,
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
                      <Field
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
    const openCampaignEmail = (item: Campaign) => { setSelected(item.id); setSubject(item.subject || ""); setBody(item.body || ""); setPreviewResult(null); go("campaign-editor"); };
    const campaignEditDialog = editCampaign && <Dialog title="Thông tin chung" onClose={() => setEditCampaign(null)} cancelLabel="Hủy" confirmLabel="Lưu" onConfirm={() => {
      if (!editCampaign.name.trim() || editCampaign.name.length > 100 || !editCampaign.description.trim()) {
        setEditCampaignError("Nhập tên và mô tả chiến dịch trước khi lưu."); return;
      }
      void run<Campaign>(() => api(`campaigns/${editCampaign.id}`, "PATCH", { name: editCampaign.name, description: editCampaign.description }), "Đã cập nhật thông tin chiến dịch.", undefined, failure => setEditCampaignError(failure.message))
        .then(saved => { if (saved) { setCampaigns(items => items.map(item => item.id === saved.id ? { ...item, ...saved } : item)); setEditCampaign(null); } });
    }}>
      <label className="next-field">Tên chiến dịch (bắt buộc)<input value={editCampaign.name} onChange={event => setEditCampaign({ ...editCampaign, name: event.target.value })} maxLength={100} /></label>
      <p className="next-hint">Tối đa 100 ký tự.</p>
      <label className="next-field">Mô tả (bắt buộc)<textarea value={editCampaign.description} onChange={event => setEditCampaign({ ...editCampaign, description: event.target.value })} rows={4} /></label>
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
              <button onClick={() => choose(item.id, "campaign-detail")}>Xem</button>
              {item.status === "approved" && <button onClick={() => choose(item.id, !item.subject ? "campaign-email" : !item.sender_account_id ? "campaign-sender" : !item.scheduled_at ? "campaign-schedule" : "campaign-confirm")}>Mở</button>}
              {["approved", "scheduled", "paused"].includes(item.status) && <button onClick={() => openCampaignEdit(item)}>Chỉnh sửa</button>}
              {item.status === "paused" && <button onClick={() => openCampaignEmail(item)}>Sửa email</button>}
              {item.status === "paused" && <button onClick={() => choose(item.id, "campaign-resume")}>Tiếp tục gửi</button>}
              {["scheduled", "sending"].includes(item.status) && <button onClick={() => { setSelected(item.id); ask("Tạm dừng chiến dịch", `Tạm dừng “${item.name}”?`, () => void run(() => api(`campaigns/${item.id}/pause`, "POST"), "Đã tạm dừng chiến dịch.")); }}>Tạm dừng</button>}
              {item.sent_count === 0 && <button className="danger-link" onClick={() => { setSelected(item.id); ask("Xóa chiến dịch", `Chiến dịch “${item.name}” đã xóa sẽ không thể khôi phục.`, () => void run(() => api(`campaigns/${item.id}`, "DELETE"), "Đã xóa chiến dịch.")); }}>Xóa chiến dịch</button>}
            </div></td>
          </tr>) : <tr><td colSpan={5}>Chưa có chiến dịch. Tạo chiến dịch mới để bắt đầu.</td></tr>}</tbody></table></div>
          {campaignEditDialog}
        </Page>
      );
    if (screen === "campaign-contacts")
      return (
        <Page section="Chiến dịch" title="Tạo chiến dịch mới" go={go}>
          {feedback}
          <Stepper current={1} />
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
              setSchedule(null); setSendMode(null); setScheduleCalculated(null);
              return created;
            }, "Đã lọc danh sách người nhận.", "campaign-filtered");
          }}>
            <div className="next-grid">
              <Card title="Thông tin chiến dịch">
                <Field label="Tên chiến dịch" value={name} set={setName} required />
                <p className="next-hint">Tối đa 100 ký tự.</p>
                <Field label="Mô tả" value={description} set={setDescription} rows={4} />
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
      ? { ...campaign, ...d, recipient_count: campaign.recipient_count }
      : campaign;
    if (!current)
      return (
        <Page section="Chiến dịch" title="Chi tiết chiến dịch" go={go}>
          {feedback}
          <Card>Chưa có chiến dịch.</Card>
        </Page>
      );
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
          <Stepper current={1} />
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
              <div><strong>{n(filteredOriginalCount || lists.filter(item => current.lists?.some(selected => selected.id === item.id)).reduce((sum, item) => sum + item.contact_count, 0))}</strong><span>Tổng số contact ban đầu</span></div>
              <div><strong>{n(Math.max(0, (filteredOriginalCount || lists.filter(item => current.lists?.some(selected => selected.id === item.id)).reduce((sum, item) => sum + item.contact_count, 0)) - current.recipient_count))}</strong><span>Số contact bị loại hoặc trùng</span></div>
              <div><strong>{n(current.recipient_count)}</strong><span>Số contact hợp lệ</span></div>
            </div>
          </Card>
          <div className="next-actions-bar">
            <Button disabled={busy} onClick={() => void run(async () => {
              await api(`campaigns/${current.id}`, "DELETE");
              setSelected("");
              return true;
            }, "Đã bỏ bản nháp để chọn lại danh sách.", "campaign-contacts")}>Chọn lại</Button>
            <Button primary onClick={() => go("campaign-pending")}>Xác nhận danh sách người nhận</Button>
          </div>
        </Page>
      );
    if (screen === "campaign-pending")
      return <Page section="Chiến dịch" title={current.name} go={go}>
        {feedback}
        <Stepper current={1} />
        <div className="next-notice" role="status"><div><strong>Danh sách người nhận đã sẵn sàng</strong><span>Danh sách Contact đã được Trưởng phòng duyệt. Tiếp tục chọn hoặc soạn mẫu email.</span></div></div>
        <section className="next-card next-pending-card"><h2>Chiến dịch</h2><dl className="next-details"><dt>Tên chiến dịch</dt><dd>{current.name}</dd><dt>Trạng thái</dt><dd>Đang chuẩn bị</dd><dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd></dl></section>
        <div className="next-actions-bar"><Button primary onClick={() => go("campaign-email")}>Tiếp tục soạn email</Button></div>
      </Page>;
    if (screen === "campaign-layouts")
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          <Stepper current={2} />
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
          <Stepper current={2} />
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-toolbar compact"><Button onClick={() => go("campaign-layouts")}>＋ Soạn email mới</Button></div>
          <Card title="Thư viện mẫu email">
            <Table
              heads={["Tên mẫu", "Danh mục", "Ngày cập nhật", "Thao tác"]}
              rows={templates.map((item) => [
                item.name,
                "Mẫu đã lưu",
                "—",
                <Button
                  key={item.id}
                  onClick={() => {
                    const namedOnly = ["[Demo] Giới thiệu sản phẩm", "[Demo] Bản tin định kỳ"].includes(item.name);
                    setSubject(namedOnly ? "" : item.subject);
                    setBody(namedOnly ? "" : item.body);
                    go("campaign-editor");
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
        <Page section="Chiến dịch" title={current.name} go={go}>
          {feedback}
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <div className="next-editor-layout">
            <section className="next-card next-editor-main">
              <h2>Trình soạn thảo</h2>
              <div className="next-field"><label htmlFor="campaign-subject">Tiêu đề email *</label>
                <input id="campaign-subject" value={subject} maxLength={150} onChange={event => { setSubject(event.target.value); setPreviewResult(null); }} required /></div>
              <p className="next-hint">Tối đa 150 ký tự.</p>
              <div className="next-editor-toolbar" role="toolbar" aria-label="Định dạng nội dung">
                <button type="button" onClick={() => insertEditorText("**", "**")}>Đậm</button>
                <button type="button" onClick={() => insertEditorText("_", "_")}>Nghiêng</button>
                <button type="button" onClick={() => insertEditorText("~", "~")}>Gạch chân</button>
                <button type="button" onClick={() => insertEditorText("\n• ")}>Danh sách</button>
                <button type="button" onClick={() => insertEditorText("https://")}>Liên kết</button>
              </div>
              <div className="next-email-canvas layout-1">
                <span className="next-logo-chip">{assets.find(item => item.kind === "logo")?.file_name || "Logo V5"}</span>
                <label htmlFor="campaign-body" className="sr-only">Nội dung email</label>
                <textarea id="campaign-body" ref={editorBodyRef} value={body} rows={8} onChange={event => { setBody(event.target.value); setPreviewResult(null); }} placeholder="Nhập nội dung email" />
                <div className="next-unsubscribe">Liên kết từ chối nhận email (tự động, không xóa được)</div>
              </div>
            </section>
            <aside className="next-editor-aside">
              <Card title="Khối kéo thả">
                <Button onClick={() => insertEditorText("\n")}>Văn bản</Button>
                <Button onClick={() => insertEditorText("[[Hình ảnh]]")}>Hình ảnh</Button>
                <Button onClick={() => insertEditorText("[[Nút]]")}>Nút</Button>
                <Button onClick={() => insertEditorText("[[Đường phân cách]]")}>Đường phân cách</Button>
              </Card>
              <Card title="Chèn">
                <Button onClick={() => insertEditorText("{{Họ tên}}")}>Chèn biến cá nhân hóa</Button>
                <label className="next-button next-file-button">Tải ảnh logo lên
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
                <label className="next-button next-file-button">Đính kèm brochure PDF
                  <input type="file" accept="application/pdf" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, current.id); event.target.value = ""; }} /></label>
              </Card>
              <Card title="Tệp đính kèm">
                {assets.length ? assets.map(item => <div key={item.id} className="next-inline"><span>{item.file_name}</span><Button disabled={busy} onClick={() => void run(() => api(`campaigns/${current.id}/assets/${item.id}`, "DELETE"), "Đã xóa tệp.").then(deleted => { if (deleted) setPreviewResult(null); })}>Xóa</Button></div>) : <p>Chưa có tệp đính kèm</p>}
              </Card>
            </aside>
          </div>
          <p className="next-hint">Nội dung {previewResult ? "đã được xem trước" : "chưa được xem trước sau lần chỉnh sửa cuối"}.</p>
          <div className="next-actions-bar">
            <Button onClick={() => go(current.status === "paused" ? "campaign-resume" : "campaign-email")}>Hủy</Button>
            <Button disabled={busy || !subject.trim() || !body.trim()} onClick={() => {
              setPreviewResult(null);
              update("content", "PATCH", { subject, body }, "Đã lưu nội dung email.", "campaign-preview");
            }}>Xem trước</Button>
            <Button primary disabled={busy || !previewResult} onClick={() => go(current.status === "paused" ? "campaign-resume" : "campaign-sender")}>Lưu nội dung</Button>
          </div>
          <Card title="Lưu thành mẫu email">
            <Field label="Tên mẫu" value={templateName} set={setTemplateName} />
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
                    }),
                  "Đã lưu mẫu email.",
                )
              }
            >
              Lưu mẫu
            </Button>
          </Card>
        </Page>
      );
    if (screen === "campaign-preview")
      return (
        <Page section="Chiến dịch" title="Xem trước email" go={go}>
          {feedback}
          <div className="next-preview-controls">
            <div className="next-inline" role="group" aria-label="Kiểu hiển thị">
              <Button primary={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Máy tính</Button>
              <Button primary={previewDevice === "phone"} onClick={() => setPreviewDevice("phone")}>Điện thoại</Button>
            </div>
            <p>Contact dùng để xem trước: contact đầu tiên trong danh sách người nhận.</p>
          </div>
          <section className="next-preview-stage">
            <div className={"next-card next-mail " + (previewDevice === "phone" ? "phone" : "")}>
              {previewResult ? <>
                <h2>Tiêu đề: {previewResult.subject}</h2>
                <span className="next-logo-chip">{assets.find(item => item.kind === "logo")?.file_name || "Logo V5"}</span>
                <div className="next-mail-body" style={{ whiteSpace: "pre-wrap" }}><PreviewBody value={previewResult.body} /></div>
                {assets.filter(item => item.kind === "pdf").map(item => <small key={item.id}>{item.file_name}</small>)}
                <a href="#unsubscribe" onClick={event => event.preventDefault()}>Từ chối nhận email</a>
              </> : <p>Đang tạo bản xem trước theo dữ liệu Contact đầu tiên...</p>}
            </div>
          </section>
          <div className="next-actions-bar">
            <Button primary disabled={!previewResult} onClick={() => go("campaign-editor")}>Đóng xem trước</Button>
          </div>
        </Page>
      );
    if (screen === "campaign-sender")
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          {feedback}
          <Stepper current={3} />
          <CampaignInfo name={current.name} count={n(current.recipient_count)} />
          <Card title="Tài khoản gửi “Hoạt động”">
            <Table
              heads={["Chọn", "Địa chỉ email", "Tên hiển thị", "Giới hạn gửi trong 3 ngày", "Đã gửi", "Hạn mức còn lại"]}
              rows={senders
                .filter((item) => item.status === "active")
                .map((item) => [
                  <input
                    key={item.id}
                    type="radio"
                    name="sender"
                    aria-label={`Chọn ${item.name}`}
                    checked={senderId === item.id}
                    onChange={() => setSenderId(item.id)}
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
            <p><strong>Tên người gửi hiển thị</strong><br />{senders.find(item => item.id === senderId)?.name}</p>
            <p><strong>Địa chỉ email gửi</strong><br />{senders.find(item => item.id === senderId)?.email}</p>
          </Card>}
          {!senders.some(item => item.status === "active") && <p className="next-error" role="status">Không có tài khoản gửi đang hoạt động. Vui lòng liên hệ Trưởng phòng.</p>}
          {senderId && <div className="next-actions-bar">
            <Button primary disabled={busy || !senderId || (senders.find(item => item.id === senderId)?.quota_3_days ?? 0) - (senders.find(item => item.id === senderId)?.used_3_days ?? 0) < current.recipient_count}
              onClick={() => update("sender", "PATCH", { senderAccountId: idNumber(senderId) }, "Đã chọn tài khoản gửi.", "campaign-schedule")}>Xác nhận tài khoản</Button>
          </div>}
        </Page>
      );
    if (screen === "campaign-schedule") {
      const selectedMode = sendMode ?? current.send_mode ?? "scheduled";
      const scheduleValue = schedule ?? (current.scheduled_at ? new Date(new Date(current.scheduled_at).getTime() - new Date(current.scheduled_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      const calculated = scheduleCalculated ?? !!current.scheduled_at;
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          {feedback}
          <Stepper current={4} />
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
              <div className="next-field"><label htmlFor="campaign-send-time">Giờ bắt đầu</label>{selectedMode === "now" ? <input id="campaign-send-time" value="--:--" readOnly /> : <input id="campaign-send-time" type="time" value={scheduleValue.slice(11, 16)} onChange={event => { setSchedule((scheduleValue.slice(0, 10) || new Date().toISOString().slice(0, 10)) + "T" + event.target.value); setScheduleCalculated(false); }} />}<small>HH:mm</small></div>
            </div>
            <div className="next-grid next-three">
              <div className="next-field"><label htmlFor="campaign-speed">Tốc độ gửi (email/giờ)</label><input id="campaign-speed" value="50" readOnly /><small>Mặc định 50 email/giờ.</small></div>
              <div className="next-field"><label htmlFor="campaign-from">Khung giờ gửi - từ</label><input id="campaign-from" value="08:00" readOnly /><small>Mặc định 08:00</small></div>
              <div className="next-field"><label htmlFor="campaign-to">Khung giờ gửi - đến</label><input id="campaign-to" value="17:00" readOnly /><small>Mặc định 17:00</small></div>
            </div>
            {calculated && <p className="next-rule"><strong>Lịch dự kiến</strong><span>{selectedMode === "now" ? "Bắt đầu ngay sau khi xác nhận, kể cả ngoài khung giờ hẹn." : `Bắt đầu ${date(scheduleValue)}.`} Tốc độ tối đa 50 email/giờ.</span></p>}
          </Card>
          <div className="next-actions-bar">
            {selectedMode === "scheduled" && <Button primary disabled={!scheduleValue || busy} onClick={() => {
              const start = new Date(scheduleValue).getTime();
              if (!Number.isFinite(start) || start < Date.now() + 15 * 60_000 || start > Date.now() + 90 * 86_400_000) {
                setError("Chọn thời điểm bắt đầu từ 15 phút đến 90 ngày sau hiện tại."); return;
              }
              setError(""); setScheduleCalculated(true);
            }}>Tính lịch dự kiến</Button>}
            {calculated && <Button primary={selectedMode === "now"} disabled={busy} onClick={() => update("schedule", "PATCH", selectedMode === "now" ? { sendNow: true } : { scheduledAt: new Date(scheduleValue).toISOString() }, "Đã lưu lịch gửi.", "campaign-confirm")}>Lưu lịch gửi</Button>}
          </div>
        </Page>
      );
    }
    if (screen === "campaign-confirm")
      return (
        <Page section="Chiến dịch" title={current.name} go={go}>
          {feedback}
          <Stepper current={5} />
          <div className="next-grid next-confirm-grid">
            <Card title="Danh sách người nhận"><dl className="next-details">
              <dt>Tên danh sách</dt><dd>{current.lists?.map(item => item.name).join("; ") || lists.filter(item => selectedLists.includes(item.id)).map(item => item.name).join("; ") || "—"}</dd>
              <dt>Số contact hợp lệ</dt><dd>{n(current.recipient_count)}</dd>
              <dt>Người duyệt</dt><dd>Trưởng phòng Marketing</dd>
            </dl></Card>
            <Card title="Nội dung email"><dl className="next-details">
              <dt>Tiêu đề</dt><dd>{current.subject || subject || "—"}</dd>
              <dt>Ảnh thu nhỏ nội dung</dt><dd><div className="next-mail-thumb"><strong>{current.subject || subject}</strong><span>{(current.body || body || "").slice(0, 160)}</span></div></dd>
              <dt>Biến cá nhân hóa</dt><dd>{(current.body || body || "").match(/\{\{[^}]+\}\}/g)?.join(", ") || "—"}</dd>
              <dt>Tệp đính kèm</dt><dd>{assets.filter(item => item.kind === "pdf").map(item => item.file_name).join(", ") || "Không có"}</dd>
            </dl></Card>
            <Card title="Tài khoản gửi"><dl className="next-details">
              <dt>Địa chỉ email</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</dd>
              <dt>Tên người gửi</dt><dd>{senders.find(item => item.id === current.sender_account_id)?.name || "—"}</dd>
              <dt>Hạn mức còn lại</dt><dd>{n(Math.max(0, (senders.find(item => item.id === current.sender_account_id)?.quota_3_days || 0) - (senders.find(item => item.id === current.sender_account_id)?.used_3_days || 0)))}</dd>
            </dl></Card>
            <Card title="Lịch gửi"><dl className="next-details">
              <dt>Thời điểm bắt đầu</dt><dd>{current.send_mode === "now" ? "Ngay sau khi xác nhận" : date(current.scheduled_at)}</dd>
              <dt>Tốc độ gửi</dt><dd>50 email/giờ</dd>
              <dt>Khung giờ gửi</dt><dd>08:00–17:00</dd>
            </dl></Card>
          </div>
          <div className="next-actions-bar">
            <Button onClick={() => go("campaign-list")}>Quay lại</Button>
            <Button onClick={() => setShowConfirmEmail(true)}>Xem nội dung email</Button>
            <Button onClick={() => openCampaignEdit(current)}>Sửa thông tin chung</Button>
            <Button onClick={() => openCampaignEmail(current)}>Sửa email</Button>
            <Button primary disabled={busy || !current.subject || !current.sender_account_id || !current.scheduled_at} onClick={() => ask("Xác nhận chiến dịch", `Gửi ${n(current.recipient_count)} email từ ${senders.find(item => item.id === current.sender_account_id)?.email || "tài khoản đã chọn"}, bắt đầu ${current.send_mode === "now" ? "ngay sau khi xác nhận" : date(current.scheduled_at)}?`, () => update("confirm", "POST", undefined, current.send_mode === "now" ? "Đã xác nhận. Chiến dịch bắt đầu gửi ngay." : "Đã xác nhận và lên lịch chiến dịch.", "campaign-list"), false)}>{current.send_mode === "now" ? "Xác nhận gửi ngay" : "Xác nhận gửi"}</Button>
          </div>
          {showConfirmEmail && <Dialog title="Nội dung email" className="next-email-dialog" onClose={() => setShowConfirmEmail(false)}><div className="next-email-dialog-body"><strong>{current.subject || subject}</strong><div>{current.body || body}</div></div></Dialog>}
          {campaignEditDialog}
        </Page>
      );
    if (screen === "campaign-resume")
      return <Page section="Chiến dịch" title={current.name} go={go}>
        {feedback}
        <Card title="Tình trạng gửi"><dl className="next-details">
          <dt>Số email đã gửi</dt><dd>{n(current.sent_count)}</dd>
          <dt>Số contact “Chưa gửi”</dt><dd>{n(Math.max(0, current.recipient_count - current.sent_count))}</dd>
          <dt>Trạng thái</dt><dd>{campaignStatuses[current.status] || current.status}</dd>
        </dl></Card>
        <div className="next-grid next-confirm-grid">
          <Card title="Danh sách người nhận"><p>{current.lists?.map(item => item.name).join("; ") || "—"}</p></Card>
          <Card title="Nội dung email"><p>{current.subject || "—"}</p><div className="next-mail-thumb">{current.body || "—"}</div></Card>
          <Card title="Tài khoản gửi"><p>{senders.find(item => item.id === current.sender_account_id)?.email || "—"}</p></Card>
          <Card title="Lịch gửi"><p>Tiếp tục sau ít nhất 15 phút kể từ khi xác nhận.</p></Card>
        </div>
        <div className="next-actions-bar"><Button onClick={() => go("campaign-list")}>Để sau</Button><Button onClick={() => openCampaignEmail(current)}>Sửa email</Button><Button primary disabled={busy || current.status !== "paused"} onClick={() => ask("Tiếp tục gửi chiến dịch", `Tiếp tục gửi cho ${n(Math.max(0, current.recipient_count - current.sent_count))} contact chưa gửi?`, () => update("resume", "POST", undefined, "Đã tiếp tục chiến dịch.", "campaign-list"), false)}>Tiếp tục gửi</Button></div>
      </Page>;
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
          {current.recipients && (
            <Table
              heads={["Contact", "Email", "Trạng thái"]}
              rows={current.recipients.map((item) => [
                item.full_name || "—",
                item.email,
                item.status,
              ])}
            />
          )}
          <div className="next-actions-bar">
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
                onClick={() =>
                  update(
                    "pause",
                    "POST",
                    undefined,
                    "Đã tạm dừng chiến dịch.",
                    "campaign-list",
                  )
                }
              >
                Tạm dừng
              </Button>
            )}
            {current.status === "paused" && (
              <Button
                disabled={busy}
                onClick={() =>
                  update(
                    "resume",
                    "POST",
                    undefined,
                    "Đã tiếp tục chiến dịch.",
                    "campaign-list",
                  )
                }
              >
                Tiếp tục gửi
              </Button>
            )}
            {current.sent_count === 0 && (
              <Button
                disabled={busy}
                onClick={() => {
                  ask(
                    "Xóa chiến dịch",
                    "Chỉ xóa chiến dịch chưa gửi email nào.",
                    () =>
                      void run(
                        () => api(`campaigns/${current.id}`, "DELETE"),
                        "Đã xóa chiến dịch.",
                        "campaign-list",
                      ),
                  );
                }}
              >
                Xóa chiến dịch
              </Button>
            )}
          </div>
        </Card>
        {campaignEditDialog}
      </Page>
    );
  }

  if (group === "responses") {
    if (screen === "response-list" || screen === "response-hide")
      return (
        <Page section="Response" title="Quản lý Response" go={go}>
          {feedback}
          <Card title="Response do tôi phụ trách">
            {error && !responses.length ? <div className="next-scenario-empty centered"><strong>Không thể tải danh sách Response</strong><span>Kiểm tra kết nối rồi thử lại.</span><Button onClick={() => setReload(value => value + 1)}>Thử tải lại</Button></div> : !loading && !responses.length ? <div className="next-scenario-empty centered"><strong>Không tìm thấy Response phù hợp</strong><span>Chưa có Response trong phạm vi bạn phụ trách.</span></div> : <Table
              heads={[
                "Mã / Khách hàng",
                "Thời gian nhận",
                "Loại phản hồi",
                "Trạng thái",
                "Thao tác",
              ]}
              rows={responses.map((item) => [
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
            <Button primary onClick={() => { setName(""); setEmail(""); setPhone(""); setBody(""); go("response-add"); }}>Thêm Response</Button>
            <Button disabled={!responses.length} onClick={() => { setHideResponseId(responses[0]?.id || ""); setShowHideResponse(true); }}>Xóa Response</Button>
          </div>
          {(showHideResponse || screen === "response-hide") && <Dialog title="Xóa Response" onClose={() => { setShowHideResponse(false); if (screen === "response-hide") go("response-list"); }} onConfirm={() => {
            const targetId = hideResponseId || responses[0]?.id;
            if (!targetId) return;
            setShowHideResponse(false);
            if (screen === "response-hide") go("response-list");
            void run(() => api(`responses/${targetId}/hide`, "POST"), "Đã ẩn Response khỏi danh sách.");
          }} confirmLabel="Xóa Response" danger>
            <div className="next-field"><label htmlFor="hide-response">Response cần xóa</label>
              <select id="hide-response" value={hideResponseId || responses[0]?.id || ""} onChange={event => setHideResponseId(event.target.value)}>
                {responses.map(item => <option value={item.id} key={item.id}>RSP-{item.id} · {item.customer_name}</option>)}
              </select></div>
            <p>Chỉ ẩn được Response loại Rác hoặc Từ chối nhận email khi chưa có phản hồi và Follow-up.</p>
          </Dialog>}
        </Page>
      );
    if (screen === "response-add")
      return (
        <Page section="Response" title="Thêm Response" go={go}>
          {feedback}
          <Card title="Thông tin Response ngoại tuyến">
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
              <Field
                label="Khách hàng"
                value={name}
                set={setName}
                required
                placeholder="Chọn khách hàng"
              />
              <Field
                label="Email"
                value={email}
                set={setEmail}
                type="email"
                placeholder="Nhập email"
              />
              <Field label="Số điện thoại" value={phone} set={setPhone} type="tel" placeholder="Nhập số điện thoại" />
              <Field
                label="Nội dung phản hồi"
                value={body}
                set={setBody}
                rows={5}
                required
                placeholder="Nhập nội dung khách hàng phản hồi"
              />
              <p className="next-hint">Mã Response và thời gian nhận được hệ thống tự ghi khi lưu. Trạng thái ban đầu: Mới.</p>
              <div className="next-actions-bar">
                <Button onClick={() => go("response-list")}>Hủy</Button>
                <Button type="submit" primary disabled={busy}>
                  Lưu Response
                </Button>
              </div>
            </form>
          </Card>
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
    if (screen === "response-history")
      return <Page section="Response" title="Lịch sử phản hồi đã gửi" go={go}>
        {feedback}
        <Card title={`Phản hồi gửi đi · ${current.interactions?.length || 0} lượt`}>
          <Table heads={["Thời điểm gửi", "Kênh / Người gửi", "Người nhận", "Nội dung"]}
            rows={(current.interactions || []).map(item => [date(item.created_at), item.channel.toUpperCase(), current.email, item.content])} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status-history")
      return <Page section="Response" title="Lịch sử trạng thái Response" go={go}>
        {feedback}
        <Card title={`Lịch sử xử lý · ${(current.status_history?.length || 0) + 1} mốc`}>
          <Table heads={["Thời điểm", "Trạng thái mới", "Ghi chú"]}
            rows={[[date(current.received_at), responseStatuses[current.status_history?.[0]?.from_status || "new"] || "Mới", "Hệ thống tiếp nhận Response."], ...(current.status_history || []).map(item => [date(item.changed_at), responseStatuses[item.to_status] || item.to_status, `Nhân viên ${item.actor_id} cập nhật trạng thái.`])]} />
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("response-detail")}>Về chi tiết Response</Button></div>
      </Page>;
    if (screen === "response-status") {
      const nextStatus = { new: "processing", processing: "replied", replied: "closed" }[current.status];
      return <Page section="Response" title="Cập nhật trạng thái" go={go}>
        {feedback}
        <Card title={`Trạng thái xử lý · RSP-${current.id}`}>
          <dl className="next-details"><dt>Trạng thái hiện tại</dt><dd>{responseStatuses[current.status]}</dd></dl>
          <div className="next-field"><label htmlFor="new-response-status">Trạng thái mới</label><select id="new-response-status" value={nextStatus || ""} disabled><option value={nextStatus || ""}>{nextStatus ? responseStatuses[nextStatus] : "Không còn bước tiếp theo"}</option></select></div>
          <p className="next-hint">Chuyển trạng thái theo luồng xử lý hợp lệ.</p>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("response-detail")}>Hủy thao tác</Button><Button primary disabled={busy || !nextStatus} onClick={() => void run(() => api(`responses/${current.id}`, "PATCH", { status: nextStatus }), "Đã cập nhật trạng thái.", "response-detail")}>Xác nhận</Button></div>
      </Page>;
    }
    if (screen === "response-edit")
      return (
        <Page section="Response" title="Cập nhật Response" description={`RSP-${current.id} · ${current.customer_name} · Nhận ${date(current.received_at)} · Trạng thái ${responseStatuses[current.status]}`} go={go}>
          {feedback}
          <section className="next-card next-response-edit-info"><h2>Thông tin khách hàng</h2>
            <Field label="Khách hàng" value={name} set={setName} required />
            <div className="next-grid"><Field label="Email" value={email} set={setEmail} type="email" /><Field label="Số điện thoại" value={phone} set={setPhone} type="tel" /></div>
            <p className="next-hint">Mã Response, thời điểm nhận và loại phản hồi do hệ thống quản lý; không chỉnh sửa tại đây. Chỉ cập nhật khi trạng thái Mới hoặc Đang xử lý.</p>
          </section>
          <Card>
            <Field
              label="Nội dung phản hồi"
              value={body}
              set={setBody}
              rows={6}
              required
            />
          </Card>
            <div className="next-actions-bar next-response-edit-actions">
              <Button onClick={() => go("response-detail")}>Hủy</Button>
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
        <Page section="Response" title="Soạn phản hồi" go={go}>
          {feedback}
          <section className="next-card next-summary next-reply-card">
            <h2>Soạn phản hồi · RSP-{current.id}</h2>
            <div className="next-reply-grid">
              <label className="next-field">Kênh gửi *
                <select value={replyChannel} onChange={event => setReplyChannel(event.target.value as "email" | "sms")}>
                  <option value="email" disabled={!current.email}>Email</option><option value="sms">SMS</option>
                </select>
              </label>
              <div className="next-field"><span>Người nhận</span><p>{replyChannel === "email" ? current.email || "Response chưa có email" : current.phone || "Gửi SMS ngoài hệ thống trước khi ghi nhận"}</p></div>
              {replyChannel === "email" && <>
                <label className="next-field">Tài khoản gửi *
                  <select value={senderId} onChange={event => setSenderId(event.target.value)}>
                    <option value="">Chọn tài khoản gửi</option>
                    {senders.filter(item => item.status === "active" && item.configured).map(item => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}
                  </select>
                </label>
                <Field label="Tiêu đề email" value={subject} set={setSubject} required />
              </>}
            </div>
            <Field label="Nội dung phản hồi" value={body} set={setBody} rows={7} required />
            <p className="next-hint">{replyChannel === "email" ? "Email được gửi qua tài khoản SMTP đã cấu hình." : "SMS cần gửi ngoài hệ thống. Thao tác này chỉ ghi nhận nội dung vào lịch sử."}</p>
            <div className="next-actions-bar">
              <Button
                disabled={busy || !body.trim() || (replyChannel === "email" && (!current.email || !subject.trim() || !senderId))}
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
                {replyChannel === "email" ? "Gửi email" : "Ghi nhận SMS"}
              </Button>
            </div>
          </section>
        </Page>
      );
    return (
      <Page section="Response" title="Chi tiết Response" go={go}>
        {feedback}
        <section className="next-card next-response-detail"><h2>RSP-{current.id} · {current.customer_name}</h2>
          <div className="next-response-fields">
            <div><span>Loại phản hồi</span><strong>{kinds[current.kind]}</strong></div>
            <div><span>Trạng thái</span><strong>{responseStatuses[current.status]}</strong></div>
            <div><span>Phụ trách</span><strong>Nhân viên Marketing</strong></div>
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
            <Button
              onClick={() => {
                setReplyChannel(current.email ? "email" : "sms");
                setBody("");
                setSubject("");
                go("response-reply");
              }}
            >
              Phản hồi
            </Button>
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
            {["new", "processing", "replied"].includes(current.status) && (
              <Button
                disabled={busy}
                onClick={() => go("response-status")}
              >
                Cập nhật trạng thái
              </Button>
            )}
            <Button
              onClick={() => {
                setSelected(current.id);
                go("followup-create");
              }}
            >
              Tạo lịch Follow-up
            </Button>
            {["spam", "unsubscribe"].includes(current.kind) && (
              <Button
                disabled={busy}
                onClick={() => {
                  ask(
                    "Xóa Response",
                    "Response này sẽ không còn trong danh sách hiện hành.",
                    () =>
                      void run(
                        () => api(`responses/${current.id}/hide`, "POST"),
                        "Đã ẩn Response.",
                        "response-list",
                      ),
                  );
                }}
              >
                Xóa Response
              </Button>
            )}
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
          <div className="next-rule"><strong>Quy tắc thao tác</strong><span>Lịch mới tự xuất hiện trong công việc cá nhân. Chỉ lịch Chờ thực hiện được phép xóa.</span></div>
          <div className="next-actions-bar">
            <Button primary onClick={() => go("response-list")}>Xem hồ sơ / Lập lịch</Button>
            <Button disabled={!followups.length} onClick={() => go("followup-delete")}>Xóa lịch Follow-up</Button>
          </div>
        </Page>
      );
    if (screen === "followup-duplicate" || screen === "followup-optout")
      return <Page section="Follow-up" title="Lập lịch Follow-up" go={go}>
        <div className="next-state" role="alert"><div><span>{screen === "followup-duplicate" ? "LỊCH FOLLOW-UP ĐANG TỒN TẠI" : "EMAIL ĐÃ BỊ TỪ CHỐI"}</span><h2>{screen === "followup-duplicate" ? "Không thể tạo thêm lịch Follow-up" : "Không thể tạo Follow-up qua Email"}</h2><p>{error || (screen === "followup-duplicate" ? "Response này đã có lịch hẹn chờ thực hiện." : "Khách hàng đã từ chối nhận Email.")}</p><small>Biểu mẫu được giữ nguyên để chọn lại hoặc điều chỉnh kênh liên hệ.</small></div><div className="next-state-actions"><Button primary onClick={() => { setError(""); go("followup-create"); }}>Quay lại biểu mẫu</Button></div></div>
      </Page>;
    if (screen === "followup-create") {
      const selectedFollowChannel = followChannel === "email" && responses.some(item => item.id === selected && !item.email) ? "phone" : followChannel;
      return (
        <Page section="Follow-up" title="Lập lịch Follow-up" go={go}>
          {feedback}
          <Card title="Thiết lập lịch">
            <label className="next-field">
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
            <Field
              label="Ngày giờ hẹn (để trống: sau 2 ngày làm việc)"
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
            <Field
              label="Nội dung / Mục tiêu"
              value={goal}
              set={setGoal}
              rows={4}
              required
            />
            <div className="next-grid next-three">
              <Field
                label="Nhắc trước (phút)"
                value={reminderMinutes}
                set={setReminderMinutes}
                type="number"
              />
              <Field
                label="Chờ phản hồi (ngày)"
                value={waitDays}
                set={setWaitDays}
                type="number"
              />
              <Field
                label="Số lần tối đa"
                value={maxAttempts}
                set={setMaxAttempts}
                type="number"
              />
              <Field
                label="Khoảng cách giữa các lần (ngày)"
                value={intervalDays}
                set={setIntervalDays}
                type="number"
              />
            </div>
            <p>
              Nhân viên thực hiện thủ công; hệ thống chỉ lưu lịch và nhắc việc.
            </p>
            <div className="next-actions-bar">
              <Button
                primary
                disabled={busy || !selected || !goal.trim()}
                onClick={() =>
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
                  ).then(item => { if (item) { setCreatedFollowup(item); go("followup-success"); } })
                }
              >
                Lưu lịch
              </Button>
            </div>
          </Card>
        </Page>
      );
    }
    if (screen === "followup-success") return <Page section="Follow-up" title="Lập lịch Follow-up" go={go}>
      {feedback}<div className="next-state success"><div><span>ĐÃ LƯU LỊCH FOLLOW-UP</span><h2>{createdFollowup ? `Đã thêm lịch Follow-up FU-${createdFollowup.id}` : "Lịch Follow-up đã lưu"}</h2>
        <p>{createdFollowup ? `Response RSP-${createdFollowup.response_id} · Kênh ${createdFollowup.channel === "phone" ? "Gọi điện" : createdFollowup.channel.toUpperCase()}.` : "Xem danh sách để kiểm tra lịch đã lưu."}</p>
        {createdFollowup && <small>Hẹn {date(createdFollowup.due_at)} · Tối đa {createdFollowup.max_attempts} lần · Trạng thái: Chờ thực hiện.</small>}
      </div><div className="next-state-actions"><Button primary onClick={() => go("response-list")}>Tạo lịch khác</Button><Button onClick={() => go("followup-list")}>Về danh sách Follow-up</Button></div></div>
    </Page>;
    if (screen === "followup-result" && followup)
      return <Page section="Follow-up" title="Kết quả Follow-up" go={go}>
        {feedback}
        <section className="next-card next-summary next-followup-summary">
          <h2>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"} · {followup.customer_name} · RSP-{followup.response_id}</h2>
          <div className="next-result-grid">
            <div><span>Trạng thái</span><strong>{followup.status === "pending" ? "Chờ thực hiện" : "Đã thực hiện"}</strong></div>
            <div><span>Lịch hẹn</span><strong>{date(followup.due_at)}</strong></div>
            <div><span>Hình thức</span><strong>{followup.channel === "phone" ? "Gọi điện" : followup.channel.toUpperCase()}</strong></div>
            <div><span>Lần Follow-up</span><strong>{followup.attempt} / {followup.max_attempts}</strong></div>
            <div><span>Cập nhật lúc</span><strong>{date(followup.completed_at || followup.created_at)}</strong></div>
            <div><span>Nguồn cập nhật</span><strong>Hệ thống</strong></div>
            <div className="wide"><span>Nội dung / Mục tiêu</span><strong>{followup.goal}</strong></div>
          </div>
        </section>
        <Card title="Lịch sử Follow-up"><Table heads={["Thời điểm", "Trạng thái mới", "Người thực hiện"]} rows={[
          [date(followup.created_at), "Chờ thực hiện", "Nhân viên Marketing"],
          ...(followup.completed_at ? [[date(followup.completed_at), "Đã thực hiện", "Hệ thống"]] : []),
        ]} /></Card>
        <div className="next-actions-bar">
          <Button primary onClick={() => { setDecisionNote(followup.note || ""); go("followup-note"); }}>Bổ sung ghi chú</Button>
          {followup.status === "pending" && <Button onClick={() => go("followup-detail")}>Ghi nhận kết quả</Button>}
          <Button onClick={() => go("followup-list")}>Về danh sách</Button>
          {followup.status === "pending" && <Button onClick={() => go("followup-delete")}>Xóa lịch Follow-up</Button>}
        </div>
      </Page>;
    if (screen === "followup-note" && followup)
      return <Page section="Follow-up" title="Ghi chú kết quả" go={go}>
        {feedback}
        <Card title={`Ghi chú kết quả · ${followup.customer_name}`}>
          <dl className="next-details"><dt>Kết quả tự động</dt><dd>{followup.status === "pending" ? "Chờ thực hiện" : followup.outcome === "responded" ? "Có phản hồi" : followup.outcome === "no_response" ? "Không phản hồi" : "Đang chờ phản hồi"}</dd></dl>
          <Field label="Ghi chú kết quả" value={decisionNote} set={setDecisionNote} rows={5} />
          <p className="next-hint">Hủy hoặc lỗi lưu ghi chú không thay đổi kết quả đã được hệ thống cập nhật.</p>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("followup-result")}>Hủy</Button><Button primary disabled={busy} onClick={() => void run(() => api(`followups/${followup.id}/note`, "PATCH", { note: decisionNote }), "Đã lưu ghi chú.", "followup-result")}>Lưu ghi chú</Button></div>
      </Page>;
    if (screen === "followup-delete" && followup)
      return <Page section="Follow-up" title="Xóa lịch Follow-up" go={go}>
        {feedback}
        <Card title={`Lịch Follow-up · ${followup.customer_name}`}>
          <dl className="next-details"><dt>Response</dt><dd>RSP-{followup.response_id}</dd><dt>Mốc thời gian</dt><dd>{date(followup.due_at)}</dd><dt>Trạng thái</dt><dd>{followup.status === "pending" ? "Chờ thực hiện" : "Đã xử lý"}</dd></dl>
          <p>Chỉ lịch Chờ thực hiện được phép xóa. Lịch đã xóa được giữ lại trong lịch sử.</p>
        </Card>
        <div className="next-actions-bar"><Button onClick={() => go("followup-list")}>Hủy</Button><Button disabled={busy || followup.status !== "pending"} onClick={() => ask("Xóa lịch Follow-up", "Lịch đang chờ sẽ được hủy và giữ lại trong lịch sử.", () => void run(() => api(`followups/${followup.id}`, "DELETE"), "Đã hủy lịch Follow-up.", "followup-list"))}>Xóa lịch Follow-up</Button></div>
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
                <Field
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
      const checked = senders.find(item => item.id === senderCheckResult?.id) || senders.find(item => item.id === selected) || senders[0];
      return <Page section="Tài khoản gửi" title="Kết quả kiểm tra tài khoản" go={go}>
        {feedback}
        <section className="mgr-panel"><h2>{senderCheckResult?.connected ? "Tài khoản hoạt động" : "Chưa kiểm tra được tài khoản"}</h2>
          <Table heads={["Chỉ tiêu", "Kết quả"]} rows={[
            ["Địa chỉ email", checked?.email || "—"],
            ["Trạng thái hiện tại", checked?.status === "active" ? "Hoạt động" : "Ngừng hoạt động"],
            ["Kết quả kiểm tra", senderCheckResult?.message || "Chưa có kết quả kiểm tra."],
            ["Giới hạn / Đã gửi / Còn lại trong 3 ngày", checked ? `${n(checked.quota_3_days)} / ${n(checked.used_3_days)} / ${n(Math.max(0, checked.quota_3_days - checked.used_3_days))}` : "—"],
          ]} />
          <p className={"mgr-callout" + (senderCheckResult?.connected ? " success" : " danger")}>{senderCheckResult?.message || "Chọn tài khoản và kiểm tra lại."}</p>
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
          <Card title="Danh sách tài khoản gửi">
            <Table
              heads={[
                "Tên tài khoản",
                "Email",
                "Đã dùng / hạn mức 3 ngày",
                "Trạng thái",
                "Thao tác",
              ]}
              rows={senders.map((item) => [
                item.name,
                item.email,
                `${n(item.used_3_days)} / ${n(item.quota_3_days)}`,
                item.status === "active"
                  ? "Hoạt động"
                  : item.status === "blocked"
                    ? "Bị khóa"
                    : "Ngừng hoạt động",
                <Button
                  key={item.id}
                  onClick={() => choose(item.id, manager ? "manager-account-detail" : "sender-detail")}
                >
                  Xem chi tiết
                </Button>,
              ])}
            />
          </Card>
          {manager && (
            <div className="next-actions-bar">
              <Button
                primary
                onClick={() => {
                  setSenderForm({
                    name: "",
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
                Thêm tài khoản
              </Button>
            </div>
          )}
        </Page>
      );
    if (screen === "manager-account-saved")
      return <Page section="Tài khoản gửi" title="Đã lưu tài khoản gửi email" go={go}>
        {feedback}
        <section className="mgr-panel"><h2>Lưu thông tin tài khoản thành công</h2>
          <Table heads={["Tên tài khoản", "Địa chỉ email người gửi", "Hạn mức 3 ngày", "Trạng thái"]}
            rows={sender ? [[sender.name, sender.email, n(sender.quota_3_days), sender.status === "active" ? "Hoạt động" : "Ngừng hoạt động"]] : []} />
          <p className="mgr-callout success">Thông tin tài khoản gửi đã được lưu.</p>
        </section>
        <div className="mgr-actions"><button className="mgr-primary" type="button" onClick={() => go("manager-account-list")}>Về danh sách</button></div>
      </Page>;
    if (screen === "manager-account-add" || screen === "manager-account-edit")
      return (
        <Page
          section="Tài khoản gửi"
          title={
            screen === "manager-account-add"
              ? "Thêm tài khoản gửi"
              : "Sửa tài khoản gửi"
          }
          go={go}
        >
          {feedback}
          <Card title="Cấu hình Gmail / SMTP">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  async () => {
                    const saved = await api<Sender>(
                      `sender-accounts${screen === "manager-account-edit" && sender ? `/${sender.id}` : ""}`,
                      screen === "manager-account-edit" ? "PATCH" : "POST",
                      {
                        name: senderForm.name,
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
              <div className="next-grid">
              <Field
                label="Tên tài khoản"
                value={senderForm.name}
                set={(value) => setSenderForm({ ...senderForm, name: value })}
                required
              />
              <Field
                label="Địa chỉ email người gửi"
                value={senderForm.email}
                set={(value) => setSenderForm({ ...senderForm, email: value })}
                type="email"
                required
              />
              <Field
                label="Máy chủ SMTP"
                value={senderForm.smtpHost}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpHost: value })
                }
                required
              />
              <Field
                label="Cổng SMTP"
                value={senderForm.smtpPort}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpPort: value })
                }
                type="number"
                required
              />
              <Field
                label="Tên đăng nhập SMTP"
                value={senderForm.smtpUser}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpUser: value })
                }
                required
              />
              <Field
                label="Mật khẩu ứng dụng Gmail"
                value={senderForm.smtpPassword}
                set={(value) =>
                  setSenderForm({ ...senderForm, smtpPassword: value })
                }
                type="password"
                required={screen === "manager-account-add"}
              />
              <Field
                label="Hạn mức email / 3 ngày"
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
              <div className="next-actions-bar">
                <Button type="submit" primary disabled={busy}>
                  Lưu tài khoản
                </Button>
              </div>
            </form>
          </Card>
        </Page>
      );
    return (
      <Page section="Tài khoản gửi" title="Chi tiết tài khoản" go={go} backTo={manager ? "manager-account-list" : "sender-list"}>
        {feedback}
        {sender ? (
          <Card title={sender.name}>
            <p>
              {sender.email} ·{" "}
              {sender.status === "active" ? "Hoạt động" : "Ngừng hoạt động"}
            </p>
            <p>
              Đã dùng {n(sender.used_3_days)} / {n(sender.quota_3_days)} email
              trong 3 ngày · SMTP:{" "}
              {sender.configured ? "Đã cấu hình" : "Chưa cấu hình"} · Gmail
              IMAP: {sender.inbound_enabled ? "Bật" : "Tắt"}
            </p>
            {manager && (
              <div className="next-actions-bar">
                <Button
                  onClick={() => {
                    setSenderForm({
                      name: sender.name,
                      email: sender.email,
                      smtpHost: sender.smtp_host || "",
                      smtpPort: String(sender.smtp_port || 465),
                      smtpUser: sender.smtp_user || "",
                      smtpPassword: "",
                      status: sender.status,
                      quota3Days: String(sender.quota_3_days),
                      inboundEnabled: sender.inbound_enabled,
                    });
                    go("manager-account-edit");
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
                <Button
                  disabled={busy}
                  onClick={() => {
                    ask(
                      "Xóa tài khoản gửi",
                      "Chỉ có thể xóa tài khoản chưa dùng trong chiến dịch.",
                      () =>
                        void run(
                          () => api(`sender-accounts/${sender.id}`, "DELETE"),
                          "Đã xóa tài khoản gửi.",
                          "manager-account-list",
                        ),
                    );
                  }}
                >
                  Xóa
                </Button>
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
