import { useEffect, useRef } from 'react'
export function FolderDialog({ name, error, onNameChange, onSubmit, onClose }: {
  name: string; error: string; onNameChange: (name: string) => void; onSubmit: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => { if (typeof dialog.close === 'function') dialog.close() }
  }, [])
  return (
    <dialog ref={ref} className="folder-dialog" aria-labelledby="folder-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
        <header><h2 id="folder-dialog-title">新建文件夹</h2><button type="button" aria-label="关闭新建文件夹" onClick={onClose}>×</button></header>
        <label>文件夹名称<input autoFocus maxLength={60} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="例如：论文图片" /></label>
        {error && <p className="backup-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={!name.trim()}>创建文件夹</button></footer>
      </form>
    </dialog>
  )
}
