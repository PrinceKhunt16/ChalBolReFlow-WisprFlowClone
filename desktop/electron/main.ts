import { app, BrowserWindow, systemPreferences, ipcMain, Tray, Menu, nativeImage, screen, globalShortcut, clipboard, dialog } from 'electron'
import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let mainWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isPaused = false
let isFloatingReady = false
let isFloatingRendererReady = false
let isMainReady = false
let pendingDictationCompletion: { text: string; duration: number; app: string } | null = null
let pendingDictationTargetAppName: string | null = null
let pendingFloatingStart = false
let backendProcess: ChildProcessByStdio<null, Readable, Readable> | null = null
let backendLogStream: fs.WriteStream | null = null
let backendBaseUrl = ''
let isShuttingDown = false

type SharedAppConfig = {
  backendHost: string
  backendPort: number
}

const DEFAULT_SHARED_CONFIG: SharedAppConfig = {
  backendHost: '127.0.0.1',
  backendPort: 48763,
}

function resolveWorkspaceRoot() {
  return path.resolve(process.env.APP_ROOT || path.join(__dirname, '..'), '..')
}

function resolveSharedConfigPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-config.json')
    : path.join(resolveWorkspaceRoot(), 'app-config.json')
}

function loadSharedAppConfig(): SharedAppConfig {
  try {
    const raw = fs.readFileSync(resolveSharedConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<SharedAppConfig>
    return {
      backendHost: parsed.backendHost || DEFAULT_SHARED_CONFIG.backendHost,
      backendPort: Number(parsed.backendPort || DEFAULT_SHARED_CONFIG.backendPort),
    }
  } catch {
    return DEFAULT_SHARED_CONFIG
  }
}

function getBackendDataDir() {
  return path.join(app.getPath('userData'), 'backend-data')
}

function getBackendLogPath() {
  return path.join(app.getPath('userData'), 'logs', 'backend.log')
}

function getPackagedBackendExecutable() {
  const executableName = process.platform === 'win32' ? 'chalbolreflow-backend.exe' : 'chalbolreflow-backend'
  return path.join(process.resourcesPath, 'backend', executableName)
}

function ensureLogStream() {
  const logPath = getBackendLogPath()
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  if (!backendLogStream) {
    backendLogStream = fs.createWriteStream(logPath, { flags: 'a' })
  }
}

function writeBackendLog(message: string) {
  ensureLogStream()
  backendLogStream?.write(`${new Date().toISOString()} ${message}\n`)
}

function logMain(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[main] ${message}`)
  } else {
    console.log(`[main] ${message}`, details)
  }
}

function findFreePort(host: string) {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()

    server.unref()
    server.on('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === 'object' && address && 'port' in address) {
          resolve(address.port)
        } else {
          reject(new Error('Unable to resolve a free backend port.'))
        }
      })
    })
  })
}

function isPortAvailable(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()

    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

async function resolveBackendPort(preferredPort: number, host: string) {
  const available = await isPortAvailable(preferredPort, host)
  return available ? preferredPort : await findFreePort(host)
}

async function waitForBackendReady(url: string, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/v1/health`)
      if (response.ok) {
        return
      }
    } catch {
      // keep waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  throw new Error(`Backend did not become ready within ${timeoutMs}ms.`)
}

