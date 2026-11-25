// Claude Code PreToolUse hook. Keeps each Paperclip agent inside its own files.
// The agent is identified by PAPERCLIP_AGENT_ID (injected by Paperclip into every run) and mapped
// to an area in scripts/agent-areas.json. Without a mapped id (the CEO, a person) everything is allowed.
// Exit code 2 blocks the tool call and shows stderr to the agent.
//
// Shell commands are parsed, not pattern-matched: heredoc bodies are skipped (code inside them is
// data), quotes are honoured, and `cd` plus the shell's current folder decide where relative paths
// point. This is a guardrail against mistakes, not a sandbox: writes made from inside a script
// (python, node -e) are not seen. The boundary lint and CEO review are the backstop.
import { readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const OWNED = {
  market: ['src/features/market/'],
  workspace: ['src/features/workspace/'],
  ai: ['src/features/ai/'],
  carbon: ['src/features/carbon/'],
  qa: ['tests/', 'docs/qa/'],
}

const DEVICES = new Set(['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/tty'])
const TEMP_DIRS = ['/tmp/', '/private/tmp/', '/var/folders/', '/private/var/folders/']
const GIT_WRITES = new Set([
  'commit', 'add', 'stash', 'reset', 'checkout', 'switch', 'restore', 'clean', 'push', 'pull', 'rebase',
  'merge', 'rm', 'mv', 'cherry-pick', 'revert', 'tag', 'apply', 'am', 'fetch', 'worktree',
])
const PKG_WRITES = new Set(['i', 'install', 'add', 'ci', 'uninstall', 'remove', 'rm', 'update', 'up', 'upgrade', 'link'])

/** Whether an absolute path is one this area may write. */
export function isAllowedPath(abs, area, projectDir) {
  if (!abs) return false
  if (DEVICES.has(abs) || TEMP_DIRS.some((t) => abs === t.slice(0, -1) || abs.startsWith(t))) return true
  const rel = relative(projectDir, abs)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false
  return (OWNED[area] ?? []).some((prefix) => rel === prefix.replace(/\/$/, '') || rel.startsWith(prefix))
}

/** Remove heredoc bodies (and their markers) so the code inside is never read as shell syntax. */
export function stripHeredocs(cmd) {
  const marker = /<<(?!<)(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z_][\w.-]*))/g
  const out = []
  const pending = []
  for (const line of cmd.split('\n')) {
    if (pending.length) {
      const { delim, dash } = pending[0]
      if ((dash ? line.replace(/^\t+/, '') : line) === delim) pending.shift()
      continue
    }
    for (const m of line.matchAll(marker)) pending.push({ dash: m[1] === '-', delim: m[2] ?? m[3] ?? m[4] })
    out.push(line.replace(marker, ''))
  }
  return out.join('\n')
}

/** Quote-aware shell tokenizer: words, redirections and control operators. */
export function tokenize(src) {
  const tokens = []
  let word = null
  const flush = () => {
    if (word !== null) tokens.push({ type: 'word', value: word })
    word = null
  }
  const add = (s) => {
    word = (word ?? '') + s
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)
    if (c === '\\') {
      if (src[i + 1] !== '\n') add(src[i + 1] ?? '')
      i += 2
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1)
      add(src.slice(i + 1, end < 0 ? src.length : end))
      i = end < 0 ? src.length : end + 1
    } else if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && '"\\$`\n'.includes(src[j + 1])) {
          s += src[j + 1]
          j += 2
        } else s += src[j++]
      }
      add(s)
      i = j + 1
    } else if (c === '$' && src[i + 1] === '(') {
      // Command substitution stays part of the word; its insides are not inspected.
      let depth = 0
      let j = i + 1
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++
        else if (src[j] === ')' && --depth === 0) break
      }
      add(src.slice(i, j + 1))
      i = j + 1
    } else if (c === '`') {
      const end = src.indexOf('`', i + 1)
      add(src.slice(i, end < 0 ? src.length : end + 1))
      i = end < 0 ? src.length : end + 1
    } else if (c === '#' && word === null) {
      const end = src.indexOf('\n', i)
      i = end < 0 ? src.length : end
    } else if (c === ' ' || c === '\t') {
      flush()
      i++
    } else if (c === '\n') {
      flush()
      tokens.push({ type: 'op', value: ';' })
      i++
    } else {
      const redir = (word === null ? /^(\d*)(&>>|&>|>>|>\||>&|>|<<<|<&|<>|<)/ : /^()(&>>|&>|>>|>\||>&|>|<<<|<&|<>|<)/).exec(rest)
      const op = /^(&&|\|\||\|&|;;|\||;|&|\(|\))/.exec(rest)
      if (redir && !(c === '&' && !redir[2].startsWith('&'))) {
        flush()
        tokens.push({ type: 'redir', value: redir[2], fd: redir[1] })
        i += redir[0].length
      } else if (op) {
        flush()
        tokens.push({ type: 'op', value: op[1] })
        i += op[1].length
      } else {
        add(c)
        i++
      }
    }
  }
  flush()
  return tokens
}

