import type { ReactNode } from 'react'

interface DashboardShellProps {
  active: 'projects' | 'settings'
  children: ReactNode
  onNavigate: (page: 'landing' | 'projects' | 'settings') => void
}

export function DashboardShell({
  active,
  children,
  onNavigate,
}: DashboardShellProps) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-mobile-blocker">
        <strong>请在电脑上管理论文图片工程</strong>
        <span>工程中心针对 1024px 以上的桌面屏幕设计。</span>
      </div>
      <aside className="dashboard-sidebar">
        <button
          type="button"
          className="dashboard-brand"
          onClick={() => onNavigate('landing')}
          aria-label="返回网站首页"
        >
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span>
            <strong>论文图片排版助手</strong>
            <small>本地科研多面板排图</small>
          </span>
        </button>
        <nav aria-label="工程中心导航">
          <button
            type="button"
            className={active === 'projects' ? 'is-active' : ''}
            onClick={() => onNavigate('projects')}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">▦</span>
            我的工程
          </button>
          <button
            type="button"
            className={active === 'settings' ? 'is-active' : ''}
            onClick={() => onNavigate('settings')}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">⚙</span>
            通用设置
          </button>
        </nav>
        <div className="dashboard-sidebar-footer">
          <span><i /> 本地运行</span>
          <small>图片不会上传到服务器</small>
        </div>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  )
}
