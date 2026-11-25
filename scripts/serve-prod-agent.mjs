/**
 * 讓本機生產伺服 `:4173` 由 macOS launchd 常駐管理（OBS-0004 §2-1）。
 *
 *   node scripts/serve-prod-agent.mjs plist      # 只印出 plist，不安裝
 *   node scripts/serve-prod-agent.mjs install    # 寫入 ~/Library/LaunchAgents 並載入（RunAtLoad + KeepAlive）
 *   node scripts/serve-prod-agent.mjs restart    # launchctl kickstart -k（巡檢 origin-4173-down 的唯一處置）
 *   node scripts/serve-prod-agent.mjs status     # 印出 launchd 狀態與 :4173 監聽者
 *   node scripts/serve-prod-agent.mjs uninstall  # 卸載並刪除 plist
 *
 * 界線：
 * - 只管 `serve-prod.mjs` 這一個行程；伺服器本身寫死只聽 127.0.0.1（PROP-0003 A1）。
 * - 絕不碰 `cloudflared`。
 * - 不需要任何 npm 套件；plist 由本檔依目前的 node 路徑與 repo 路徑產生，不把個人路徑寫進 git。
 * - `install` 前若 :4173 已被別的行程占住，launchd 會依 ThrottleInterval 反覆重試；
 *   換手時先停掉舊的 serve-prod，再立刻 install（見 docs/board/deployment.md）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

export const SERVE_PROD_LABEL = 'com.greenmatch.serve-prod'
export const SERVE_PROD_PORT = 4173

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 產生 launchd plist。純函式，測試直接呼叫。
 * @param {{ nodePath: string, rootDir: string, logDir: string, label?: string, port?: number }} opts
 */
export function buildServeProdPlist({ nodePath, rootDir, logDir, label = SERVE_PROD_LABEL, port = SERVE_PROD_PORT }) {
  const script = path.join(rootDir, 'scripts', 'serve-prod.mjs')
  const logBase = path.join(logDir, 'greenmatch-serve-prod')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${xmlEscape(label)}</string>
	<key>ProgramArguments</key>
	<array>
		<string>${xmlEscape(nodePath)}</string>
		<string>${xmlEscape(script)}</string>
	</array>
	<key>WorkingDirectory</key>
	<string>${xmlEscape(rootDir)}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PORT</key>
		<string>${port}</string>
		<key>GREENMATCH_SERVE_MANAGED</key>
		<string>launchd</string>
	</dict>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>ThrottleInterval</key>
	<integer>10</integer>
	<key>ProcessType</key>
	<string>Background</string>
	<key>StandardOutPath</key>
	<string>${xmlEscape(logBase)}.log</string>
	<key>StandardErrorPath</key>
	<string>${xmlEscape(logBase)}.err.log</string>
</dict>
</plist>
`
}

function plistPath(label = SERVE_PROD_LABEL) {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`)
}

function domain() {
  return `gui/${process.getuid()}`
}

function launchctl(args, { allowFail = false } = {}) {
  try {
    return execFileSync('launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    if (allowFail) return ''
    throw err
  }
}

function currentPlist() {
  return buildServeProdPlist({
    nodePath: process.execPath,
    rootDir: ROOT_DIR,
    logDir: path.join(os.homedir(), 'Library', 'Logs'),
  })
}

function listeners() {
  try {
    return execFileSync('lsof', ['-nP', `-iTCP:${SERVE_PROD_PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim()
  } catch {
    return '(沒有行程監聽 :4173)'
  }
}

function main(cmd) {
  const target = plistPath()
  switch (cmd) {
    case 'plist':
      process.stdout.write(currentPlist())
      return
    case 'install': {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, currentPlist(), 'utf8')
      launchctl(['bootout', `${domain()}/${SERVE_PROD_LABEL}`], { allowFail: true })
      launchctl(['bootstrap', domain(), target])
      console.log(`已載入 ${SERVE_PROD_LABEL}（${target}）`)
      return
    }
    case 'restart':
      launchctl(['kickstart', '-k', `${domain()}/${SERVE_PROD_LABEL}`])
      console.log(`已重啟 ${SERVE_PROD_LABEL}`)
      return
    case 'status': {
      const out = launchctl(['print', `${domain()}/${SERVE_PROD_LABEL}`], { allowFail: true })
      const state = out.match(/^\s*state = (.+)$/m)?.[1] ?? '未載入'
      const pid = out.match(/^\s*pid = (\d+)$/m)?.[1] ?? '-'
      console.log(`launchd ${SERVE_PROD_LABEL}: state=${state} pid=${pid}`)
      console.log(listeners())
      return
    }
    case 'uninstall':
      launchctl(['bootout', `${domain()}/${SERVE_PROD_LABEL}`], { allowFail: true })
      if (fs.existsSync(target)) fs.unlinkSync(target)
      console.log(`已卸載 ${SERVE_PROD_LABEL}`)
      return
    default:
      console.error('用法：node scripts/serve-prod-agent.mjs plist|install|restart|status|uninstall')
      process.exitCode = 2
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) main(process.argv[2])