function resolveIn(dir, p, home) {
  if (p === undefined || p === null) return null
  if (p.startsWith('$TMPDIR') || p.startsWith('${TMPDIR}')) return '/tmp/' + p.replace(/^\$\{?TMPDIR\}?\/?/, '')
  if (p.includes('$') || p.includes('`')) return null
  if (p === '~' || p.startsWith('~/')) return home ? resolve(home, p.slice(2)) : null
  if (isAbsolute(p)) return resolve(p)
  return dir ? resolve(dir, p) : null
}

/** Drop env assignments and wrapper commands (timeout, env, nohup, ...) to reach the real command. */
function unwrap(argv) {
  const a = [...argv]
  while (a.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a[0])) a.shift()
    else if (['nohup', 'time', 'command', 'exec', 'nice', 'stdbuf'].includes(a[0])) a.shift()
    else if (a[0] === 'env') {
      a.shift()
      while (a.length && (a[0].startsWith('-') || /^[A-Za-z_]\w*=/.test(a[0]))) a.shift()
    } else if (a[0] === 'timeout' || a[0] === 'gtimeout') {
      a.shift()
      while (a.length && a[0].startsWith('-')) a.shift()
      a.shift()
    } else break
  }
  return a
}

const nonOptions = (args) => args.filter((x) => !x.startsWith('-') || x === '-')

/** Files a simple command writes, plus any command that is off limits for agents. */
function inspectCommand(argv) {
  const [cmd, ...args] = unwrap(argv)
  const writes = []
  let forbidden = null
  if (!cmd) return { writes, forbidden }
  if (cmd === 'sed' && args.some((x) => x === '-i' || x.startsWith('-i') || x.startsWith('--in-place') || /^-[a-zA-Z]*i/.test(x))) {
    let script = false
    const files = []
    for (let k = 0; k < args.length; k++) {
      const x = args[k]
      if (x === '-i' && args[k + 1] === '') k++ // macOS: sed -i '' ...
      else if (x === '-e' || x === '-f' || x === '--expression' || x === '--file') {
        script = true
        k++
      } else if (x.startsWith('--expression=') || x.startsWith('--file=')) script = true
      else if (x.startsWith('-') && x !== '-') continue
      else if (!script) script = true // first plain argument is the script
      else files.push(x)
    }
    writes.push(...files.map((f) => ({ path: f, via: 'sed -i' })))
  } else if (cmd === 'tee') {
    writes.push(...nonOptions(args).map((f) => ({ path: f, via: 'tee' })))
  } else if (cmd === 'cp' || cmd === 'install' || cmd === 'ln') {
    const t = args.indexOf('-t')
    const dest = t >= 0 ? args[t + 1] : nonOptions(args).at(-1)
    if (dest) writes.push({ path: dest, via: cmd })
  } else if (cmd === 'mv') {
    writes.push(...nonOptions(args).map((f) => ({ path: f, via: 'mv' })))
  } else if (cmd === 'rm') {
    if (args.some((x) => /^-[a-zA-Z]*[rR]/.test(x) || x === '--recursive')) forbidden = 'Recursive delete is not allowed.'
    writes.push(...nonOptions(args).map((f) => ({ path: f, via: 'rm' })))
  } else if (['mkdir', 'touch', 'truncate', 'rmdir'].includes(cmd)) {
    const files = []
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-m' || args[k] === '-s') k++
      else if (!args[k].startsWith('-')) files.push(args[k])
    }
    writes.push(...files.map((f) => ({ path: f, via: cmd })))
  } else if (cmd === 'git') {
    let k = 0
    while (k < args.length && args[k].startsWith('-')) k += args[k] === '-C' || args[k] === '-c' ? 2 : 1
    if (GIT_WRITES.has(args[k]) || (args[k] === 'branch' && args.some((x) => /^-[dDmM]$/.test(x))))
      forbidden = 'Git write commands are reserved for the CEO. Read-only git (status, diff, log, show) is fine.'
  } else if (cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn') {
    if (PKG_WRITES.has(args[0])) forbidden = 'Installing or removing packages is reserved for the CEO.'
    else if (args[0] === 'run' && ['dev', 'build', 'preview'].includes(args[1])) forbidden = 'dev-server'
  } else if ((cmd === 'npx' && args[0] === 'vite') || cmd === 'vite') {
    forbidden = 'dev-server'
  }
  return { writes, forbidden }
}

