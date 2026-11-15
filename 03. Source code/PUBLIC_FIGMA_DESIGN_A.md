# Assessment A — Figma / PUBLIC, 15-11-2026

Method: independent design assessment A, isolated from assessment B findings. Operate mode. Authority: live Figma file **Màn hình giao diện_Nhóm2**, pages Trường `11:2` and Đức + Huy `18:8038`; actual public origin `https://v5-marketing.vercel.app`. This is form/layout fidelity review, not pixel certification or an end-to-end business test.

## Evidence and exact coverage

- Fresh live inventory: 75 + 121 = **196 frame records**. Fresh exported PNGs: **39**, exported at 0.5 scale with original frame dimensions retained in the ledger.
- **37 frame mappings visually compared** against public screenshots at the same viewport width AND height as each frame. **2 exported frames without a valid public counterpart** (`156:31985`: the initial login screenshot was taken before settlement; `16:589`: no real search-history record was available). **157 metadata only**. These categories total 196; 196 is not a visual-pass count.
- Public browser: own new headless Chrome process/context/tab; employee login; **41 settled route captures**, plus 2 actual-entry captures. `document.fonts.ready`, image decoding, and network settlement awaited. All public screenshots are from the deployed HTTPS site, never demo/local.
- Owned public fixtures supplied by root: list 14, campaign 9 (approved but no sender/schedule), Response 13, Follow-up 8/9, Filter 4. Names, row counts, dates and empty values differ deliberately from Figma examples. Those differences alone are not failures.
- Read-only guard aborted mutating requests except login and exact read-only campaign-preview POST. Final capture ledger records **zero blocked requests** and no form saves, emails, searching/credits or database changes by A. Root owns fixture cleanup.
- Files: `.context-cache/public-figma-2026-11-15/A/frame-coverage-ledger.json`, `public-ledger.json`, `entry-check-ledger.json`, `figma-*.png`, `public-*.png`. `top-differences-pairs-live.png`, `forms-pairs-live.png`, `detail-pairs-live.png`, `other-pairs-live.png`, `campaign-pairs-live.png` are visual inspection sheets. Earlier `*-historical.png` sheets were exploratory and are **not** current acceptance evidence.
- Bridge disconnected during export; parent restored foreground and Reconnect. All final 39 PNGs were successfully refreshed afterward. No Figma writes.

## Verdict

The public app preserves the dark blue V5 shell, main information hierarchy, most field groups, and the major two/three-column forms. It is recognisably the specified application. Several core screens still change information or form structure enough that they should not be accepted as faithful to Figma, even under the explicitly non-pixel-perfect brief.

BA-approved exceptions are accepted: single-level section breadcrumbs, Ẩn naming, Arial and larger balanced desktop sizing, uniform spacing, deletion actions left and other actions right, and responsive table action wrapping. No defect is based merely on different type metrics, row counts, colors of fixture statuses, quota values using the approved 3-day policy, or those action alignment conventions.

## Confirmed material differences

1. **P2 — Response reply changes the form, not merely its size.** Frame `43:6300` has a compact two-by-two arrangement: Kênh gửi / Người nhận, Mẫu phản hồi / Nội dung phản hồi. Public `?screen=response-reply&responseId=13` has no **Mẫu phản hồi** selector; instead it adds Tài khoản gửi and Tiêu đề email, and puts a large full-width textarea on a third row. Figma has Gửi phản hồi and Hủy; public has Gửi email without Hủy. SMTP requirements may explain extra inputs, but do not account for losing the template affordance or the planned compact arrangement. Restore the source grouping while accommodating required sender/subject, or obtain a revised BA frame. Evidence: `figma-43-6300.png`, `public-response-reply.png`; live forms sheet row 5.

2. **P2 — Contact review/confirmation omits the audit summary needed for the decision.** Frames `16:436`, `16:472`, `16:496` show source/time and the four counts received / invalid / duplicate / valid. `16:472` also shows the used search criteria. Public `check`, `confirm`, `confirmed` for list 14 collapses this to list name, a count/short status sentence, and the Contact table. It omits the four-part summary and criterion/source context; fewer fixture rows do not explain the missing headings/sections. Preserve these sections, including unavailable values as explicit unavailable rather than inventing historical metrics. Evidence: fresh three frame PNGs and corresponding public PNGs; detail sheet row 1 and other sheet rows 3–4.

