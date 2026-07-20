import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendBaseUrl: () => ipcRenderer.invoke('get-backend-base-url'),
  sendWindowAction: (action: 'minimize' | 'close' | 'hide') => ipcRenderer.send('window-action', action),
  startDictation: () => ipcRenderer.send('start-dictation'),
  stopDictation: () => ipcRenderer.send('stop-dictation'),
  cancelDictation: () => ipcRenderer.send('cancel-dictation'),
  completeDictation: (data: { text: string; duration: number; app: string }) => ipcRenderer.send('dictation-complete', data),
  floatingReady: () => ipcRenderer.send('floating-renderer-ready'),
  onTrayPauseToggle: (callback: (isPaused: boolean) => void) => {
    const subscription = (_event: any, isPaused: boolean) => callback(isPaused)
    ipcRenderer.on('tray-pause-toggle', subscription)
    return () => ipcRenderer.removeListener('tray-pause-toggle', subscription)
  },
  onNavigateTo: (callback: (page: string) => void) => {
    const subscription = (_event: any, page: string) => callback(page)
    ipcRenderer.on('navigate-to', subscription)
    return () => ipcRenderer.removeListener('navigate-to', subscription)
  },
  onGlobalShortcutStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('global-shortcut-start', subscription)
    return () => ipcRenderer.removeListener('global-shortcut-start', subscription)
  },
  onGlobalShortcutStop: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('global-shortcut-stop', subscription)
    return () => ipcRenderer.removeListener('global-shortcut-stop', subscription)
  },
  onDictationCompleted: (callback: (data: { text: string; duration: number; app: string }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('dictation-completed-event', subscription)
    return () => ipcRenderer.removeListener('dictation-completed-event', subscription)
  },
  onDictationCancelled: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('dictation-cancelled-event', subscription)
    return () => ipcRenderer.removeListener('dictation-cancelled-event', subscription)
  },
  isElectron: true
})
