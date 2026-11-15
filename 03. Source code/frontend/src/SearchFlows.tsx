import type { Navigate } from "./recordNavigation";
import { useEffect, useRef, useState } from "react";
import Flow, { type Criteria } from "./Flow";
import { api } from "./api";
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
    go(next);
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
  if (["criteria", "criteria-adjust", "criteria-invalid"].includes(screen))
    return (
      <>
        <Flow screen={screen} draftKey={draftKey} go={navigate} />

      </>
    );
  const titles: Record<string, string> = {
    review: "Bộ tiêu chí tìm kiếm",
    "review-success": "Thiết lập tiêu chí thành công",
    searching: "Đang tìm kiếm Contact",
    results: "Kết quả tìm kiếm",
    "search-empty": "Không tìm thấy Contact mới phù hợp",
    "search-error": "Tìm kiếm không thành công",
    history: "Lịch sử tìm kiếm",
    "history-detail": "Chi tiết lần tìm kiếm",
    "search-all-contacts": "Toàn bộ Contact",
  };
  const isReview = screen.startsWith("review");
  const isHistory = ["history", "history-empty", "history-load-error"].includes(
    screen,
  );
  const rows = job?.results || [],
    visible =
      screen === "search-all-contacts"
        ? rows.slice((page - 1) * 10, page * 10)
        : rows.slice(0, 5);
  const label = (c: Contact) =>
    c.job_title || c.location || c.search_provenance?.industry
      ? "Chưa đảm bảo — thông tin suy đoán"
      : "Chưa xác định";
  return (
    <section className="flow-content search-content">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <button type="button" onClick={() => navigate("criteria")}>
          Tìm kiếm Contact
        </button>
        <span aria-hidden>›</span>
        <span>{titles[screen] || "Tìm kiếm Contact"}</span>
      </nav>
      <header className="flow-heading">
        <h1>{titles[screen] || "Tìm kiếm Contact"}</h1>
        <p>
          {isReview
            ? "Kiểm tra bộ tiêu chí trước khi xác nhận tìm kiếm."
            : isHistory
              ? "Xem tiêu chí và kết quả thực tế của từng lần tìm kiếm."
              : "Kết quả được lưu từ nguồn Google Search/Web."}
        </p>
      </header>
      {error && (
        <div className="flow-notice error" role="alert">
          {error}
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
              {Object.entries(criteria).map(([field, value]) => (
                <div key={field}>
                  <span>
                    {{
                      role: "Chức vụ Contact",
                      industry: "Ngành nghề",
                      location: "Khu vực",
                      size: "Quy mô tham khảo",
                      email: "Trạng thái email",
                      keyword: "Từ khóa",
                      source: "Nguồn",
                    }[field] || field}
                  </span>
                  <strong>
                    {Array.isArray(value)
                      ? value.join(", ") || "—"
                      : value || "—"}
                  </strong>
                </div>
              ))}
            </div>
            <p>
              Email “Đã xác nhận” nghĩa là tìm thấy trên website nguồn và hợp lệ
              về cú pháp, chưa xác minh khả năng nhận thư. Chức vụ, ngành và khu
              vực suy đoán ghi “Chưa đảm bảo”. Quy mô tham khảo không lọc cứng;
              thiếu cơ sở thì chưa ước đoán.
            </p>

          </section>
          <div className="flow-actions">
            <Button onClick={() => navigate("criteria")}>
              Điều chỉnh tiêu chí
            </Button>
            <Button
              primary
              disabled={busy}
              onClick={() => void start()}
            >
              {busy ? "Đang ghi nhận…" : "Xác nhận và tìm kiếm"}
            </Button>
          </div>
        </>
      ) : isHistory ? (
        <>
          <section className="flow-panel">
            <h2>Các lần tìm kiếm</h2>
            {busy ? (
              <p role="status">Đang tải lịch sử…</p>
            ) : !history.length ? (
              <p>Chưa có lần tìm kiếm nào được ghi nhận.</p>
            ) : (
              <table className="flow-table search-history-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Nguồn</th>
                    <th>Kết quả</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td>Google Search/Web</td>
                      <td>
                        {item.status === "succeeded"
                          ? `${item.new_count} Contact mới`
                          : item.status === "failed"
                            ? "Không thành công"
                            : "Đang xử lý"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-select"
                          onClick={() => selectJob(item.id, "history-detail")}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {history.length >= 25 && (
            <div className="flow-actions">
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
            </div>
          )}
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
        <section className="flow-panel" aria-live="polite">
          <h2>Đang xử lý yêu cầu</h2>
          <p>
            {{
              queued: "Đang chờ xử lý",
              searching: "Đang tìm website trên Google",
              fetching: "Đang đọc website và lấy email",
              saving: "Đang kiểm tra và lưu dữ liệu",
            }[job.stage] || job.stage}{" "}
            · Đã xử lý {job.processed} trang.
          </p>
          <p>
            Không đóng dữ liệu hoặc tạo yêu cầu khác. Có thể mở lại lần tìm
            trong lịch sử.
          </p>
        </section>
      ) : job.status === "failed" ? (
        <>
          <div className="flow-notice error" role="alert">
            {job.error || "Không hoàn tất lần tìm kiếm."}
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
          <section className="flow-panel result-panel">
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
            <details>
              <summary>Tiêu chí đã sử dụng</summary>
              <div className="criteria-summary">
                {Object.entries(job.criteria).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>
                      {Array.isArray(v) ? v.join(", ") || "—" : v || "—"}
                    </strong>
                  </div>
                ))}
              </div>
            </details>
            {!!job.warnings.length && (
              <div className="flow-notice warning" role="status">
                <strong>Kết quả có giới hạn hoặc chưa đầy đủ</strong>
                <ul>
                  {job.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              Email “Đã xác nhận”: tìm thấy trên website nguồn và hợp lệ về cú
              pháp; chưa xác minh khả năng nhận thư. Thông tin suy đoán có thể
              sai.
            </p>
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
                      Xem toàn bộ Contact
                    </button>
                  )}
                </p>
                <div className="search-table-scroll">
                  <table className="flow-table">
                    <thead>
                      <tr>
                        <th>Contact / Email</th>
                        <th>Chức vụ / Khu vực</th>
                        <th>Ngành / Quy mô</th>
                        <th>Nguồn và xác nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>
                              {c.full_name || "Chưa xác định tên"}
                            </strong>
                            <br />
                            {c.email}
                          </td>
                          <td>
                            {c.job_title || "—"}
                            <br />
                            {c.location || "—"}
                            <small>{label(c)}</small>
                          </td>
                          <td>
                            {c.search_provenance?.industry || "—"}
                            {c.search_provenance?.companySize && (
                              <small>
                                Quy mô tham khảo:{" "}
                                {c.search_provenance.companySize}
                              </small>
                            )}
                            <small>
                              {c.search_provenance?.sizeNote ||
                                "Chưa đủ cơ sở ước đoán quy mô."}
                            </small>
                            <small>
                              {c.search_provenance?.publicEmailCount || 0} email
                              công khai quan sát trên domain · không phải số
                              nhân viên
                            </small>
                          </td>
                          <td>
                            <span title="Tìm thấy trên website nguồn và hợp lệ cú pháp; chưa kiểm tra hộp thư nhận được.">
                              Đã xác nhận
                            </span>
                            <br />
                            <a
                              href={c.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Xem website nguồn
                            </a>
                            <details>
                              <summary>Bằng chứng</summary>
                              {c.search_provenance?.evidence}
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
            <div>
              <Button
                onClick={() =>
                  navigate(
                    screen === "search-all-contacts" ? "results" : "criteria",
                  )
                }
              >
                Quay lại
              </Button>
              <Button onClick={() => navigate("history")}>
                Lịch sử tìm kiếm
              </Button>
            </div>
            {job.list_id && (
              <Button primary onClick={openList}>
                Kiểm tra danh sách Contact
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
