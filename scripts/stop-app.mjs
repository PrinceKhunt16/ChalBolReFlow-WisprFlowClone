import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeDir = path.join(rootDir, '.runtime')
const pidFiles = [
  path.join(runtimeDir, 'backend.pid'),
  path.join(runtimeDir, 'desktop.pid'),
]

for (const pidFile of pidFiles) {
  if (!existsSync(pidFile)) continue

  try {
    const pid = Number(readFileSync(pidFile, 'utf8').trim())
    if (Number.isFinite(pid)) {
      process.kill(pid, 'SIGTERM')
      console.log(`Stopped process ${pid} from ${path.basename(pidFile)}`)
    }
  } catch (error) {
    console.log(`Could not stop ${path.basename(pidFile)}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const pidFile of pidFiles) {
  if (existsSync(pidFile)) rmSync(pidFile, { force: true })
}

console.log('Stopped launcher processes.')