3. **P2 — Campaign editor loses the workflow context and adds an unframed section.** Frame `327:254324` has the five-step strip with step 2 active, campaign summary, editor left and block/insert/attachment tools right. Public `?screen=campaign-editor&campaignId=9` retains the two-column editor/tools layout but **omits the entire five-step strip**. It also appends a separate **Lưu thành mẫu email / Tên mẫu / Lưu mẫu** panel beyond the main action bar, absent in this frame. The empty public editor fields versus populated persisted preview are recorded as observed state, not proof of an API/data-loss bug in this assessment. At minimum retain the workflow strip; extra template functionality needs traceability to a BA design. Evidence: `figma-327-254324.png`, `public-campaign-editor.png` at 1440×1430, with full-page overflow retained.

4. **P2 — Final confirmation loses verification metadata.** Frame `327:258992` and public `campaign-confirm` both retain the five-step strip and four-card two-column review, including a real miniature email preview. However the public recipient card has no **Thời điểm duyệt** row, and its schedule card replaces **Thời điểm hoàn tất dự kiến** with **Khung giờ gửi**. Empty sender/start values are expected for this deliberately incomplete fixture and are not counted as defects; missing row labels are structural differences. Four Hợp lệ badges cannot be fairly judged against an incomplete fixture. Evidence: `figma-327-258992.png`, `public-campaign-confirm.png` at 1440×1202.

5. **P3 — Hide confirmations use different composition.** Frame `213:67270` presents a small centered named-customer confirmation on a dedicated page. Actual public user entry **Follow-up result 8 → Ẩn lịch Follow-up** navigates to `?screen=followup-delete&followupId=8` and shows a wide information panel with a separate action bar. This preserves identity/status but changes the confirmation hierarchy and compact composition. Frame `213:66599` shows a centered confirmation for one selected Response; public `response-hide` instead opens a selector modal over the list. Because that entry selects an object within the dialog, call this a BA design reconciliation item, not a deletion-safety failure. Keep the approved hide wording and deletion-left convention. Evidence: `public-followup-hide-entry.png`, `public-response-hide.png`, fresh `213-*` PNGs.

## Actual-entry correction: campaign information modal is present

Direct `campaign-detail` URL is a different full-page surface and must not be used to claim the Figma modal was removed. A actually clicked **campaign-list → Xem**, observed URL remain `?screen=campaign-list`, and captured `public-campaign-info-entry.png` after transition settlement. It opens the **Thông tin chiến dịch** modal with all six source information rows: name, status, recipient count, subject, sender, start time, plus Đóng. Therefore **no missing-modal or missing-six-fields defect** is claimed for frame `327:241792`. Its coverage-ledger entry points to the corrected actual-entry screenshot.

## Core form/layout checks