async function startBackend() {
  const sharedConfig = loadSharedAppConfig()
  const backendHost = process.env.CBR_BACKEND_HOST || sharedConfig.backendHost
  const preferredPort = Number(process.env.CBR_BACKEND_PORT || sharedConfig.backendPort)
  const resolvedPort = await resolveBackendPort(preferredPort, backendHost)

  backendBaseUrl = `http://${backendHost}:${resolvedPort}`

  fs.mkdirSync(getBackendDataDir(), { recursive: true })
  ensureLogStream()

  const commonEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    CBR_BACKEND_HOST: backendHost,
    CBR_BACKEND_PORT: String(resolvedPort),
    CBR_DATA_DIR: getBackendDataDir(),
    CBR_CONFIG_PATH: resolveSharedConfigPath(),
  }

  const backendCommand = app.isPackaged
    ? getPackagedBackendExecutable()
    : (process.platform === 'win32' ? 'python' : 'python3')
  const backendArgs = app.isPackaged
    ? ['--host', backendHost, '--port', String(resolvedPort)]
    : ['-m', 'app.serve', '--host', backendHost, '--port', String(resolvedPort)]
  const backendCwd = app.isPackaged
    ? path.dirname(getPackagedBackendExecutable())
    : path.join(resolveWorkspaceRoot(), 'backend')

  writeBackendLog(`Starting backend: ${backendCommand} ${backendArgs.join(' ')}`)
  writeBackendLog(`  cwd: ${backendCwd}`)
  writeBackendLog(`  port: ${resolvedPort} (preferred: ${preferredPort})`)
  logMain('startBackend:spawn', { backendCommand, backendArgs, backendCwd, resolvedPort, preferredPort })

  backendProcess = spawn(backendCommand, backendArgs, {
    cwd: backendCwd,
    env: commonEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout.on('data', (chunk) => writeBackendLog(`[stdout] ${chunk.toString().trimEnd()}`))
  backendProcess.stderr.on('data', (chunk) => writeBackendLog(`[stderr] ${chunk.toString().trimEnd()}`))
  backendProcess.once('exit', (code, signal) => {
    writeBackendLog(`backend exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    backendProcess = null
    if (!isShuttingDown) {
      dialog.showErrorBox(
        'ChalBolReFlow — Backend Error',
        `The backend process exited unexpectedly (code ${code ?? 'unknown'}).\n\nCheck the log at:\n${getBackendLogPath()}`
      )
      app.exit(code ?? 1)
    }
  })
  backendProcess.once('error', (error) => {
    const msg = error instanceof Error ? error.message : String(error)
    writeBackendLog(`backend failed to start: ${msg}`)
    dialog.showErrorBox(
      'ChalBolReFlow — Backend Error',
      `Could not start the backend process.\n\n${msg}\n\nCheck the log at:\n${getBackendLogPath()}`
    )
    app.exit(1)
  })

  try {
    await waitForBackendReady(backendBaseUrl)
    logMain('startBackend:ready', { backendBaseUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeBackendLog(`Backend readiness check failed: ${msg}`)
    dialog.showErrorBox(
      'ChalBolReFlow — Backend Timeout',
      `The backend did not become ready in time.\n\n${msg}\n\nCheck the log at:\n${getBackendLogPath()}`
    )
    await stopBackend()
    app.exit(1)
  }
}

async function stopBackend() {
  isShuttingDown = true

  if (backendProcess && !backendProcess.killed) {
    writeBackendLog('Sending SIGTERM to backend…')
    backendProcess.kill('SIGTERM')

    // Wait up to 5 seconds for graceful exit, then force-kill
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          writeBackendLog('Backend did not exit in 5 s — sending SIGKILL')
          backendProcess.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      backendProcess?.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  backendProcess = null
  backendLogStream?.end()
  backendLogStream = null
}

function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getFrontmostApplicationName() {
  if (process.platform !== 'darwin') return null

  const result = spawnSync('osascript', [
    '-e',
    'tell application "System Events" to get name of first application process whose frontmost is true',
  ], { encoding: 'utf8' })

  if (result.status !== 0) {
    return null
  }

  const appName = result.stdout.trim()
  return appName || null
}

function pasteTextIntoTargetApp(appName: string | null, text: string) {
  if (!appName) {
    return
  }

  clipboard.writeText(text)

  if (process.platform !== 'darwin') {
    return
  }

  const escapedAppName = escapeAppleScriptString(appName)
  const result = spawnSync('osascript', [
    '-e',
    `tell application "${escapedAppName}" to activate`,
    '-e',
    'delay 0.15',
    '-e',
    'tell application "System Events" to keystroke "v" using command down',
  ], { encoding: 'utf8' })

  if (result.status !== 0) {
    console.warn('Could not restore the original app focus for paste. Clipboard still contains the dictation text.', result.stderr || result.stdout)
  }
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAI0lEQVQ4y2NgFAUMDP8ZGBgYGBgYGBgYGBgYGBgYGBgYGBgWADtqAAV18C28AAAAAElFTkSuQmCC'
  )
  
  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open ChalBolReFlow', 
      click: () => {
        showMainWindow()
      } 
    },
    { 
      label: 'Pause Listening', 
      type: 'checkbox',
      checked: isPaused,
      click: (menuItem) => {
        isPaused = menuItem.checked
        if (mainWindow) {
          mainWindow.webContents.send('tray-pause-toggle', isPaused)
        }
        if (floatingWindow) {
          floatingWindow.webContents.send('tray-pause-toggle', isPaused)
        }
      } 
    },
    { 
      label: 'Settings', 
      click: () => {
        showMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send('navigate-to', 'settings')
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.quit()
      } 
    }
  ])
  
  tray.setToolTip('ChalBolReFlow')
  tray.setContextMenu(contextMenu)
}

function createMainWindow() {
  logMain('createMainWindow:start')
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(process.env.VITE_PUBLIC!, "icon.png"),
  })

  attachWebContentsDiagnostics(mainWindow, 'main')

  mainWindow.webContents.on('did-finish-load', () => {
    logMain('mainWindow:did-finish-load')
    isMainReady = true
    mainWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
    flushPendingDictationCompletion()
  })

  if (VITE_DEV_SERVER_URL) {
    logMain('mainWindow:loadURL', { url: VITE_DEV_SERVER_URL })
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    logMain('mainWindow:loadFile', { file: path.join(RENDERER_DIST, 'index.html') })
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    logMain('mainWindow:ready-to-show')
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    logMain('mainWindow:closed')
    mainWindow = null
    isMainReady = false
  })
}

function createFloatingWindow() {
  logMain('createFloatingWindow:start')
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  isFloatingReady = false
  isFloatingRendererReady = false
  pendingFloatingStart = false
  
  floatingWindow = new BrowserWindow({
    width: 344,
    height: 164,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  attachWebContentsDiagnostics(floatingWindow, 'floating')

  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Position in bottom-right with margin
  floatingWindow.setPosition(
    screenWidth - 364,
    screenHeight - 184
  )

  if (VITE_DEV_SERVER_URL) {
    logMain('floatingWindow:loadURL', { url: `${VITE_DEV_SERVER_URL}#/floating` })
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating`)
  } else {
    logMain('floatingWindow:loadFile', { file: path.join(RENDERER_DIST, 'index.html'), hash: '/floating' })
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: '/floating' })
  }

  floatingWindow.once('ready-to-show', () => {
    logMain('floatingWindow:ready-to-show')
    isFloatingReady = true
    sendPendingFloatingStart()
  })

  floatingWindow.on('closed', () => {
    logMain('floatingWindow:closed')
    floatingWindow = null
    isFloatingReady = false
    isFloatingRendererReady = false
    pendingFloatingStart = false
  })
}

function attachWebContentsDiagnostics(window: BrowserWindow, label: string) {
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${label}] level=${level} ${message} (${sourceId}:${line})`)
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer:${label}] render-process-gone`, details)
  })
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:${label}] did-fail-load`, { errorCode, errorDescription, validatedURL })
  })
  window.webContents.on('unresponsive', () => {
    console.warn(`[renderer:${label}] unresponsive`)
  })
}

