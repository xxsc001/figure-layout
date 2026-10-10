import { useState } from 'react'
import { useWorkspaceBackupStatus } from '../hooks/useWorkspaceBackup'
import { backupWorkspace, restoreWorkspace } from '../lib/workspace-backup'
import { selectBackupDirectory } from '../lib/folder-backup'
import { useBackupSettings } from '../hooks/useBackupSettings'

export function GeneralSettingsPage() {
  const backup = useBackupSettings()
  const sync = useWorkspaceBackupStatus()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const restore = async () => {
    setActionError('')
    setBusy(true)
    try {
      const root = await selectBackupDirectory()
      await restoreWorkspace(root)
      await backup.refreshSettings()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError(error instanceof Error ? error.message : '恢复失败。')
    } finally { setBusy(false) }
  }
  const syncNow = async () => {
    setBusy(true)
    setActionError('')
    try { await backupWorkspace(); await backup.refreshSettings() }
    catch (error) { setActionError(error instanceof Error ? error.message : '备份失败。') }
    finally { setBusy(false) }
  }
  const working = busy || sync.state === 'writing' || sync.state === 'restoring'
  const backupActive = backup.enabled && backup.permission === 'granted'
  const status = !backup.supported
    ? '当前环境不支持'
    : backup.permission !== 'granted' && backup.rootFolderName
      ? '需要重新授权'
      : backupActive
        ? '自动备份已开启'
        : '自动备份已暂停'

  return (
    <div className="dashboard-page settings-page">
      <header className="dashboard-page-header">
        <div>
          <span>GENERAL SETTINGS</span>
          <h1>通用设置</h1>
          <p>管理所有工程共用的本地备份位置。</p>
        </div>
      </header>

      <section className="settings-card" aria-labelledby="backup-settings-title">
        <div className="settings-card-heading">
          <div className="settings-card-icon" aria-hidden="true">⌂</div>
          <div>
            <h2 id="backup-settings-title">自动备份文件夹</h2>
            <p>自动保存全部工程、常用样式和文件夹分类，清理浏览器后可从目录恢复。</p>
          </div>
          <span className={`settings-status${backupActive ? ' is-enabled' : ''}`}>
            <i />{status}
          </span>
        </div>

        {!backup.loaded ? (
          <div className="settings-loading">正在读取备份设置…</div>
        ) : !backup.supported ? (
          <div className="settings-warning">
            <strong>需要 HTTPS 和最新版 Chrome / Edge</strong>
            <p>当前环境仍可使用浏览器工程库和全部手动导出功能。</p>
          </div>
        ) : (
          <>
            <div className="settings-folder-row">
              <div>
                <span>当前文件夹</span>
                <strong>{backup.rootFolderName ?? '尚未选择'}</strong>
                <small>
                  {backup.lastBackupAt
                    ? `最近写入：${new Date(backup.lastBackupAt).toLocaleString('zh-CN')}`
                    : '选择后自动备份全部工程，日常修改会持续更新。'}
                </small>
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={working}
                onClick={() => void backup.selectFolder()}
              >
                {backup.rootFolderName ? '更换文件夹' : '选择文件夹'}
              </button>
            </div>

            <div className="workspace-backup-actions">
              <button type="button" className="secondary-button" disabled={working || !backupActive} onClick={() => void syncNow()}>立即更新备份</button>
              <button type="button" className="primary-button" disabled={working} onClick={() => void restore()}>一键恢复备份</button>
            </div>
            <p className="muted-copy">恢复时选择原备份目录；同一工程不会重复导入，浏览器中较新的版本会保留。</p>
            {sync.message && <p className={sync.state === 'error' ? 'settings-error' : 'muted-copy'} role={sync.state === 'error' ? 'alert' : 'status'}>{sync.message}</p>}
            {actionError && <p className="settings-error" role="alert">{actionError}</p>}
            {backup.error && <p className="settings-error" role="alert">{backup.error}</p>}

            {backup.rootFolderName && (
              <div className="settings-actions">
                {backup.permission !== 'granted' ? (
                  <button type="button" disabled={working} onClick={() => void backup.reauthorize()}>
                    重新授权
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void backup.setEnabled(!backup.enabled)}
                  >
                    {backup.enabled ? '暂停自动备份' : '继续自动备份'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="settings-path-example">
          <span>文件结构</span>
          <code>{`layout-assistant-backup.json\n工程名-工程ID/\n├─ latest.figgrid\n└─ history/ 最近 10 份历史快照`}</code>
        </div>
        <ul className="settings-notes">
          <li>修改后约 2–3 秒自动更新备份，保持页面打开直到写入完成。</li>
          <li>历史快照最多每 5 分钟生成一次。</li>
          <li>首次启用会备份全部已有工程，之后只更新变化的工程。</li>
          <li>清理网站数据后，点击“一键恢复备份”并重新选择原备份目录。</li>
        </ul>
      </section>
    </div>
  )
}
