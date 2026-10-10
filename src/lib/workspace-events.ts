export const WORKSPACE_CHANGED = 'layout-assistant:workspace-changed'
export function notifyWorkspaceChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WORKSPACE_CHANGED))
}