function showFloatingWindow() {
  logMain('showFloatingWindow:called', {
    hasFloatingWindow: Boolean(floatingWindow),
    isFloatingReady,
    isLoading: floatingWindow?.webContents.isLoading(),
  })
  if (!floatingWindow) {
    createFloatingWindow()
  }

  pendingFloatingStart = true
  positionAndShowFloatingWindow()
  sendPendingFloatingStart()
}

function positionAndShowFloatingWindow() {
  if (!floatingWindow) return
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  floatingWindow.setPosition(screenWidth - 364, screenHeight - 184)
  floatingWindow.showInactive()
}

function sendPendingFloatingStart() {
  if (!floatingWindow || !pendingFloatingStart) return

  const canStart = isFloatingReady && isFloatingRendererReady && !floatingWindow.webContents.isLoading()
  logMain('sendPendingFloatingStart:check', {
    canStart,
    isFloatingReady,
    isFloatingRendererReady,
    isLoading: floatingWindow.webContents.isLoading(),
  })
  if (!canStart) return

  pendingFloatingStart = false
  positionAndShowFloatingWindow()
  setTimeout(() => {
    if (!floatingWindow) return
    logMain('sendPendingFloatingStart:send')
    floatingWindow.webContents.send('global-shortcut-start')
  }, 50)
}

function beginShortcutDictation() {
  logMain('beginShortcutDictation:called')
  pendingDictationTargetAppName = getFrontmostApplicationName()
  showFloatingWindow()
  mainWindow?.hide()
}

