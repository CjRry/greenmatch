// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { collectFiles, directRange, parseNumstat, parseRaw, reviewDirect, reviewPr } from './check-teammate-pr.mjs'
import { loadPolicy } from './teammate-policy.mjs'

const policy = { ...loadPolicy(fileURLToPath(new URL('..', import.meta.url))), teammates: ['alice'] }

/** 一筆已解析的檔案，預設是 src/ui 裡的一般修改。 */
const f = (path, o = {}) => ({ path, oldPath: null, status: 'modified', oldMode: '100644', newMode: '100644', binary: false, addedLines: ['const a = 1'], ...o })
const review = (author, ...files) => reviewPr({ author, files }, policy)
const reasons = (r) => r.reasons.join('\n')

describe('parseRaw and parseNumstat', () => {
  it('reads modes, status and NUL-separated paths, including spaces and renames', () => {
    const raw = [
      ':100644 100644 aaa bbb M', 'src/ui/a b.tsx',
      ':000000 120000 000 ccc A', 'src/ui/key.txt',
      ':100644 100644 ddd eee R100', 'src/core/x.ts', 'src/ui/x.ts',
      ':100644 000000 fff 000 D', 'src/ui/Old.tsx',
      '',
    ].join('\0')
    expect(parseRaw(raw)).toEqual([
      { path: 'src/ui/a b.tsx', oldPath: null, status: 'modified', oldMode: '100644', newMode: '100644' },
      { path: 'src/ui/key.txt', oldPath: null, status: 'added', oldMode: '000000', newMode: '120000' },
      { path: 'src/ui/x.ts', oldPath: 'src/core/x.ts', status: 'renamed', oldMode: '100644', newMode: '100644' },
      { path: 'src/ui/Old.tsx', oldPath: null, status: 'deleted', oldMode: '100644', newMode: '000000' },
    ])
  })

  it('marks binary files from numstat', () => {
    const num = ['1\t0\tsrc/ui/a b.tsx', '-\t-\tsrc/ui/bin.test.tsx', '0\t0\t', 'src/core/x.ts', 'src/ui/x.ts', ''].join('\0')
    expect(parseNumstat(num)).toEqual(new Map([['src/ui/a b.tsx', false], ['src/ui/bin.test.tsx', true], ['src/ui/x.ts', false]]))
  })
})

describe('reviewPr', () => {
  it('mergeable for a small UI change by a teammate', () => {
    expect(review('alice', f('src/ui/Button.tsx'))).toEqual({ verdict: 'mergeable', reasons: [] })
  })

  it('mergeable for an observation report', () => {
    expect(review('alice', f('docs/governance/teammate/reports/R-alice-001.md', { status: 'added', oldMode: '000000' })).verdict).toBe('mergeable')
  })

  it('asks the user for a request file', () => {
    expect(reasons(review('alice', f('docs/governance/teammate/requests/REQ-alice-001.md', { status: 'added' })))).toMatch(/請求單/)
  })

  it('asks the user when any file is outside small paths', () => {
    const r = review('alice', f('src/ui/Button.tsx'), f('scripts/teammate-paths.json'))
    expect(r.verdict).toBe('ask-user')
    expect(reasons(r)).toContain('scripts/teammate-paths.json')
    expect(reasons(r)).not.toContain('src/ui/Button.tsx')
  })

  it('asks the user when the author is not a teammate', () => {
    expect(reasons(review('mallory', f('src/ui/Button.tsx')))).toContain('mallory')
  })

  it('matches teammate logins case-insensitively', () => {
    expect(review('Alice', f('src/ui/Button.tsx')).verdict).toBe('mergeable')
  })

  it('checks both sides of a rename', () => {
    expect(reasons(review('alice', f('src/ui/x.ts', { status: 'renamed', oldPath: 'src/core/x.ts' })))).toContain('src/core/x.ts')
  })

  it('asks the user when a file is deleted', () => {
    expect(reasons(review('alice', f('src/features/market/pages/About.tsx', { status: 'deleted', newMode: '000000', addedLines: [] })))).toMatch(/刪除/)
  })

  it('asks the user for binary files, symlinks and mode changes', () => {
    expect(reasons(review('alice', f('src/ui/bin.test.tsx', { binary: true, addedLines: [] })))).toMatch(/二進位/)
    expect(reasons(review('alice', f('src/ui/key.txt', { status: 'added', oldMode: '000000', newMode: '120000' })))).toMatch(/120000/)
    expect(reasons(review('alice', f('src/ui/run.tsx', { newMode: '100755' })))).toMatch(/100755/)
  })

  it('asks the user for copies', () => {
    expect(review('alice', f('src/ui/x.ts', { status: 'copied', oldPath: 'src/core/x.ts' })).verdict).toBe('ask-user')
  })

  it('asks the user when the PR changes nothing', () => {
    expect(reasons(review('alice'))).toMatch(/沒有改動/)
  })
})

