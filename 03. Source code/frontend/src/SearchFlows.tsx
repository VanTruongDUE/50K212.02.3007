import type { Navigate } from "./recordNavigation";
import { useEffect, useRef, useState } from "react";
import Flow, { type Criteria } from "./Flow";
import { api } from "./api";
import FigmaState from "./FigmaState";
type Contact = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  location: string | null;
  source_url: string;
  search_provenance?: {
    industry?: string | null;
    companySize?: string | null;
    evidence?: string;
    sizeNote?: string;
    publicEmailCount?: number;
  };
};
type Job = {
  id: string;
  criteria: Criteria;
  status: string;
  stage: string;
  processed: number;
  received: number;
  invalid: number;
  duplicate: number;
  new_count: number;
  results: Contact[];
  warnings: string[];
  list_id: string | null;
  error: string | null;
  created_at: string;
  owner_id?: string;
};
const empty: Criteria = {
  role: [],
  industry: [],
  location: [],
  size: [],
  email: [],
  keyword: "",
  source: "",
};
function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={"flow-button" + (primary ? " primary" : "")}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export default function SearchFlows({
  screen,
  go,
  owner,
}: {
  screen: string;
  go: Navigate;
  owner: string;
}) {
  const key = "v5-search:" + owner,
    draftKey = key + ":criteria";
  const [criteria, setCriteria] = useState<Criteria>(() => {
      try {
        return JSON.parse(
          sessionStorage.getItem(draftKey) || JSON.stringify(empty),
        ) as Criteria;
      } catch {
        return empty;
      }
    }),
    [job, setJob] = useState<Job | null>(null),
    [history, setHistory] = useState<Job[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0);
  const [jobId, setJobId] = useState(
    () =>
      new URLSearchParams(location.search).get("searchId") ||
      sessionStorage.getItem(key + ":job") ||
      "",
  );
  const [historySelection, setHistorySelection] = useState("");
  const [contactSelection, setContactSelection] = useState("");
  const requestKey = useRef(sessionStorage.getItem(key + ":request") || ""),
    starting = useRef(false);
  function navigate(next: string) {
    setError("");
    setPage(1);
    if (next === "review") {
      try {
        setCriteria(
          JSON.parse(
            sessionStorage.getItem(draftKey) || JSON.stringify(empty),
          ) as Criteria,
        );
      } catch {
        setCriteria(empty);
      }
    }
    if (next === "review" || (screen === "criteria-check-error" && next === "criteria")) {
      go("criteria-checking");
      return;
    }
    go(next);
  }
  useEffect(() => {
    if (screen !== "criteria-checking") return;
    let active = true;
    let draft = criteria;
    try { draft = JSON.parse(sessionStorage.getItem(draftKey) || JSON.stringify(criteria)); } catch { /* Keep the current draft. */ }
    api<{ criteria: Criteria }>("contact-searches/check", "POST", { criteria: draft })
      .then(value => { if (active) { setCriteria(value.criteria); go("review"); } })
      .catch(reason => { if (active) { setError(reason.message); go("criteria-check-error"); } });
    return () => { active = false; };
  }, [screen, draftKey, go, criteria]);
  async function confirmCriteria() {
    setBusy(true); setError("");
    try { await api("contact-searches/criteria", "POST", { criteria }); go("review-success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể ghi nhận bộ tiêu chí."); }
    finally { setBusy(false); }
  }
  function selectJob(id: string, next: string) {
    sessionStorage.setItem(key + ":job", id);
    const url = new URL(location.href);
    url.searchParams.set("searchId", id);
    window.history.replaceState({}, "", url);
    setJobId(id);
    setJob(null);
    navigate(next);
  }
  useEffect(() => {
    if (!screen.startsWith("history") || screen === "history-detail") return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setBusy(true);
    });
    api<Job[]>("contact-searches/history")
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [screen, reload]);
  useEffect(() => {
    if (
      !jobId ||
      [
        "criteria",
        "criteria-adjust",
        "criteria-invalid",
        "review",
        "review-success",
      ].includes(screen) ||
      screen === "history"
    )
      return;
    let active = true,
      timer: number | undefined;
    async function poll() {
      try {
        const value = await api<Job>("contact-searches/" + jobId);
        if (!active) return;
        setJob(value);
        setError("");
        if (value.status === "queued" || value.status === "running") {
          timer = window.setTimeout(() => void poll(), 1500);
        } else if (screen === "searching") {
          go(
            value.status === "failed"
              ? "search-error"
              : value.new_count
                ? "results"
                : "search-empty",
          );
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Không tải được lần tìm kiếm.",
          );
      }
    }
    void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [jobId, screen, reload, go]);
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError("");
    const payload = JSON.stringify(criteria);
    if (sessionStorage.getItem(key + ":payload") !== payload)
      requestKey.current = "";
    requestKey.current ||= crypto.randomUUID();
    sessionStorage.setItem(key + ":request", requestKey.current);
    sessionStorage.setItem(key + ":payload", payload);
    try {
      const value = await api<Job>("contact-searches", "POST", {
        criteria,
        requestKey: requestKey.current,
      });
      selectJob(value.id, "searching");
      requestKey.current = "";
      sessionStorage.removeItem(key + ":request");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tìm kiếm.");
    } finally {
      setBusy(false);
      starting.current = false;
    }
  }
  function openList() {
    if (!job?.list_id) return;
    go("check", { key: "listId", id: job.list_id });
  }
  if (["criteria", "criteria-adjust", "criteria-invalid", "criteria-checking", "criteria-check-error"].includes(screen))
    return (
      <>
        <Flow screen={screen} draftKey={draftKey} go={navigate} />

      </>
    );
  const titles: Record<string, string> = {
    review: "Kiểm tra bộ tiêu chí",
    "template-created": "Đã tạo Filter Template",
    "review-success": "Thiết lập tiêu chí thành công",
    searching: "Đang tìm kiếm Contact",
    results: "Kết quả tìm kiếm",
    "search-empty": "Không tìm thấy Contact mới phù hợp",
    "search-error": "Tìm kiếm không thành công",
    history: "Lịch sử tìm kiếm",
    "history-detail": "Chi tiết lần tìm kiếm",
    "search-all-contacts": "Toàn bộ Contact",
  };
  const isReview = screen.startsWith("review") || screen === "template-created";
  const isHistory = ["history", "history-empty", "history-load-error"].includes(
    screen,
  );
  const rows = job?.results || [],
    visible =
      screen === "search-all-contacts"
        ? rows.slice((page - 1) * 10, page * 10)
        : rows.slice(0, 5);
  const activeHistory = history.find(item => item.id === historySelection) || history[0];
  const activeContact = rows.find(item => item.id === contactSelection) || rows[0];
  return (
    <section className="flow-content search-content">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <button type="button" onClick={() => navigate("criteria")}>
          Tìm kiếm Contact
        </button>
        <span aria-hidden>›</span>
        <span>{isReview ? "Kiểm tra bộ tiêu chí" : titles[screen] || "Tìm kiếm Contact"}</span>
      </nav>
      <header className="flow-heading">
        <h1>{busy && isReview ? "Đang ghi nhận bộ tiêu chí" : screen === "review" ? "Bộ tiêu chí hợp lệ" : titles[screen] || "Tìm kiếm Contact"}</h1>
        <p>
          {screen === "review-success" ? "Bộ tiêu chí đã được ghi nhận cho lần tìm kiếm hiện tại." : screen === "template-created" ? "Template đã được lưu. Kiểm tra và xác nhận lại trước khi áp dụng tiêu chí cho lần tìm kiếm." : isReview
            ? "Các điều kiện đã vượt qua kiểm tra. Xác nhận để tiếp tục tìm kiếm."
            : screen === "searching" ? "Hệ thống đang xử lý yêu cầu tìm kiếm."
            : isHistory
              ? "Xem lại nguồn và kết quả của từng lần tìm kiếm."
              : screen === "history-detail" ? "Xem tiêu chí và kết quả của lần tìm kiếm đã lưu." : `Hiển thị ${visible.length} trong ${job?.new_count ?? rows.length} Contact mới hợp lệ.`}
        </p>
      </header>
      {error && (
        <div className="flow-notice error" role="alert">
          <strong>{isReview ? "Không thể ghi nhận bộ tiêu chí" : isHistory ? "Không thể tải lịch sử tìm kiếm" : "Không thể tải dữ liệu"}</strong><p>{error}</p>
          <button type="button" onClick={() => setReload((v) => v + 1)}>
            Tải lại
          </button>
        </div>
      )}
      {isReview ? (
        <>
          <section className="flow-panel review-panel">
            <h2>Bộ tiêu chí tìm kiếm</h2>
            <div className="criteria-summary">
              {([
                ["role", "Chức vụ Contact"],
                ["industry", "Ngành nghề / lĩnh vực"],
                ["location", "Địa điểm / khu vực"],
                ["keyword", "Từ khóa doanh nghiệp"],
                ["size", "Quy mô doanh nghiệp"],
                ["email", "Trạng thái email"],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <span>{label}</span>
                  <strong>
                    {Array.isArray(criteria[field])
                      ? criteria[field].join(", ") || "—"
                      : criteria[field] || "—"}
                  </strong>
                </div>
              ))}
            </div>
            <div className="review-source"><strong>Nguồn tìm kiếm</strong><span>{criteria.source || "—"}</span></div>
            <p>Lưu thành Template để dùng lại. Tìm kiếm chỉ bắt đầu khi bạn xác nhận.</p>

          </section>
          <div className="flow-actions">
            <div><Button disabled={busy} onClick={() => navigate("criteria")}>
              Điều chỉnh tiêu chí
            </Button><Button disabled={busy} onClick={() => { sessionStorage.setItem("v5-template-draft", JSON.stringify(criteria)); go("template-create"); }}>Lưu thành Template</Button></div>
            <Button
              primary
              disabled={busy}
              onClick={() => void (screen === "review-success" ? start() : confirmCriteria())}
            >
              {busy ? "Đang ghi nhận…" : error ? "Thử ghi nhận lại" : screen === "review-success" ? "Tìm kiếm Contact" : screen === "review" ? "Xác nhận và tìm kiếm" : "Xác nhận tiêu chí"}
            </Button>
          </div>
        </>
      ) : isHistory ? (
        <>
          <section className="flow-panel">
            {busy ? (
              <p role="status">Đang tải lịch sử…</p>
            ) : error ? <FigmaState error title="Không thể tải lịch sử tìm kiếm" description={error} actions={<Button onClick={() => setReload(v => v + 1)}>Tải lại lịch sử</Button>} /> : !history.length ? (
              <FigmaState title="Chưa có lịch sử tìm kiếm" description="Chưa có lần tìm kiếm nào được ghi nhận." actions={<Button primary onClick={() => navigate("criteria")}>Thiết lập tìm kiếm</Button>} />
            ) : (
              <div className="search-history-scroll"><table className="flow-table search-history-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Người thực hiện</th>
                    <th>Nguồn</th>
                    <th>Contact mới</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className={activeHistory?.id === item.id ? "selected" : undefined} onClick={() => setHistorySelection(item.id)}>
                      <td><button type="button" className="table-select" aria-pressed={activeHistory?.id === item.id} onClick={() => setHistorySelection(item.id)}>{new Date(item.created_at).toLocaleString("vi-VN")}</button></td>
                      <td title={item.owner_id || owner}>Nhân viên Marketing</td><td>Google Search/Web</td>
                      <td>
                        {item.status === "succeeded"
                          ? `${item.new_count} Contact mới`
                          : item.status === "failed"
                            ? "Không thành công"
                            : "Đang xử lý"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </section>
          {!!history.length && <div className="flow-actions"><div>{history.length >= 25 && (
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void api<Job[]>(
                    "contact-searches/history?cursor=" +
                      history[history.length - 1].id,
                  )
                    .then((more) => setHistory((v) => [...v, ...more]))
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Xem thêm lịch sử
              </Button>
          )}</div><Button primary disabled={busy || !activeHistory} onClick={() => selectJob(activeHistory.id, "history-detail")}>Xem chi tiết</Button></div>}
        </>
      ) : !job ? (
        <section className="flow-panel">
          <p role="status">
            {jobId
              ? "Đang tải lần tìm kiếm…"
              : "Chưa chọn lần tìm kiếm. Mở lịch sử hoặc thiết lập tiêu chí."}
          </p>
          <Button onClick={() => navigate("history")}>Lịch sử tìm kiếm</Button>
        </section>
      ) : job.status === "queued" || job.status === "running" ? (
        <>
          <section className="flow-notice searching-notice" role="status" aria-live="polite">
            <div>Đang gửi và xử lý yêu cầu từ nguồn đã chọn.<br />Chưa có kết quả cuối cùng. Vui lòng chờ, không gửi lại yêu cầu.
              <span className="sr-only"> Đã xử lý {job.processed} trang.</span>
            </div>
          </section>
          <div className="flow-actions search-loading-actions"><Button primary disabled onClick={() => {}}>Đang tìm kiếm…</Button></div>
        </>
      ) : job.status === "succeeded" && !rows.length ? <FigmaState title="Không tìm thấy Contact phù hợp" description="Google Search/Web không trả về Contact mới phù hợp. Lịch sử tìm kiếm đã được lưu." actions={<Button onClick={() => navigate("criteria")}>Quay lại</Button>} /> : job.status === "failed" ? (
        <>
          <div className="flow-notice error" role="alert">
            <strong>Tìm kiếm không thành công</strong><p>{job.error || "Không hoàn tất lần tìm kiếm."}</p>
          </div>
          <div className="flow-actions">
            <Button onClick={() => navigate("criteria")}>
              Điều chỉnh tiêu chí
            </Button>
            <Button
              primary
              onClick={() => {
                sessionStorage.removeItem(key + ":request");
                requestKey.current = "";
                sessionStorage.setItem(draftKey, JSON.stringify(job.criteria));
                setCriteria(job.criteria);
                navigate("review");
              }}
            >
              Kiểm tra rồi tìm lại
            </Button>
          </div>
        </>
      ) : (
        <>
          <section className={"flow-panel result-panel search-result-figma" + (screen === "history-detail" ? " search-detail-figma" : "")}>
            <p>
              Nguồn: Google Search/Web ·{" "}
              {new Date(job.created_at).toLocaleString("vi-VN")}
            </p>
            <div className="metrics">
              {[
                ["Contact nhận được", job.received],
                ["Không hợp lệ", job.invalid],
                ["Trùng lặp", job.duplicate],
                ["Contact mới hợp lệ", job.new_count],
              ].map(([title, count]) => (
                <div key={title}>
                  <span>{title}</span>
                  <strong>{count} Contact</strong>
                </div>
              ))}
            </div>
            {!rows.length ? (
              <p>
                Không có Contact mới.{" "}
                {job.duplicate
                  ? "Các email tìm được đã có trong hệ thống."
                  : "Hãy điều chỉnh tiêu chí để thử lại."}
              </p>
            ) : (
              <>
                <p className="table-overline">
                  <span>
                    Hiển thị {visible.length} trong {rows.length} Contact mới
                  </span>
                  {screen !== "search-all-contacts" && (
                    <button
                      type="button"
                      onClick={() => navigate("search-all-contacts")}
                    >
                      Hiển thị toàn bộ contact
                    </button>
                  )}
                </p>
                <div className="search-table-scroll">
                  <table className="flow-table">
                    <thead>
                      <tr>
                        <th>Contact</th><th>Email</th><th>Chức vụ</th><th>Doanh nghiệp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id}>
                          <td>{screen === "history-detail" ? <button type="button" className="table-select" aria-pressed={activeContact?.id === c.id} onClick={() => setContactSelection(c.id)}>{c.full_name || "Chưa xác định tên"}</button> : c.full_name || "Chưa xác định tên"}</td>
                          <td><span title="Email công khai và hợp lệ cú pháp; chưa xác minh khả năng nhận thư.">{c.email}</span></td>
                          <td>{c.job_title || "—"}</td>
                          <td>{c.company || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {screen === "history-detail" && activeContact && <div className="search-contact-summary">
              <span>Contact: {activeContact.full_name || "—"} · Chức vụ: {activeContact.job_title || "—"}</span><span>Địa điểm / khu vực: {activeContact.location || "—"}</span>
              <span>Ngành nghề / lĩnh vực: {activeContact.search_provenance?.industry || "—"}</span><span>Quy mô doanh nghiệp: {activeContact.search_provenance?.companySize || "—"}</span>
              <span>Từ khóa: {job.criteria.keyword || "—"}</span><span>Email: {activeContact.email} · {activeContact.search_provenance ? "Đã xác nhận nguồn và cú pháp" : "Chưa xác minh"}</span>
            </div>}
            <details className="search-evidence"><summary>{job.warnings.length ? `Lưu ý kết quả (${job.warnings.length}) · Tiêu chí và nguồn` : "Tiêu chí và nguồn dữ liệu"}</summary>
              <p>Email “Đã xác nhận” chỉ xác nhận nguồn công khai và cú pháp, chưa xác minh khả năng nhận thư. Chức vụ, ngành, khu vực và quy mô suy đoán: Chưa đảm bảo.</p>
              <div className="criteria-summary">{Object.entries(job.criteria).map(([key, value]) => <div key={key}><span>{{role:"Chức vụ Contact",industry:"Ngành nghề / lĩnh vực",location:"Địa điểm / khu vực",keyword:"Từ khóa doanh nghiệp",size:"Quy mô doanh nghiệp",email:"Trạng thái email",source:"Nguồn tìm kiếm"}[key] || key}</span><strong>{Array.isArray(value) ? value.join(", ") || "—" : value || "—"}</strong></div>)}</div>
              {!!job.warnings.length && <ul>{job.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
              {visible.map(contact => <p key={contact.id}>{contact.email} · <a href={contact.source_url} target="_blank" rel="noreferrer">Website nguồn</a> · {contact.search_provenance?.evidence || "—"}<br />{contact.location || "—"} · {contact.search_provenance?.industry || "—"} · {contact.search_provenance?.companySize || "—"}<br />{contact.search_provenance?.sizeNote || "Thông tin suy đoán: Chưa đảm bảo."}</p>)}
            </details>
            {screen === "search-all-contacts" && rows.length > 10 && (
              <div className="flow-actions">
                <Button
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Trang trước
                </Button>
                <span>
                  Trang {page}/{Math.ceil(rows.length / 10)}
                </span>
                <Button
                  disabled={page * 10 >= rows.length}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Trang sau
                </Button>
              </div>
            )}
          </section>
          <div className="flow-actions">
            <div>{screen === "history-detail" ? <Button onClick={() => navigate("history")}>Quay lại lịch sử</Button> : screen === "search-all-contacts" ? <Button onClick={() => navigate("results")}>Quay lại</Button> : <Button onClick={() => navigate("history")}>Lịch sử tìm kiếm</Button>}</div>
            {screen !== "history-detail" && job.list_id && <Button primary onClick={openList}>Kiểm tra danh sách</Button>}
          </div>
        </>
      )}
    </section>
  );
}
