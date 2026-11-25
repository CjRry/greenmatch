// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyPath, isTeammateWritable, loadPolicy, matchGlob, normalizeRel } from './teammate-policy.mjs'

const policy = loadPolicy(fileURLToPath(new URL('..', import.meta.url)))

describe('matchGlob', () => {
  it('matches ** across folders and * within one', () => {
    expect(matchGlob('src/ui/**', 'src/ui/Button.tsx')).toBe(true)
    expect(matchGlob('src/ui/**', 'src/ui/a/b/c.tsx')).toBe(true)
    expect(matchGlob('src/ui/**', 'src/uikit/x.tsx')).toBe(false)
    expect(matchGlob('src/features/*/pages/**', 'src/features/market/pages/Landing.tsx')).toBe(true)
    expect(matchGlob('src/features/*/pages/**', 'src/features/market/lib/x.ts')).toBe(false)
    expect(matchGlob('*.config.*', 'vite.config.ts')).toBe(true)
    expect(matchGlob('CLAUDE.md', 'CLAUDE.md')).toBe(true)
  })
})

describe('classifyPath', () => {
  it.each([
    ['src/ui/Button.tsx', 'small'],
    ['src/features/ai/pages/NeedWizard.tsx', 'small'],
    ['src/features/market/components/VendorCard.tsx', 'small'],
    ['src/app/CaseCenter.tsx', 'small'],
    ['docs/design/homepage.md', 'small'],
    ['src/app/routes.tsx', 'forbidden'],
    ['src/core/store.ts', 'forbidden'],
    ['src/features/ai/lib/match.ts', 'other'],
    ['scripts/teammate-paths.json', 'forbidden'],
    ['CLAUDE.md', 'forbidden'],
    ['.claude/settings.json', 'forbidden'],
    ['docs/governance/BOARD_PROTOCOL.md', 'forbidden'],
    ['docs/governance/teammate/reports/R-1.md', 'report'],
    ['docs/governance/teammate/requests/REQ-1.md', 'request'],
    ['vite.config.ts', 'forbidden'],
    ['package.json', 'forbidden'],
  ])('%s → %s', (p, want) => {
    expect(classifyPath(p, policy)).toBe(want)
  })

  it('normalizes paths before classifying', () => {
    expect(normalizeRel('./src/ui/x.tsx')).toBe('src/ui/x.tsx')
    expect(normalizeRel('src\\ui\\x.tsx')).toBe('src/ui/x.tsx')
    expect(normalizeRel('../outside.txt')).toBeNull()
    expect(classifyPath('src/ui/../core/types.ts', policy)).toBe('forbidden')
    expect(classifyPath('../outside.txt', policy)).toBe('forbidden')
  })

  it.each([
    ['src/ui/CLAUDE.local.md'],
    ['src/ui/claude.md'],
    ['src/ui/.claude/skills/x/SKILL.md'],
    ['src/ui/AGENTS.md'],
    ['src/ui/.gitattributes'],
    ['src/ui/.env'],
    ['src/app/Routes.tsx'],
    ['SRC/CORE/store.ts'],
    ['docs/governance/teammate/reports/.claude/commands/x.md'],
    ['docs/governance/teammate/requests/CLAUDE.md'],
  ])('forbids instruction files, dotfiles and case variants anywhere: %s', (p) => {
    expect(classifyPath(p, policy)).toBe('forbidden')
  })

  it('lets the teammate write small paths and their own folder only', () => {
    expect(isTeammateWritable('src/styles/tokens.css', policy)).toBe(true)
    expect(isTeammateWritable('docs/governance/teammate/requests/REQ-a-001.md', policy)).toBe(true)
    expect(isTeammateWritable('src/features/ai/lib/match.ts', policy)).toBe(false)
    expect(isTeammateWritable('src/app/routes.tsx', policy)).toBe(false)
  })
})