describe('reviewPr code scan', () => {
  const scan = (path, ...lines) => review('alice', f(path, { addedLines: lines }))

  it('scans added lines in test files too', () => {
    expect(reasons(scan('src/ui/Button.test.tsx', "import { execSync } from 'node:child_process'"))).toContain('child_process')
  })

  it('allows the project libraries and relative imports inside the repo', () => {
    const r = scan(
      'src/features/ai/pages/X.test.tsx',
      "import { useState } from 'react'",
      "import { Link } from 'react-router'",
      "import { describe, it } from 'vitest'",
      "import { screen } from '@testing-library/react'",
      "import { Leaf } from 'lucide-react'",
      "import { renderPage } from '../../../test/renderPage'",
      "export { default } from './Y'",
    )
    expect(r).toEqual({ verdict: 'mergeable', reasons: [] })
  })

  it.each([
    ["import vm from 'node:vm'"],
    ["import p from 'fs/promises'"],
    ["import https from 'node:https'"],
    ["import x from 'node:child\\x5fprocess'"],
    ["import k from '../../../../.ssh/id_rsa?raw'"],
    ["import k from '../../../../../etc/passwd'"],
    ["const r = createRequire(import.meta.url)('child'+'_process')"],
    ["process.getBuiltinModule('node:child'+'_process')"],
    ["globalThis['ev'+'al']('1')"],
    ["const m = import.meta.glob('/src/**')"],
    ["await import('./x')"],
  ])('flags %s', (line) => {
    expect(scan('src/ui/Thing.test.tsx', line).verdict).toBe('ask-user')
  })

  it.each([['@plugin "./p.cts";'], ['@config "./t.js";'], ['@import url("https://evil.example/x.css");'], ['background: url(https://evil.example/b.png);']])(
    'flags CSS %s',
    (line) => {
      expect(scan('src/styles/index.css', line).verdict).toBe('ask-user')
    },
  )

  it('scans every non-markdown file type, including .mts and .svg', () => {
    expect(scan('src/ui/helper.mts', "import cp from 'child_process'").verdict).toBe('ask-user')
    expect(scan('src/ui/icon.svg', '<script>fetch("x")</script>').verdict).toBe('ask-user')
  })

  it('ignores danger words in markdown', () => {
    expect(scan('docs/design/x.md', '用 fetch( 取資料').verdict).toBe('mergeable')
  })
})

describe('collectFiles on a real git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'teammate-pr-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const put = (p, content) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), content)
  }
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  git('init', '-q')
  git('config', 'user.email', 't@example.invalid')
  git('config', 'user.name', 't')
  put('src/ui/Button.tsx', 'export const a = 0\n')
  put('src/core/x.ts', 'export const x = 1\n')
  git('add', '-A')
  git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD').trim()

  put('docs/design/plan.md', '# 計畫\n')
  put('src/core/a b.test.ts', 'import { execSync } from "child_process"\nexecSync("id")\n')
  put('src/ui/bin.test.tsx', Buffer.from('// \0\nimport {execSync} from "child_process"\n'))
  put('src/ui/Button.tsx', 'export const a = 1\n')
  put('docs/design/首頁.md', '# 首頁\n')
  symlinkSync('../../../../.ssh/id_rsa', join(dir, 'src/ui/key.txt'))
  git('add', '-A')
  git('commit', '-qm', 'change')
  const head = git('rev-parse', 'HEAD').trim()

  const files = collectFiles((args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 }), base, head)
  const by = (p) => files.find((x) => x.path === p)

  it('sees a path with a space and its added lines', () => {
    expect(by('src/core/a b.test.ts')?.addedLines).toContain('execSync("id")')
  })

  it('sees binary files, symlinks and non-ASCII names', () => {
    expect(by('src/ui/bin.test.tsx')?.binary).toBe(true)
    expect(by('src/ui/key.txt')?.newMode).toBe('120000')
    expect(by('docs/design/首頁.md')?.status).toBe('added')
    expect(by('src/ui/Button.tsx')?.addedLines).toEqual(['export const a = 1'])
  })

  it('the whole PR asks the user', () => {
    const r = reviewPr({ author: 'alice', files }, policy)
    expect(r.verdict).toBe('ask-user')
    for (const s of ['src/core/a b.test.ts', 'src/ui/bin.test.tsx', 'src/ui/key.txt']) expect(reasons(r)).toContain(s)
  })
})

