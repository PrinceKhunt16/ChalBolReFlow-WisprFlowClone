const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:48763'

export async function resolveBackendBaseUrl() {
  if (window.electronAPI?.getBackendBaseUrl) {
    try {
      return await window.electronAPI.getBackendBaseUrl()
    } catch (error) {
      console.warn('Falling back to the default backend URL.', error)
    }
  }

  const viteBackendUrl = (import.meta as any).env?.VITE_BACKEND_URL
  return viteBackendUrl || DEFAULT_BACKEND_BASE_URL
}