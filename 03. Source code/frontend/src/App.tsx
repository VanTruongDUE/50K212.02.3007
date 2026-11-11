import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import Flow from './Flow'
import NextFlows from './NextFlows'
import './styles.css'

const preview = new URLSearchParams(location.search).get('preview')
type Errors = { email?: string; password?: string }

function Brand() {
  return <span className="brand"><svg width="36" height="40" viewBox="0 0 36 40" aria-hidden="true"><path d="M5.34513 0H35.9646V9.9115H28.708C23.3982 9.9115 18.7965 6.19469 15.4336 4.42478C10.6549 1.9469 8.53098 2.65487 9.06195 6.37168C9.76991 9.9115 13.4867 14.5133 17.3805 17.6991H34.1947C35.3746 17.6991 35.9646 18.2891 35.9646 19.469V34.6903C35.9646 38.2301 34.1947 40 30.6549 40H0.0354004V30.0885H5.69912C11.1858 30.0885 14.3717 32.5664 17.9115 34.6903C23.0443 37.6991 26.4071 38.2301 26.9381 36.1062C28 33.2743 23.5752 27.7876 18.7965 22.3009H0.0354004V5.66372C0.0354004 1.88791 1.80531 0 5.34513 0Z" fill="#8FBDFF" /></svg><strong>V5 Marketing</strong></span>
}

function Login({ onSuccess }: { onSuccess: () => void }) {
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

  function submit(event: FormEvent<HTMLFormElement>) {
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
    // Giai đoạn FE: chuyển sang trang chính bằng trạng thái cục bộ.
    setLoading(true)
    window.setTimeout(onSuccess, 700)
  }

  return <main className="login-page">
    <header className="login-brand"><Brand /></header>
    <form className="login-form" onSubmit={submit} noValidate>
      <div className="login-heading"><h1>Đăng nhập</h1><p>{loading ? 'Đang xác thực tài khoản và thiết lập\nphiên đăng nhập.' : 'Đăng nhập bằng tài khoản được cấp.'}</p></div>
      {authError && <div className="auth-error" role="alert"><strong>{authError === 'role' ? 'Không thể xác định quyền truy cập\ncủa tài khoản.' : 'Email hoặc mật khẩu không đúng.'}</strong><span>{authError === 'role' ? 'Liên hệ người quản lý tài khoản để kiểm tra\nthông tin nhân viên và quyền truy cập.' : 'Kiểm tra lại email và mật khẩu rồi đăng nhập lại.'}</span></div>}
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
  return onClick ? <button className={className} type="button" aria-current={active ? 'page' : undefined} aria-expanded={expanded} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>
}

function Home({ manager, screen, go }: { manager: boolean; screen: string; go: (screen: string) => void }) {
  const workspaceRef = useRef<HTMLDivElement>(null)
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
  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand-home" type="button" aria-label="Về trang chính" onClick={() => go('home')}><Brand /></button>
      <nav aria-label="Menu chính">
        {manager ? <>
          <NavItem icon="home" active={screen === 'home'} onClick={() => go('home')}>Trang chính</NavItem>
          <NavItem icon="check">Kiểm tra danh sách</NavItem>
          <NavItem icon="managerKey">Tài khoản gửi</NavItem>
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
          <NavItem icon="key">Tài khoản gửi</NavItem>
        </>}
      </nav>
    </aside>
    <div className="workspace" ref={workspaceRef}>
      <header className="topbar">
        <span>Hệ thống tìm kiếm &amp; tiếp cận khách hàng B2B</span>
        <span className="account">
          <img width="20" height="20" src="/icons/user.svg" alt="" />
          {manager ? 'Trưởng phòng Marketing' : 'Nhân viên Marketing'}
        </span>
      </header>
      {screen === 'home' ? <section className="home-content">
        <h1>Trang chính</h1>
        <div className="success-panel"><strong>Đăng nhập thành công</strong><span>Chọn chức năng trong menu để bắt đầu làm việc.</span></div>
      </section> : /^(campaign|response|followup)-/.test(screen) ? <NextFlows screen={screen} go={go} /> : <Flow screen={screen} go={go} />}
    </div>
  </main>
}

function App() {
  const [screen, setScreen] = useState(() => new URLSearchParams(location.search).get('screen') ?? (preview === 'employee' || preview === 'manager' ? 'home' : 'login'))
  const manager = preview === 'manager' || new URLSearchParams(location.search).get('role') === 'manager'
  const go = useCallback((next: string) => {
    if (new URLSearchParams(location.search).get('screen') === next) return
    setScreen(next)
    const query = next === 'login' ? '' : '?screen=' + encodeURIComponent(next) + (manager ? '&role=manager' : '')
    history.pushState(null, '', location.pathname + query)
  }, [manager])
  useEffect(() => {
    const onPop = () => setScreen(new URLSearchParams(location.search).get('screen') ?? 'login')
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])
  return screen === 'login' ? <Login onSuccess={() => go('home')} /> : <Home manager={manager} screen={screen} go={go} />
}
export default App
