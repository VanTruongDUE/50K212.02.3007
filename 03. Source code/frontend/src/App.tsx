import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import Flow from './Flow'
import NextFlows from './NextFlows'
import ManagerFlows from './ManagerFlows'
import LiveFlows from './LiveFlows'
import { api } from './api'
import './styles.css'

const preview = new URLSearchParams(location.search).get('preview')
type Errors = { email?: string; password?: string }
type Role = 'employee' | 'manager'
type Account = { id: string; email: string; role: Role }
const demoRoute = import.meta.env.DEV && preview !== null
const legacyLiveRoutes: Record<string, string> = {
  'history-detail': 'history', 'history-empty': 'history', 'history-load-error': 'history',
  results: 'criteria', searching: 'criteria', 'search-empty': 'criteria', 'search-error': 'criteria',
  'apollo-empty': 'criteria', 'apollo-unavailable': 'criteria', review: 'criteria',
  'review-error': 'criteria', 'review-recording': 'criteria', 'review-success': 'criteria',
  'criteria-check-error': 'criteria', 'criteria-checking': 'criteria',
  'data-unavailable': 'criteria', 'load-error': 'criteria', 'save-error': 'criteria',
  'check-save-error': 'check', 'confirm-error': 'confirm',
  'export-loading': 'export', 'export-error': 'export',
  'template-empty': 'templates', 'template-load-error': 'templates', 'template-created': 'templates',
  'template-name-missing': 'template-create', 'template-name-duplicate': 'template-create', 'template-save-error': 'template-create',
  'response-empty': 'response-list', 'response-load-error': 'response-list', 'response-access-denied': 'response-list',
  'followup-duplicate': 'followup-create', 'followup-optout': 'followup-create',
  'followup-chain': 'followup-list',
}

function Brand() {
  return <span className="brand"><svg width="36" height="40" viewBox="0 0 36 40" aria-hidden="true"><path d="M5.34513 0H35.9646V9.9115H28.708C23.3982 9.9115 18.7965 6.19469 15.4336 4.42478C10.6549 1.9469 8.53098 2.65487 9.06195 6.37168C9.76991 9.9115 13.4867 14.5133 17.3805 17.6991H34.1947C35.3746 17.6991 35.9646 18.2891 35.9646 19.469V34.6903C35.9646 38.2301 34.1947 40 30.6549 40H0.0354004V30.0885H5.69912C11.1858 30.0885 14.3717 32.5664 17.9115 34.6903C23.0443 37.6991 26.4071 38.2301 26.9381 36.1062C28 33.2743 23.5752 27.7876 18.7965 22.3009H0.0354004V5.66372C0.0354004 1.88791 1.80531 0 5.34513 0Z" fill="#8FBDFF" /></svg><strong>V5 Marketing</strong></span>
}

