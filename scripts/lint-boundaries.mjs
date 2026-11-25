// Project rules the type checker can't see. Usage: node scripts/lint-boundaries.mjs [area]
// area = market | workspace | ai | carbon | qa; no area checks everything.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FEATURES = ['market', 'workspace', 'ai', 'carbon']
const area = process.argv[2]
const roots = !area ? ['src/features', 'tests'] : area === 'qa' ? ['tests'] : [`src/features/${area}`]

function walk(dir) {
  try {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(name) ? [p] : []
    })
  } catch {
    return []
  }
}

const problems = []
for (const file of roots.flatMap(walk)) {
  const rel = relative('.', file)
  const own = FEATURES.find((f) => rel.startsWith(`src/features/${f}/`))
  const isTest = /\.test\.tsx?$/.test(rel) || rel.startsWith('tests/')
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    const code = line.replace(/\/\/.*$/, '')
    if (own) {
      for (const other of FEATURES.filter((f) => f !== own)) {
        if (new RegExp(`from ['"][^'"]*features/${other}/`).test(code) || new RegExp(`from ['"]\\.\\./(\\.\\./)*${other}/`).test(code))
          problems.push(`${at} imports from feature "${other}". Features share data and links only; ask the CEO to move shared code to src/core or src/ui.`)
      }
    }
    if (!isTest) {
      if (/#[0-9a-fA-F]{3,8}\b/.test(code) && /['"`]/.test(code) && !/href=|to=|#\//.test(code))
        problems.push(`${at} raw hex color. Use a token class (bg-surface, text-muted, ...) or var(--gm-*).`)
      if (/\brgba?\(/.test(code)) problems.push(`${at} raw rgb() color. Use a token.`)
      if (/(^|[\s'"`])dark:/.test(code)) problems.push(`${at} uses the dark: variant. Tokens already switch themes.`)
      if (/(^|[^\w.$])(alert|confirm|prompt)\s*\(/.test(code) || /window\.(alert|confirm|prompt)\b/.test(code))
        problems.push(`${at} uses a browser dialog. The claude.ai viewer ignores them; use ConfirmDialog from src/ui.`)
      if (/window\.claude|\blocalStorage\b|\bsessionStorage\b/.test(code))
        problems.push(`${at} touches window.claude or browser storage. Use src/core (runtime, store, session) instead.`)
      if (/React\.lazy|\blazy\(|\bimport\(/.test(code)) problems.push(`${at} dynamic import. The artifact is one file; import statically.`)
      if (/\bbg-(white|black)\b|\btext-(white|black)\b|\b(bg|text|border)-(gray|slate|green|blue|red|emerald|zinc|neutral)-\d/.test(code))
        problems.push(`${at} default Tailwind color. Only token colors exist (see src/styles/index.css).`)
    }
  })
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\nlint-boundaries: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log(`lint-boundaries: ok (${area ?? 'all'})`)
