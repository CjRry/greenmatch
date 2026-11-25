// Hire an agent from scripts/team/agent-template.json, so every agent starts with the same settings.
//
//   node scripts/team/hire.mjs --area market --name 市集前端工程師 --title "Market Frontend Engineer" \
//        --duty "首頁、公司登錄、需求市集、廠商名錄"            prints the request (dry run)
//   ... --yes                                                   hires, waits for verification, records the area
//
// The area must already exist in OWNED in scripts/guard-ownership.mjs (ownership is a CEO decision).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OWNED } from '../guard-ownership.mjs'
import { ROOT, TEAM, TEMPLATE, api, parseArgs, sleep } from './lib.mjs'

const args = parseArgs()
for (const k of ['area', 'name', 'title', 'duty']) {
  if (!args[k] || args[k] === true) {
    console.error(`Missing --${k}`)
    process.exit(1)
  }
}
if (!OWNED[args.area]) {
  console.error(`Unknown area "${args.area}". Add it to OWNED in scripts/guard-ownership.mjs first.`)
  process.exit(1)
}

const paths = OWNED[args.area].map((p) => `\`${p}**\``).join('、')
const agentsMd = `# ${args.name}（${args.title}）— 綠媒 GreenMatch

你是「綠媒 GreenMatch」中小企業減碳媒合平台團隊的${args.name}，直接向 CEO 回報。
專案原始碼：${TEAM.workspaceCwd}

## 你的職責
${args.duty}。

## 你的檔案範圍
只可新增或修改：${paths}。其餘檔案一律唯讀；專案的 PreToolUse hook 會擋下範圍外的寫入。

## 工作方式
1. 依 Paperclip skill 的 heartbeat 流程：checkout 指派給你的任務，任務描述就是你的規格與驗收條件。
2. 開工前先讀專案根目錄的 \`CLAUDE.md\` 與 \`docs/CONTRACTS.md\`，遵守其中所有規則。
3. 需要改共用檔案時，在任務留言寫清楚要改什麼、為什麼，然後繼續做不依賴它的部分。
4. 所有指令在前景執行並等它結束；完成前執行 \`npm run check:${args.area}\`，通過才結案（done，有審查階段則 in_review）。
5. 介面文案一律使用繁體中文（台灣用語）。
`

const body = {
  name: args.name,
  role: args.role && args.role !== true ? args.role : args.area === 'qa' ? 'qa' : 'engineer',
  title: args.title,
  reportsTo: TEAM.ceoAgentId,
  capabilities: args.duty,
  adapterType: TEMPLATE.adapterType,
  adapterConfig: TEMPLATE.adapterConfig,
  runtimeConfig: TEMPLATE.runtimeConfig,
  instructionsBundle: { entryFile: 'AGENTS.md', files: { 'AGENTS.md': agentsMd } },
}

if (!args.yes) {
  console.log(JSON.stringify(body, null, 2))
  console.log('\nDry run. Add --yes to hire.')
  process.exit(0)
}

const res = await api('POST', '/api/companies/{c}/agent-hires', body)
const agent = res.agent ?? res
console.log(`Hired ${agent.name} (${agent.id}); waiting for verification…`)
let a = agent
for (let i = 0; i < 40 && a.lifecycleState !== 'ready' && !a.lifecycleError; i++) {
  await sleep(3000)
  a = await api('GET', `/api/agents/${agent.id}`)
}
console.log(`Lifecycle: ${a.lifecycleState}${a.lifecycleError ? ` — ${a.lifecycleError} (run scripts/team/preflight.mjs)` : ''}`)

const file = join(ROOT, 'scripts/agent-areas.json')
const areas = JSON.parse(readFileSync(file, 'utf8'))
areas[agent.id] = { area: args.area, name: args.name }
writeFileSync(file, JSON.stringify(areas, null, 2) + '\n')
console.log(`Recorded ${args.area} for ${agent.id} in scripts/agent-areas.json (the ownership guard now applies to it).`)