function Login({ onSuccess }: { onSuccess: (email: string, role: Role) => void }) {
  const filled = ['filled', 'credentials', 'role', 'loading', 'missing-password'].includes(preview ?? '')
  const [email, setEmail] = useState(preview === 'invalid-email' ? 'minhanh@' : filled ? 'minhanh@example.com' : '')
  const [password, setPassword] = useState((filled && preview !== 'missing-password') || preview === 'missing-email' ? 'matkhau123456' : '')
  const [errors, setErrors] = useState<Errors>(
    preview === 'empty-errors' ? { email: 'Vui lòng nhập email.', password: 'Vui lòng nhập mật khẩu.' } :
    preview === 'missing-email' ? { email: 'Vui lòng nhập email.' } :
    preview === 'missing-password' ? { password: 'Vui lòng nhập mật khẩu.' } :
    preview === 'invalid-email' ? { email: 'Email không đúng định dạng.\nVui lòng kiểm tra lại.' } : {},
  )
  const [authError, setAuthError] = useState(preview === 'credentials' || preview === 'role' ? preview : '')
  const [loading, setLoading] = useState(preview === 'loading')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const next: Errors = {}
    if (!email.trim()) next.email = 'Vui lòng nhập email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Email không đúng định dạng.\nVui lòng kiểm tra lại.'
    if (!password) next.password = 'Vui lòng nhập mật khẩu.'
    setErrors(next)
    setAuthError('')
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.getElementById(next.email ? 'email' : 'password')?.focus())
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email: email.trim(), password }) })
      if (!response.ok) {
        if (response.status === 400) {
          const body = await response.json() as { message?: { errors?: Errors } }
          setErrors(body.message?.errors ?? {})
        } else setAuthError(response.status === 403 ? 'role' : response.status === 401 ? 'credentials' : 'network')
        return
      }
      const account = await response.json() as Account
      onSuccess(account.email, account.role)
    } catch { setAuthError('network') }
    finally { setLoading(false) }
  }

  return <main className="login-page">
    <header className="login-brand"><Brand /></header>
    <form className="login-form" onSubmit={submit} noValidate>
      <div className="login-heading"><h1>Đăng nhập</h1><p>{loading ? 'Đang xác thực tài khoản và thiết lập\nphiên đăng nhập.' : 'Đăng nhập bằng tài khoản được cấp.'}</p></div>
      {authError && <div className="auth-error" role="alert"><strong>{authError === 'role' ? 'Không thể xác định quyền truy cập\ncủa tài khoản.' : authError === 'network' ? 'Không thể kết nối máy chủ.' : 'Email hoặc mật khẩu không đúng.'}</strong><span>{authError === 'role' ? 'Liên hệ người quản lý tài khoản để kiểm tra\nthông tin nhân viên và quyền truy cập.' : authError === 'network' ? 'Kiểm tra kết nối rồi thử đăng nhập lại.' : 'Kiểm tra lại email và mật khẩu rồi đăng nhập lại.'}</span></div>}
      <div className="field-group">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" placeholder="Nhập email" value={email} disabled={loading} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} onChange={e => { setEmail(e.target.value); setErrors(x => ({ ...x, email: undefined })); setAuthError('') }} />
        {errors.email && <span className="field-error" id="email-error" role="alert">{errors.email}</span>}
      </div>
      <div className="field-group">
        <label htmlFor="password">Mật khẩu</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} disabled={loading} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} onChange={e => { setPassword(e.target.value); setErrors(x => ({ ...x, password: undefined })); setAuthError('') }} />
        {errors.password && <span className="field-error" id="password-error" role="alert">{errors.password}</span>}
      </div>
      <button className="login-button" type="submit" disabled={loading}>{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
    <aside className="workplace"><img src="/workplace.jpg" alt="Đội ngũ đang làm việc cùng nhau trong văn phòng" /><div className="workplace-caption"><h2>Tìm kiếm &amp; tiếp cận<br />khách hàng B2B</h2><p>Không gian làm việc của đội ngũ Marketing.</p></div></aside>
  </main>
}

type Icon = 'home' | 'search' | 'check' | 'list' | 'campaign' | 'response' | 'follow' | 'key' | 'managerKey'
function NavItem({ icon, children, heading = false, active = false, expanded, onClick }: { icon: Icon; children: React.ReactNode; heading?: boolean; active?: boolean; expanded?: boolean; onClick?: () => void }) {
  const content = <><img width="20" height="20" src={'/icons/' + icon + '.svg'} alt="" /><span>{children}</span></>
  const className = 'nav-item' + (heading ? ' nav-heading' : '') + (active ? ' active' : '')
  return onClick ? <button className={className} type="button" aria-current={active && !heading ? 'page' : undefined} aria-expanded={expanded} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>
}