describe('reviewPr author by GitHub role', () => {
  const byRole = (author, authorRole) => reviewPr({ author, authorRole, files: [f('src/ui/Button.tsx')] }, policy)

  it('accepts a read-only collaborator who is not in the list', () => {
    expect(byRole('bob', 'read').verdict).toBe('mergeable')
    expect(byRole('bob', 'triage').verdict).toBe('mergeable')
  })

  it('asks the user for anyone who can write or is unknown', () => {
    for (const role of ['write', 'maintain', 'admin', 'none', undefined]) expect(byRole('bob', role).verdict).toBe('ask-user')
  })
})

describe('reviewDirect (teammate pushed straight to main)', () => {
  const direct = (...files) => reviewDirect({ files, rewritten: false }, policy)

  it('ok when there is nothing new', () => {
    expect(direct()).toEqual({ verdict: 'ok', reasons: [] })
  })

  it('ok for small changes and reports, without an author check', () => {
    expect(direct(f('src/ui/Button.tsx'), f('docs/governance/teammate/reports/R-alice-001.md', { status: 'added', oldMode: '000000' })).verdict).toBe('ok')
  })

  it('does not stop on a request file (it only runs after the owner merges its PR)', () => {
    expect(direct(f('docs/governance/teammate/requests/REQ-alice-001.md', { status: 'added', oldMode: '000000' })).verdict).toBe('ok')
  })

  it('asks the user for big-path files, deletions and danger words', () => {
    expect(reasons(direct(f('src/core/store.ts')))).toContain('src/core/store.ts')
    expect(reasons(direct(f('src/ui/Old.tsx', { status: 'deleted', newMode: '000000', addedLines: [] })))).toContain('刪除')
    expect(direct(f('src/ui/x.ts', { addedLines: ["import cp from 'child_process'"] })).verdict).toBe('ask-user')
  })

  it('asks the user when history on GitHub was rewritten', () => {
    const r = reviewDirect({ files: [], rewritten: true }, policy)
    expect(r.verdict).toBe('ask-user')
    expect(reasons(r)).toMatch(/改寫/)
  })
})

describe('directRange on a real git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'teammate-direct-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const run = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 })
  const put = (p, content) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), content)
  }
  const commit = (msg) => {
    git('add', '-A')
    git('commit', '-qm', msg)
    return git('rev-parse', 'HEAD').trim()
  }
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.invalid')
  git('config', 'user.name', 't')
  put('src/ui/Button.tsx', 'export const a = 0\n')
  const pushed = commit('pushed by owner')
  put('src/app/Local.tsx', 'export const l = 1\n')
  const local = commit('local, not pushed yet')
  git('checkout', '-q', '-b', 'remote', pushed)
  put('src/ui/Button.tsx', 'export const a = 1\n')
  const remote = commit('teammate push')
  git('checkout', '-q', '--orphan', 'forced')
  put('src/ui/Button.tsx', 'export const a = 2\n')
  const forced = commit('force-pushed history')

  it('lists only what the teammate added on top of the shared base', () => {
    const r = directRange(run, local, pushed, remote)
    expect(r.rewritten).toBe(false)
    expect(r.files.map((x) => x.path)).toEqual(['src/ui/Button.tsx'])
  })

  it('flags history that no longer contains what GitHub had before', () => {
    expect(directRange(run, local, pushed, forced).rewritten).toBe(true)
  })

  it('nothing new when GitHub has not moved', () => {
    expect(directRange(run, local, pushed, pushed)).toEqual({ base: pushed, rewritten: false, files: [] })
  })
})