/** Parse a shell command into simple commands, the files they write and whether anything runs in the background. */
export function analyzeShell(command, cwd, home) {
  const tokens = tokenize(stripHeredocs(command))
  const commands = []
  const writes = []
  let background = false
  let dir = cwd
  const stack = []
  let cur = { argv: [], cwd: dir }
  const finish = () => {
    if (cur.argv.length) {
      commands.push(cur)
      const [name, target] = unwrap(cur.argv)
      if (name === 'cd' || name === 'pushd') {
        dir = target === undefined ? (home ?? null) : target === '-' ? null : resolveIn(dir, target, home)
      }
    }
    cur = { argv: [], cwd: dir }
  }
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.type === 'word') cur.argv.push(t.value)
    else if (t.type === 'redir') {
      const target = tokens[k + 1]?.type === 'word' ? tokens[++k].value : undefined
      if (t.value === '>&' && (target === undefined || /^(\d+|-)$/.test(target))) continue // fd duplication like 2>&1
      if (['>', '>>', '>|', '&>', '&>>', '>&', '<>'].includes(t.value) && target !== undefined) {
        writes.push({ raw: target, path: resolveIn(cur.cwd, target, home), via: 'redirect' })
      }
    } else if (t.value === '&') {
      background = true
      finish()
    } else if (t.value === '(') {
      finish()
      stack.push(dir)
    } else if (t.value === ')') {
      finish()
      dir = stack.length ? stack.pop() : dir
      cur.cwd = dir
    } else finish()
  }
  finish()
  for (const c of commands) {
    const { writes: w } = inspectCommand(c.argv)
    for (const x of w) writes.push({ raw: x.path, path: resolveIn(c.cwd, x.path, home), via: x.via })
  }
  return { commands, writes, background }
}

function block(reason) {
  return { allow: false, reason }
}

/** The whole policy as a pure function, so it can be tested. */
export function decide({ tool, input = {}, cwd, area, projectDir, home }) {
  const owned = (OWNED[area] ?? []).join(', ')
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const p = input.file_path ?? input.notebook_path
    if (p && !isAllowedPath(resolveIn(cwd || projectDir, p, home), area, projectDir)) return block(`Blocked ${tool} on ${p}.`)
    return { allow: true }
  }
  if (tool !== 'Bash') return { allow: true }

  const command = String(input.command ?? '')
  if (input.run_in_background) {
    return block(
      'Background commands are not allowed. Run it in the foreground and wait (give the Bash call a timeout of 600000 ms if it is slow). Paperclip stops background jobs when your turn ends and records the run as cancelled.',
    )
  }
  const { commands, writes, background } = analyzeShell(command, cwd || projectDir, home)
  if (background) {
    return block('A trailing `&` runs the command in the background, which is not allowed. Run it in the foreground and wait.')
  }
  for (const c of commands) {
    const { forbidden } = inspectCommand(c.argv)
    if (forbidden === 'dev-server') return block(`Only the CEO runs the dev server and builds. Use npm run check:${area}.`)
    if (forbidden) return block(forbidden)
  }
  for (const w of writes) {
    if (w.path === null) {
      return block(`Can't tell where \`${w.raw}\` points (it uses a variable or an unknown folder). Use the Write or Edit tool with a full path instead.`)
    }
    if (!isAllowedPath(w.path, area, projectDir)) return block(`Blocked a shell write (${w.via}) to ${w.path}. Your area may write only: ${owned}.`)
  }
  return { allow: true }
}

function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  let areas = {}
  try {
    areas = JSON.parse(readFileSync(join(projectDir, 'scripts/agent-areas.json'), 'utf8'))
  } catch {
    process.exit(0)
  }
  const area = areas[process.env.PAPERCLIP_AGENT_ID ?? '']?.area
  if (!area) process.exit(0)
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    process.exit(0)
  }
  const result = decide({
    tool: input.tool_name ?? '',
    input: input.tool_input ?? {},
    cwd: input.cwd || projectDir,
    area,
    projectDir,
    home: process.env.HOME,
  })
  if (!result.allow) {
    process.stderr.write(
      `[GreenMatch ownership guard] ${result.reason}\nYour area (${area}) may write only: ${(OWNED[area] ?? []).join(', ')}. To change a shared file, comment on your Paperclip task and ask the CEO.\n`,
    )
    process.exit(2)
  }
  process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
