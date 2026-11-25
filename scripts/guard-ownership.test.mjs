// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { decide, resolveArea, stripHeredocs, tokenize } from './guard-ownership.mjs'
import { loadPolicy } from './teammate-policy.mjs'

const P = '/Users/chris/Documents/ESCO'
const HOME = '/Users/chris'
const bash = (command, area = 'market', cwd = P, extra = {}) =>
  decide({ tool: 'Bash', input: { command, ...extra }, cwd, area, projectDir: P, home: HOME })

describe('regression: commands the old guard wrongly blocked', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/guard-false-blocks.json', import.meta.url), 'utf8'))
  for (const c of fx.cases) {
    it(`allows ${c.area} run ${c.run}: ${c.input.command.slice(0, 60).replace(/\n/g, ' ')}`, () => {
      const r = decide({ tool: c.tool, input: c.input, cwd: c.cwd, area: c.area, projectDir: fx.projectDir, home: HOME })
      expect(r).toEqual({ allow: true })
    })
  }
})

describe('allows normal work inside the area', () => {
  it.each([
    ["cat > src/features/market/x.test.tsx <<'EOF'\nit('a', () => {\n  if (a > b) run()\n})\nEOF"],
    ['cd src/features/market/pages && cat > A.tsx <<EOF\nconst x = 1 > 0\nEOF'],
    ["cd src/features/market && sed -i '' -e 's/a/b/' -e 's/c/d/' pages/Landing.tsx"],
    ["sed -i 's/a/b/' src/features/market/pages/Landing.tsx"],
    ['npm run check:market 2>&1 | tail -40'],
    ['npx vitest run src/features/market > /tmp/out.log 2>&1; cat /tmp/out.log'],
    ['echo "a > b" && grep -n "=>" src/core/types.ts'],
    ['git status --short && git diff --stat'],
    ['(cd src/features/market && touch lib/new.ts) && ls'],
    ['mkdir -p src/features/market/lib && cp src/core/format.ts src/features/market/lib/fmt-copy.ts'],
    ['echo done > "$TMPDIR/note.txt"'],
  ])('%s', (cmd) => {
    expect(bash(cmd)).toEqual({ allow: true })
  })

  it('resolves relative writes against the hook cwd', () => {
    expect(bash("sed -i 's/a/b/' pages/Hub.tsx", 'workspace', `${P}/src/features/workspace`)).toEqual({ allow: true })
  })

  it('lets QA write tests and its report', () => {
    expect(bash("cat > tests/flows/x.test.tsx <<'EOF'\nx\nEOF\necho ok > docs/qa/report.md", 'qa')).toEqual({ allow: true })
  })

  it('allows Edit and Write inside the area, by absolute or relative path', () => {
    const d = (tool, file_path, cwd = P) => decide({ tool, input: { file_path }, cwd, area: 'carbon', projectDir: P, home: HOME })
    expect(d('Write', `${P}/src/features/carbon/lib/x.ts`)).toEqual({ allow: true })
    expect(d('Edit', 'lib/x.ts', `${P}/src/features/carbon`)).toEqual({ allow: true })
  })
})

describe('still blocks', () => {
  it.each([
    ['writing a shared file', 'echo x > src/core/types.ts'],
    ['writing another area', "cat > src/features/ai/x.ts <<'EOF'\nx\nEOF"],
    ['escaping the area with ..', 'cd src/features/market && echo x >> ../../core/types.ts'],
    ['a cd into a shared folder', "cd src/ui && cat > Button.tsx <<'EOF'\nx\nEOF"],
    ['sed -i on a shared file', "sed -i '' 's/a/b/' src/ui/Button.tsx"],
    ['tee to a shared file', 'echo x | tee -a src/app/routes.tsx'],
    ['cp into a shared folder', 'cp src/features/market/a.ts src/core/'],
    ['mv out of a shared folder', 'mv src/core/format.ts src/features/market/'],
    ['writing outside the project', 'echo x > /Users/chris/notes.txt'],
    ['writing to home', 'echo x > ~/x.txt'],
    ['a path built from a variable', 'echo x > "$OUT/file.ts"'],
    ['git commit', 'git add -A && git commit -m x'],
    ['git -C commit', 'git -C . commit -m x'],
    ['npm install', 'npm install zod'],
    ['npm i', 'cd src && npm i -D zod'],
    ['the dev server', 'npm run dev'],
    ['vite build', 'npx vite build'],
    ['recursive delete', 'rm -rf src/features/market/lib'],
    ['a trailing &', 'npm run check:market &'],
    ['a background job mid-command', 'npm run check:market & sleep 1'],
  ])('%s', (_label, cmd) => {
    expect(bash(cmd).allow).toBe(false)
  })

  it('blocks run_in_background with a message that says why', () => {
    const r = bash('npm run check:market', 'market', P, { run_in_background: true })
    expect(r.allow).toBe(false)
    expect(r.reason).toMatch(/foreground/)
  })

  it('blocks Edit and Write outside the area', () => {
    const d = (tool, file_path) => decide({ tool, input: { file_path }, cwd: P, area: 'market', projectDir: P, home: HOME })
    expect(d('Edit', `${P}/src/core/types.ts`).allow).toBe(false)
    expect(d('Write', `${P}/src/features/ai/x.ts`).allow).toBe(false)
    expect(d('Write', '/Users/chris/.zshrc').allow).toBe(false)
  })
})

