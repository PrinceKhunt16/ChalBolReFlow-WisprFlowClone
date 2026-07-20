import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeDir = path.join(rootDir, '.runtime')
const logDir = path.join(runtimeDir, 'logs')
const backendLog = path.join(logDir, 'backend.log')
const desktopLog = path.join(logDir, 'desktop.log')
const backendPidFile = path.join(runtimeDir, 'backend.pid')
const desktopPidFile = path.join(runtimeDir, 'desktop.pid')

mkdirSync(logDir, { recursive: true })

function isRunning(pidFile) {
  if (!existsSync(pidFile)) return false

  try {
    const pid = Number(readFileSync(pidFile, 'utf8').trim())
    if (!Number.isFinite(pid)) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function startDetached(command, args, cwd, logPath, pidPath, label) {
  if (isRunning(pidPath)) {
    console.log(`${label} already running`)
    return
  }

  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  const logStream = createWriteStream(logPath, { flags: 'a' })
  child.stdout.pipe(logStream)
  child.stderr.pipe(logStream)
  child.unref()
  writeFileSync(pidPath, String(child.pid))
  console.log(`${label} started (pid ${child.pid})`)
}

startDetached(
  'python3',
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'],
  path.join(rootDir, 'backend'),
  backendLog,
  backendPidFile,
  'Backend'
)

startDetached(
  'npm',
  ['--prefix', 'desktop', 'run', 'dev'],
  rootDir,
  desktopLog,
  desktopPidFile,
  'Desktop'
)

console.log('App launched independently of VS Code. Logs are in .runtime/logs.')