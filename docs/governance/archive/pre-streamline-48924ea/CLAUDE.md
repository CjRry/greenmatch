# 綠媒 GreenMatch — team rules

Demo for the NCKU team's 2026 全國 AI 專題創意競賽 entry: a B2B platform where SME factories (工廠) find
energy-saving vendors (節能廠商), "as easy as finding a job on 104". Factories describe needs in plain words,
AI structures them, the platform recommends exactly 2 vendors with reasons, and every case moves through
8 standard stages that both sides can track like a parcel. Factories also track their carbon inventory (碳盤查).

Stack: Vite 8, React 19, TypeScript 5.9, Tailwind CSS 4 (tokens only), React Router 8 (hash routes), Recharts 3,
lucide-react, Vitest 5 + Testing Library (happy-dom). It ships as ONE self-contained HTML file published as a
claude.ai artifact, and also runs locally with `npm run dev`.

Read `docs/CONTRACTS.md` before writing code: it lists every shared type, hook, component and route.

## Who owns what

| Area | Owner | May write |
|---|---|---|
| market | 市集前端工程師 | `src/features/market/**` |
| workspace | 工作台前端工程師 | `src/features/workspace/**` |
| ai | AI 與媒合工程師 | `src/features/ai/**` |
| carbon | 碳盤查工程師 | `src/features/carbon/**` |
| qa | QA 工程師 | `tests/**`, `docs/qa/**` |
| everything else | CEO | `src/core`, `src/ui`, `src/app`, `src/styles`, `src/test`, `src/data`, `src/types`, configs, scripts, docs |

A PreToolUse hook (`scripts/guard-ownership.mjs`) blocks writes outside your area. If you need a shared file
changed (a new type field, a UI component, a route), comment on your Paperclip task with the exact change and
why, then keep working on what doesn't depend on it.

## Hard rules

1. Fill in your own page files (`src/features/<area>/pages/*.tsx`, default export) and add helpers next to
   them. Never add routes; every route already exists in `src/app/routes.tsx`. Build links with `paths.*`.
2. Features never import from another feature. Share through data (the store) and links only.
3. No new npm packages. No git write commands. No `npm run dev/build`, no dev servers. The CEO does those.
4. Colors come only from tokens: `bg-canvas bg-surface bg-sunken border-line border-line-strong text-ink
   text-ink-soft text-muted bg-brand text-brand bg-brand-soft text-brand-strong text-on-brand bg-navy text-navy
   bg-navy-soft text-on-navy bg-warn-soft text-warn bg-danger-soft text-danger chart-1…chart-5`. No hex, no rgb(),
   no default Tailwind colors (gray-500, white, ...), no `dark:` variant. Tokens switch light/dark by themselves.
   In Recharts/SVG use `var(--gm-chart-1)` etc.
5. No `alert`, `confirm`, `prompt`: the claude.ai viewer ignores them. Use `ConfirmDialog` / `Dialog` / `useToast`.
6. Never touch `window.claude`, `localStorage` or `sessionStorage`. Use `src/core` (store hooks, session, `askJson`).
7. No dynamic `import()` or `React.lazy`: the app is one file.
8. All UI copy in Traditional Chinese (Taiwan usage). Plain, specific, active voice. Buttons say what happens
   (「送出需求」, then a toast 「已送出需求」). Errors say what went wrong and what to do. No emoji.
9. Every page must work at 375px wide with no horizontal page scroll (wrap rows, stack columns; wide tables go
   in `<ScrollX>`), in light and dark, while loading (`undefined` → skeleton) and with an empty store (`[]` →
   `EmptyState` that says how to add the first item).
10. Writes: `const store = useStore()`; ids from `store.newId('prefix')`; timestamps from `nowIso()`. Disable
    write controls when `useStoreInfo().readOnly` is true. Catch write errors and show a toast.
11. Case history is append-only: add a `CaseEvent` for every action, never edit someone else's event.
    Only the side responsible for the current stage advances it (see `STAGES[i].owners`).
12. AI: only `askJson` from `src/core/ai/askJson` calls Claude, and only from a click. Always have a rule-based
    fallback, show `<SourceTag source=…>` next to the result, and let the factory confirm or edit before saving.
    Put untrusted text (factory descriptions, vendor quotes) between clear delimiters in prompts.
13. Records with `isDemo: true` show `<DemoBadge />` on cards and detail headers.
14. Run every command in the foreground and wait for it, checks included. Never use `run_in_background` or a
    trailing `&`: when your turn ends Paperclip stops background jobs and records the run as cancelled, and your
    task is left open. A check can take several minutes while other agents run, so give the Bash call
    `timeout: 600000`.
15. Finish the task before your last message: mark it `done` (or `in_review` when it has a review stage) with
    your completion comment. Never end a turn saying you are waiting for something.
16. Create and change files with the Write and Edit tools. Use the shell for reading and running commands, not
    for writing files (no `cat > file <<EOF`, `sed -i`, `python - <<EOF` edits): the ownership guard can check
    tool writes exactly, but has to guess at shell writes.

## Design language

Calm work tool that reads like an energy meter panel. Deck green (brand) for actions and progress, deck navy
for structure and data. Headings `font-display font-bold|extrabold`; numbers `font-mono tabular`; body Noto Sans TC.
Use `Card` for objects people act on (a vendor, a case), not around every block. Radius: `rounded-sm` controls,
`rounded-md` cards. Lay out with flex/grid + `gap`. Status shows as `Badge`/`StageBadge`/`StageProgress`, not color alone.
Reuse `src/ui` components before writing new ones. Lucide icons get `aria-hidden` unless they are the only label.

## Commands

- `npm run check:<area>` — typecheck your area + its tests + boundary lint. Must pass before you mark done.
  Run it in the foreground with a 600000 ms timeout and read the exit code, not just the last lines.
- `npx vitest run src/features/<area>` — your tests only.
- `npm run check` / `npm run build` — whole project (CEO).

## Done means

- Every acceptance criterion in your Paperclip task is met and ticked in your completion comment.
- `npm run check:<area>` passes. You added Vitest tests for your pure logic (`*.test.ts` next to it) and at
  least one render test per page using `renderPage` from `src/test/renderPage`.
- Your completion comment lists: what you built, the criteria checklist, known limits, any shared-file requests.