describe('teammate area', () => {
  // P 指向主 checkout，那裡可能還沒有 teammate-paths.json，所以明確傳入本 repo 的政策。
  const policy = loadPolicy(fileURLToPath(new URL('..', import.meta.url)))
  const t = (tool, input, cwd = P) => decide({ tool, input, cwd, area: 'teammate', projectDir: P, home: HOME, policy })

  it('allows small paths and own folder', () => {
    expect(t('Write', { file_path: `${P}/src/ui/Button.tsx` })).toEqual({ allow: true })
    expect(t('Edit', { file_path: 'docs/governance/teammate/requests/REQ-a-001.md' })).toEqual({ allow: true })
    expect(t('Bash', { command: "cat > src/features/market/pages/Landing.tsx <<'EOF'\nx\nEOF" })).toEqual({ allow: true })
  })

  it('blocks big-direction paths', () => {
    for (const f of ['src/core/store.ts', 'src/app/routes.tsx', 'CLAUDE.md', 'scripts/teammate-paths.json', 'docs/governance/BOARD_PROTOCOL.md', '.claude/settings.json']) {
      expect(t('Write', { file_path: f }).allow).toBe(false)
    }
    const r = t('Bash', { command: 'echo x > src/core/types.ts' })
    expect(r.allow).toBe(false)
    expect(r.reason).toMatch(/請求單/)
  })

  it('blocks push, merge and gh writes but allows local git and gh reads', () => {
    expect(t('Bash', { command: 'git push origin main' }).allow).toBe(false)
    expect(t('Bash', { command: 'git merge feature' }).allow).toBe(false)
    expect(t('Bash', { command: 'gh pr merge 3' }).allow).toBe(false)
    expect(t('Bash', { command: 'gh pr create --fill' }).allow).toBe(false)
    expect(t('Bash', { command: 'gh api repos/x/y -X DELETE' }).allow).toBe(false)
    expect(t('Bash', { command: 'git add -A && git commit -m "x"' })).toEqual({ allow: true })
    expect(t('Bash', { command: 'gh pr view 3' })).toEqual({ allow: true })
  })

  it('keeps a Paperclip agent in its own area even when GREENMATCH_ROLE=teammate is set', () => {
    const areas = { 'agent-1': { area: 'market' } }
    expect(resolveArea({ PAPERCLIP_AGENT_ID: 'agent-1', GREENMATCH_ROLE: 'teammate' }, areas)).toBe('market')
    expect(resolveArea({ GREENMATCH_ROLE: 'teammate' }, areas)).toBe('teammate')
    expect(resolveArea({ PAPERCLIP_AGENT_ID: 'unknown', GREENMATCH_ROLE: 'teammate' }, areas)).toBe('teammate')
    expect(resolveArea({}, areas)).toBeUndefined()
  })

  it('allows npm ci, the dev server and background runs', () => {
    expect(t('Bash', { command: 'npm ci' })).toEqual({ allow: true })
    expect(t('Bash', { command: 'npm run dev', run_in_background: true })).toEqual({ allow: true })
    expect(t('Bash', { command: 'npm run dev &' })).toEqual({ allow: true })
    expect(t('Bash', { command: 'npm install left-pad' }).allow).toBe(false)
  })
})

describe('parser pieces', () => {
  it('drops heredoc bodies, including <<- and quoted delimiters', () => {
    const s = "cat > a <<'EOF'\nx > y\nEOF\ncat <<-E\n\tz > w\n\tE\necho done"
    expect(stripHeredocs(s)).toBe('cat > a \ncat \necho done')
  })

  it('keeps fd duplication apart from writes', () => {
    const t = tokenize('cmd 2>&1 >out')
    expect(t.map((x) => x.value)).toEqual(['cmd', '>&', '1', '>', 'out'])
  })
})