function Home({ manager, screen, go, accountEmail, onLogout, live }: { manager: boolean; screen: string; go: (screen: string) => void; accountEmail: string; onLogout: () => Promise<void>; live: boolean }) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [logoutError, setLogoutError] = useState(false)
  const [overview, setOverview] = useState<{ campaigns: number; emails_sent: number; responses: number; open_responses: number; due_followups: number; active_sender_accounts: number } | null>(null)
  const [notifications, setNotifications] = useState<{ type: string; title: string }[]>([])
  const [overviewError, setOverviewError] = useState('')
  useEffect(() => {
    if (!live || screen !== 'home') return
    let active = true
    Promise.all([manager ? api<typeof overview>('dashboard?period=week') : Promise.resolve(null), api<{ type: string; title: string }[]>('notifications')])
      .then(([summary, items]) => { if (active) { setOverview(summary); setNotifications(items); setOverviewError('') } })
      .catch(() => { if (active) setOverviewError('Không thể tải dữ liệu trang chính. Vui lòng tải lại trang.') })
    return () => { active = false }
  }, [live, screen, manager])
  useLayoutEffect(() => {
    const page = workspaceRef.current?.lastElementChild
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = page.animate(
      [{ opacity: 0.88, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(.16, 1, .3, 1)' },
    )
    return () => animation.cancel()
  }, [screen])
  const criteriaActive = ['criteria', 'criteria-adjust', 'criteria-invalid', 'criteria-checking', 'criteria-check-error', 'review', 'review-recording', 'review-success', 'review-error', 'searching', 'results', 'search-empty', 'search-error', 'apollo-unavailable', 'apollo-empty'].includes(screen)
  const contactActive = ['contact-lists', 'contact-list-detail', 'check', 'check-save-error', 'check-rejected', 'confirm', 'confirm-error', 'confirmed', 'all-contacts', 'export', 'export-loading', 'export-success', 'export-error'].includes(screen)
  const searchExpanded = criteriaActive || screen.startsWith('template') || screen.startsWith('history')
  const managerAccountExpanded = screen.startsWith('manager-account')
  const managerAccountCheckActive = screen.startsWith('manager-account-check') || screen.startsWith('manager-account-result')
  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand-home" type="button" aria-label="Về trang chính" onClick={() => go('home')}><Brand /></button>
      <nav aria-label="Menu chính">
        {manager ? <>
          <NavItem icon="home" active={screen === 'home'} onClick={() => go('home')}>Trang chính</NavItem>
          <NavItem icon="check" active={screen.startsWith('manager-review')} onClick={() => go('manager-review')}>Kiểm tra danh sách Contact</NavItem>
          <NavItem icon="managerKey" heading active={managerAccountExpanded} expanded={managerAccountExpanded} onClick={() => go('manager-account-check')}>Tài khoản gửi</NavItem>
          <div className={'subnav' + (managerAccountExpanded ? '' : ' collapsed')} aria-hidden={!managerAccountExpanded} inert={!managerAccountExpanded}>
            <div className="subnav-items">
              <button className={managerAccountCheckActive ? 'active' : ''} type="button" aria-current={managerAccountCheckActive ? 'page' : undefined} onClick={() => go('manager-account-check')}>Kiểm tra tài khoản gửi</button>
              <button className={managerAccountExpanded && !managerAccountCheckActive ? 'active' : ''} type="button" aria-current={managerAccountExpanded && !managerAccountCheckActive ? 'page' : undefined} onClick={() => go('manager-account-list')}>Danh sách tài khoản gửi</button>
            </div>
          </div>
        </> : <>
          <NavItem icon="search" heading expanded={searchExpanded} onClick={() => go('criteria')}>Tìm kiếm Contact</NavItem>
          <div className={'subnav' + (searchExpanded ? '' : ' collapsed')} aria-hidden={!searchExpanded} inert={!searchExpanded}>
            <div className="subnav-items">
              <button className={criteriaActive ? 'active' : ''} type="button" aria-current={criteriaActive ? 'page' : undefined} onClick={() => go('criteria')}>Thiết lập tiêu chí</button>
              <button className={screen.startsWith('template') ? 'active' : ''} type="button" aria-current={screen.startsWith('template') ? 'page' : undefined} onClick={() => go('templates')}>Filter Template</button>
              <button className={screen.startsWith('history') ? 'active' : ''} type="button" aria-current={screen.startsWith('history') ? 'page' : undefined} onClick={() => go('history')}>Lịch sử tìm kiếm</button>
            </div>
          </div>
          <NavItem icon="list" active={contactActive} onClick={() => go('contact-lists')}>Danh sách Contact</NavItem>
          <NavItem icon="campaign" active={screen.startsWith('campaign-')} onClick={() => go('campaign-list')}>Chiến dịch</NavItem>
          <NavItem icon="response" active={screen.startsWith('response-')} onClick={() => go('response-list')}>Response</NavItem>
          <NavItem icon="follow" active={screen.startsWith('followup-')} onClick={() => go('followup-list')}>Follow-up</NavItem>
          <NavItem icon="key" active={screen === 'sender-list'} onClick={() => go('sender-list')}>Tài khoản gửi</NavItem>
        </>}
      </nav>
    </aside>
    <div className="workspace" ref={workspaceRef}>
      <header className="topbar">
        <span>Hệ thống tìm kiếm &amp; tiếp cận khách hàng B2B</span>
        <button className="account account-button" type="button" onClick={() => go('profile')} aria-label="Xem thông tin tài khoản">
          <img width="20" height="20" src="/icons/user.svg" alt="" />
          {manager ? 'Trưởng phòng Marketing' : 'Nhân viên Marketing'}
        </button>
      </header>
      {screen === 'home' ? <section className="home-content">
        <h1>Trang chính</h1>
        <div className="success-panel"><strong>{live ? manager ? 'Tổng quan 7 ngày gần nhất' : 'Công việc cần theo dõi' : 'Đăng nhập thành công'}</strong>{!live ? <span>Chọn chức năng trong menu để bắt đầu làm việc.</span> : overviewError ? <span role="alert">{overviewError}</span> : <><span>{manager && overview ? `${overview.campaigns} chiến dịch · ${overview.emails_sent} email đã gửi · ${overview.open_responses} Response chưa xử lý · ${overview.due_followups} Follow-up đến hạn · ${overview.active_sender_accounts} tài khoản gửi hoạt động` : !manager ? notifications.length ? `${notifications.length} thông báo cần theo dõi.` : 'Chưa có thông báo cần xử lý.' : 'Đang tải dữ liệu…'}</span>{notifications.map((item, index) => <span key={`${item.type}-${index}`}>{item.title}</span>)}</>}</div>
      </section> : screen === 'profile' ? <section className="profile-page"><nav className="profile-crumb"><button type="button" onClick={() => go('home')}>Trang chính</button><span>›</span><span>Thông tin tài khoản</span></nav><div className="profile-panel"><h1>Thông tin tài khoản</h1><dl>{accountEmail && <div><dt>Email</dt><dd>{accountEmail}</dd></div>}<div><dt>Vai trò</dt><dd>{manager ? 'Trưởng phòng Marketing' : 'Nhân viên Marketing'}</dd></div><div><dt>Không gian làm việc</dt><dd>V5 Marketing</dd></div></dl><button type="button" onClick={() => { setLogoutError(false); void onLogout().catch(() => setLogoutError(true)) }}>Đăng xuất</button>{logoutError && <p role="alert">Không thể đăng xuất. Vui lòng thử lại.</p>}</div></section> : live && ['criteria', 'criteria-adjust', 'criteria-invalid'].includes(screen) ? <Flow screen={screen} go={go} searchUnavailable /> : live ? <LiveFlows screen={screen} go={go} manager={manager} /> : manager && screen.startsWith('manager-') ? <ManagerFlows screen={screen} go={go} /> : /^(campaign|response|followup)-/.test(screen) ? <NextFlows screen={screen} go={go} /> : <Flow screen={screen} go={go} />}
    </div>
  </main>
}

function App() {
  const [screen, setScreen] = useState(() => new URLSearchParams(location.search).get('screen') ?? (preview === 'employee' || preview === 'manager' ? 'home' : 'login'))
  const [accountEmail, setAccountEmail] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [role, setRole] = useState<Role>(() => preview === 'manager' || new URLSearchParams(location.search).get('role') === 'manager' ? 'manager' : 'employee')
  const [authReady, setAuthReady] = useState(false)
  const manager = role === 'manager'
  const go = useCallback((next: string, nextRole = role) => {
    if (screen === next && new URLSearchParams(location.search).get('screen') === next) return
    if (next === 'login') { setAccountEmail(''); setRole('employee'); setSignedOut(true) }
    setScreen(next)
    const query = next === 'login' ? '' : '?screen=' + encodeURIComponent(next) + (nextRole === 'manager' ? '&role=manager' : '')
    history.pushState(null, '', location.pathname + query)
  }, [role, screen])
  useEffect(() => {
    const onPop = () => setScreen(new URLSearchParams(location.search).get('screen') ?? 'login')
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) return
        const account = await response.json() as Account
        if (active) { setAccountEmail(account.email); setRole(account.role); setSignedOut(false); setScreen(current => current === 'login' ? 'home' : current) }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setAuthReady(true) })
    return () => { active = false }
  }, [])
  const liveScreen = accountEmail && preview === null ? legacyLiveRoutes[screen] ?? (screen.includes('--') ? legacyLiveRoutes[screen.split('--')[0]] ?? screen.split('--')[0] : screen) : screen
  const routeAllowed = ['login', 'home', 'profile'].includes(liveScreen) || liveScreen.startsWith('manager-') === manager
  const allowedScreen = (signedOut || (!accountEmail && !demoRoute)) && liveScreen !== 'login' ? 'login' : routeAllowed ? liveScreen : 'home'
  useEffect(() => {
    if (!authReady && !demoRoute) return
    if (screen === allowedScreen) return
    history.replaceState(null, '', location.pathname + (allowedScreen === 'login' ? '' : '?screen=' + encodeURIComponent(allowedScreen) + (manager ? '&role=manager' : '')))
  }, [screen, allowedScreen, manager, authReady])
  if (!authReady && !demoRoute) return <main className="login-page"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>
  return screen === 'login' || allowedScreen === 'login' ? <Login onSuccess={(email, accountRole) => { setAccountEmail(email); setRole(accountRole); setSignedOut(false); go('home', accountRole) }} /> : <Home manager={manager} screen={allowedScreen} go={go} live={!!accountEmail && preview === null} accountEmail={accountEmail} onLogout={async () => { const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); if (!response.ok) throw new Error('Logout failed'); go('login') }} />
}
export default App