| Figma | Public route | Assessment |
|---|---|---|
| `16:188` criteria | criteria | Six filter groups in 3 columns, selected summary, sources and action bar retained. |
| `16:241` templates | templates | Five table columns and selection/actions retained; only 2 owned fixture rows. |
| `16:271`, `16:322` create/edit template | template-create, template-edit | Full-width name plus six criteria in 3×2 grid retained. Different initial data is legitimate. |
| `43:6301` add Response | response-add | 2×2 grouping retained. Customer is a text input instead of Figma select; whether free text is intentional requires BA/data-model confirmation. Not classified as a missing field. |
| `60:6324` edit Response | response-edit | Customer full width, email/phone second row, separate content section retained; wider content textarea acceptable under balanced desktop brief. |
| `43:6297` change status | response-status | Current/new state paired, note full width retained. No transition/save exercised. |
| `43:6299` create Follow-up | followup-create | Two-column core fields retained, with extra full-width Response selector for entry from list; approved 2 business day / 3 attempt defaults accepted. |
| `43:6300` reply | response-reply | Material regrouping and missing template/Hủy; priority finding 1. |
| `43:6303` detail Response | response-detail | Three-column facts, content, linked-history table and four actions retained. New campaign fact is an extra field; data differs by fixture. |
| `43:6304` note | followup-note | Figma side-by-side current outcome and note become a read-only outcome row plus full-width textarea. Usable but less faithful grouping; secondary observation. |
| `43:6174`, `43:6302` lists | response-list, followup-list | Table columns, states, per-row details/results and footer actions retained. Lower density/scrolling depends on rows and approved desktop changes. |
| `47:7604`, `47:7735` histories | response-history, response-status-history | Same table columns; 0/1 public rows vs 2/3 in Figma. Populated multi-row history layout not proven. |
| `16:436`, `16:472`, `16:496` review | check, confirm, confirmed | Contact table/actions retained; audit/criteria summary missing, finding 2. Confirm fixture already confirmed, so pre-confirmation enabled-state not validated. |
| `16:529` export | export | Four formats horizontally, list identification, back/export bar retained. No download exercised. |
| `372:12675` all Contacts | all-contacts | Four table columns and pagination retained; only one Contact, so 5-page populated state not proven. |
| `327:251508`, `327:252065` campaign recipients | campaign-contacts, campaign-filtered | Five steps, paired information/list columns, three filtering metrics and action bar retained. Different row count accepted. |
| `327:252598` campaign pending | campaign-pending | Strip/banner/summary composition retained, but approved fixture renders approved instead of waiting; waiting-state acceptance is not claimed. |
| `327:253992`, `327:254169` email sources | campaign-email, campaign-layouts | Library table and 3 layout choices retained. Library empty so sample-selection state unproven; new preview motifs not a material fidelity issue. |
| `327:254324` editor | campaign-editor | Two columns retained, workflow strip missing, extra section; finding 3. |
| `327:255883` preview | campaign-preview | Desktop/phone toggles, contact selector, email canvas and close action retained; fixture content deliberately differs. Phone toggle not separately captured. |
| `327:256420` sender | campaign-sender | Step 3, summary and sender table fields retained; quota period uses approved 3-day rule. No account selection/save. |
| `327:257674` schedule | campaign-schedule | Step 4, summary, send-mode radios, two date/time fields and 3-field rate/window row retained. Native browser date/time chrome accepted; no schedule calculation. |
| `327:258992` confirmation | campaign-confirm | Four-card review and preview retained; verification metadata differences, finding 4. |
| `327:241209`, `327:241792` campaigns | campaign-list → Xem | Main five table columns and actual summary modal retained. Full 9-status example matrix not proven with two campaigns. |
| `156:32271` employee home | home | Shell/title retained; real notification workload replaces Figma transient login-success notice. Different lifecycle state, not a static layout defect. |

## Impeccable design assessment

Design specificity is strong: B2B search/filter, approval, campaign staging and Response/Follow-up language fit the actual jobs. The dark operational shell, constrained palette and repeated form patterns support scanning. The strongest parts are template form grouping, criteria panels and the campaign review structure. The gaps reduce confidence at exactly the decision points: missing audit summary while reviewing Contacts, missing step context while composing, and incomplete review metadata before confirmation.

Nielsen scores below are 0–4 severity (0 no issue observed, 4 critical), scoped to this read-only desktop inspection; they are not a calculated overall fidelity percentage.

| Heuristic | Severity | Basis/limit |
|---|---:|---|
| System status | 2 | Campaign strip missing in editor; some state/sample variants not exercised. |
| Match with real world | 1 | Domain terms and phases mostly clear. |
| User control/freedom | 2 | Reply has no explicit Hủy; no send performed. |
| Consistency/standards | 2 | Reply grouping and confirmation composition diverge. Approved action conventions excluded. |
| Error prevention | n/a | No mutations/invalid submissions tested by A. |
| Recognition over recall | 2 | Contact review removes source/criteria/count context. |
| Flexibility/efficiency | 2 | Reply template affordance missing. |
| Aesthetic/minimalist design | 1 | Core grid is coherent; extra editor save-template section creates competing task. |
| Error recognition/recovery | n/a | Error/success/network state variants not triggered in A. |
| Help/documentation | 1 | Inline explanations mostly present; full help not in scope. |

Cognitive load: multiple visible source/filter options are expected in the criteria task and grouped well. The editor simultaneously exposes formatting, four block types, four insert tools and save-as-template; these are grouped but the missing step strip weakens orientation. Emotional journey: ordinary browsing is stable; assurance is weaker at Contact acceptance and final campaign review because provenance/verification rows are missing. Primary persona risk is an employee reviewing a large imported list without seeing rejected/duplicate counts and criteria, not the number of sample rows.

Questions skipped: parent owns BA reconciliation and final combined report; A does not ask the user independently.

Not checked: destructive actions, email sending, real search/credits, save validation/error states, mobile/breakpoints, keyboard/screen reader behavior, or all 196 state variants. No source changes were made; fixture cleanup remains with root. No pixel-perfect claim or arbitrary match percentage.