function showMainWindow() {
  logMain('showMainWindow:called', { hasMainWindow: Boolean(mainWindow) })
  if (!mainWindow) {
    createMainWindow()
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

ipcMain.handle('get-backend-base-url', () => backendBaseUrl)

function flushPendingDictationCompletion() {
  if (!mainWindow || !isMainReady || !pendingDictationCompletion) return

  logMain('flushPendingDictationCompletion:send', {
    hasText: Boolean(pendingDictationCompletion.text?.trim()),
    duration: pendingDictationCompletion.duration,
    app: pendingDictationCompletion.app,
  })
  mainWindow.webContents.send('navigate-to', 'home')
  mainWindow.webContents.send('dictation-completed-event', pendingDictationCompletion)
  pendingDictationCompletion = null
}

// Register Global Keyboard Shortcut (Option+Space)
function registerShortcuts() {
  logMain('registerShortcuts:start')
  globalShortcut.unregisterAll()
  
  const altRegistered = globalShortcut.register('Alt+Space', () => {
    toggleDictationViaShortcut()
  })

  // Register Ctrl+Space as fallback / alternative trigger
  const ctrlRegistered = globalShortcut.register('Control+Space', () => {
    toggleDictationViaShortcut()
  })
  logMain('registerShortcuts:done', { altRegistered, ctrlRegistered })
}

function toggleDictationViaShortcut() {
  logMain('toggleDictationViaShortcut:called', {
    isPaused,
    floatingVisible: Boolean(floatingWindow && floatingWindow.isVisible()),
  })
  if (isPaused) return
  
  if (floatingWindow && floatingWindow.isVisible()) {
    // If dictating, stop it
    floatingWindow.webContents.send('global-shortcut-stop')
  } else {
    // If idle, remember the app that was active before the widget stole focus.
    beginShortcutDictation()
  }
}

// IPC Handlers
ipcMain.on('window-action', (_, action) => {
  logMain('ipc:window-action', { action })
  const sender = BrowserWindow.fromWebContents(_.sender)
  if (!sender) return

  if (action === 'minimize') {
    sender.minimize()
  } else if (action === 'close') {
    if (sender === mainWindow) {
      if (process.platform === 'darwin') {
        mainWindow.hide()
      } else {
        app.quit()
      }
    } else {
      sender.close()
    }
  } else if (action === 'hide') {
    sender.hide()
  }
})

// Toggle windows during dictation
ipcMain.on('start-dictation', () => {
  logMain('ipc:start-dictation')
  showFloatingWindow()
  mainWindow?.hide()
})

ipcMain.on('stop-dictation', () => {
  logMain('ipc:stop-dictation')
  // If floating window exists, tell it to trigger stop completion
  if (floatingWindow && floatingWindow.isVisible()) {
    floatingWindow.webContents.send('global-shortcut-stop')
  } else {
    floatingWindow?.hide()
    showMainWindow()
  }
})

ipcMain.on('cancel-dictation', () => {
  logMain('ipc:cancel-dictation')
  floatingWindow?.hide()
  pendingDictationTargetAppName = null
  showMainWindow()
  if (mainWindow) {
    mainWindow.webContents.send('dictation-cancelled-event')
  }
})

ipcMain.on('floating-renderer-ready', () => {
  logMain('ipc:floating-renderer-ready')
  isFloatingRendererReady = true
  sendPendingFloatingStart()
})

// Dictation completion event sent from the active Floating Window
ipcMain.on('dictation-complete', (_, data) => {
  logMain('ipc:dictation-complete', {
    hasText: Boolean(data?.text?.trim()),
    duration: data?.duration,
    app: data?.app,
  })
  // Hide/Close floating window
  floatingWindow?.hide()

  // If dictation came from the global shortcut, restore the original app before pasting.
  if (pendingDictationTargetAppName) {
    pasteTextIntoTargetApp(pendingDictationTargetAppName, data.text)
  } else {
    showMainWindow()
  }
  pendingDictationTargetAppName = null
  
  // Forward final transcription and stats to the Main Window once it is ready.
  pendingDictationCompletion = data
  flushPendingDictationCompletion()
})

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    try {
      app.setActivationPolicy('regular')
    } catch (error) {
      console.warn('Failed to set a regular activation policy on macOS.', error)
    }
  }

  logMain('app:ready')
  console.log("Mic Status:", systemPreferences.getMediaAccessStatus("microphone"));

  const granted = await systemPreferences.askForMediaAccess("microphone");

  console.log("Mic Granted:", granted);

  await startBackend()
  logMain('app:create-ui')
  createTray()
  createMainWindow()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('before-quit', () => {
  void stopBackend()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
