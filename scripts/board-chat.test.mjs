// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appendMessage,
  buildMessage,
  checkWriteRequest,
  createServer,
  isReservedWebName,
  listEditableDocs,
  newMessagesFor,
  parseChannel,
  readChannel,
  readCollabDoc,
  resolveCollabDocPath,
  saveCollabDoc,
  summarizeDoc,
  taipeiIso,
  tokenMatches,
  validateServerConfig,
} from './board-chat.mjs'

describe('board-chat', () => {
  it('formats timestamps in Taipei time', () => {
    expect(taipeiIso(new Date('2026-11-13T10:05:09.123Z'))).toBe('2026-11-13T18:05:09+08:00')
  })

  it('builds a message with id, time and trimmed fields', () => {
    const m = buildMessage({ from: 'Fable', to: 'Argon', topic: ' 交接 ', body: ' 內容 ' }, new Date('2026-11-13T10:00:00Z'))
    expect(m).toMatchObject({ from: 'Fable', to: 'Argon', topic: '交接', body: '內容', at: '2026-11-13T18:00:00+08:00' })
    expect(m.id).toMatch(/^m[a-z0-9]+$/)
  })

  it('gives both co-heads the same right to speak and rejects anyone else', () => {
    expect(buildMessage({ from: 'Argon', topic: 't', body: 'b' }).to).toBe('全體')
    expect(() => buildMessage({ from: 'Outreach', topic: 't', body: 'b' })).toThrow(/--from/)
  })

  it('lets the process chief speak from the CLI but never from the web', () => {
    expect(buildMessage({ from: '流程長', to: '全體', topic: 't', body: 'b' }).from).toBe('流程長')
    expect(() => buildMessage({ from: '流程長', source: 'web', topic: 't', body: 'b' })).toThrow(/禁止冒充/)
  })

  it('rejects unknown audiences', () => {
    expect(() => buildMessage({ from: 'Fable', to: '客戶', topic: 't', body: 'b' })).toThrow(/--to/)
  })

  it('requires a topic and a body, and caps the body length', () => {
    expect(() => buildMessage({ from: 'Fable', body: 'b' })).toThrow(/topic/)
    expect(() => buildMessage({ from: 'Fable', topic: 't' })).toThrow(/內容/)
    expect(() => buildMessage({ from: 'Fable', topic: 't', body: 'x'.repeat(6001) })).toThrow(/最多/)
  })

  it('appends without rewriting earlier lines and skips broken lines when reading', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'board-chat-')), 'channel.jsonl')
    const first = appendMessage(buildMessage({ from: 'Fable', topic: 'a', body: '一' }), file)
    fs.appendFileSync(file, 'not json\n')
    const second = appendMessage(buildMessage({ from: 'Argon', topic: 'b', body: '二', replyTo: first.id }), file)
    const messages = readChannel(file)
    expect(messages.map((m) => m.id)).toEqual([first.id, second.id])
    expect(messages[1].replyTo).toBe(first.id)
    expect(fs.readFileSync(file, 'utf8').split('\n')[0]).toBe(JSON.stringify(first))
  })

  it('wakes each side only for unseen messages from the other side', () => {
    const messages = [
      { id: 'a', from: 'Fable', to: 'Argon', body: '1' },
      { id: 'b', from: 'Argon', to: 'Fable', body: '2' },
      { id: 'c', from: 'CEO', to: '全體', body: '3' },
      { id: 'd', from: 'Argon', to: 'CEO', body: '4' },
    ]
    expect(newMessagesFor('Fable', messages, new Set(['a'])).map((m) => m.id)).toEqual(['b', 'c'])
    expect(newMessagesFor('Argon', messages, new Set()).map((m) => m.id)).toEqual(['a', 'c'])
    expect(newMessagesFor('Fable', messages, new Set(['a', 'b', 'c', 'd']))).toEqual([])
  })

  it('returns an empty list for a missing or empty channel', () => {
    expect(readChannel(path.join(os.tmpdir(), 'no-such-channel.jsonl'))).toEqual([])
    expect(parseChannel('')).toEqual([])
  })

  it('reads the title and status from proposals and observer reports', () => {
    expect(summarizeDoc('PROP-0003', '# PROP-0003: 收尾\n\n- **狀態**: `DONE` (`DISCUSSING` | `DONE`)\n')).toEqual({
      name: 'PROP-0003',
      title: 'PROP-0003: 收尾',
      status: 'DONE',
    })
    expect(summarizeDoc('OBS-0003', '# OBS-0003: 複審\n- **整體建議**: `HOLD_FOR_FIX`\n').status).toBe('HOLD_FOR_FIX')
  })

  it('prevents web clients from spoofing Fable, Argon, or CEO while allowing collaborators to wake co-heads', () => {
    expect(() => buildMessage({ from: 'Fable', source: 'web', author: '冒充者', topic: 't', body: 'b' })).toThrow(/禁止冒充/)
    expect(() => buildMessage({ from: 'Argon', source: 'web', author: '冒充者', topic: 't', body: 'b' })).toThrow(/禁止冒充/)
    expect(() => buildMessage({ from: 'CEO', source: 'web', author: '冒充者', topic: 't', body: 'b' })).toThrow(/禁止冒充/)
    expect(() => buildMessage({ from: '協作者', source: 'web', topic: 't', body: 'b' })).toThrow(/顯示名稱/)

    const ext = buildMessage({ from: '協作者', source: 'web', author: '林廠長', to: '全體', topic: '需求補充', body: '我們需要空壓機同業實績' })
    expect(ext).toMatchObject({ from: '協作者', author: '林廠長', source: 'web', to: '全體' })
    expect(newMessagesFor('Argon', [ext], new Set()).map((m) => m.id)).toEqual([ext.id])
    expect(newMessagesFor('Fable', [ext], new Set()).map((m) => m.id)).toEqual([ext.id])

    const chair = buildMessage({ from: '董事長', source: 'web', topic: '指示', body: '同意優先處理' })
    expect(chair).toMatchObject({ from: '董事長', author: '董事長', source: 'web' })
  })

  it('enforces doc allowlist, blocks path traversal, and prevents overwrite via expectedMtimeMs lock', () => {
    const tmpGov = fs.mkdtempSync(path.join(os.tmpdir(), 'board-gov-'))
    fs.mkdirSync(path.join(tmpGov, 'proposals'), { recursive: true })
    fs.writeFileSync(path.join(tmpGov, 'TEAM.md'), '# 團隊\n初始內容\n')
    fs.writeFileSync(path.join(tmpGov, 'STATUS.md'), '# 狀態\n正常\n')
    fs.writeFileSync(path.join(tmpGov, 'proposals', 'PROP-0004.md'), '# PROP-0004\n內容\n')
    fs.writeFileSync(path.join(tmpGov, 'SECRET.md'), 'do not expose')

    expect(listEditableDocs(tmpGov).map((d) => d.docId)).toEqual(['TEAM.md', 'STATUS.md', 'proposals/PROP-0004.md'])
    expect(() => resolveCollabDocPath('../package.json', tmpGov)).toThrow(/不允許存取/)
    expect(() => resolveCollabDocPath('SECRET.md', tmpGov)).toThrow(/不允許存取/)
    expect(() => resolveCollabDocPath('channel.jsonl', tmpGov)).toThrow(/不允許存取/)

    const loaded = readCollabDoc('proposals/PROP-0004.md', tmpGov)
    const commented = saveCollabDoc(
      {
        docId: 'proposals/PROP-0004.md',
        expectedMtimeMs: loaded.mtimeMs,
        mode: 'appendComment',
        from: '協作者',
        author: '陳顧問',
        comment: '建議加上同業年份條件',
      },
      tmpGov,
      new Date('2026-11-13T10:30:00Z'),
    )
    expect(commented.content).toContain('**[協作者] 陳顧問**（2026-11-13 18:30）：建議加上同業年份條件')

    // Proposals carry the sign-off section: the web may only append comments, never rewrite (OBS-0004 §2-3).
    const fresh = readCollabDoc('proposals/PROP-0004.md', tmpGov)
    expect(() =>
      saveCollabDoc(
        { docId: 'proposals/PROP-0004.md', expectedMtimeMs: fresh.mtimeMs, mode: 'edit', from: '董事長', author: '陳顧問', content: '# 覆蓋\n雙簽確認：已簽' },
        tmpGov,
      ),
    ).toThrow(/只能留評/)
    expect(readCollabDoc('proposals/PROP-0004.md', tmpGov).content).not.toContain('# 覆蓋')

    // TEAM.md / STATUS.md can still be edited, behind the optimistic lock.
    const team = readCollabDoc('TEAM.md', tmpGov)
    expect(() =>
      saveCollabDoc(
        { docId: 'TEAM.md', expectedMtimeMs: team.mtimeMs - 5000, mode: 'edit', from: '協作者', author: '陳顧問', content: '# 覆蓋' },
        tmpGov,
      ),
    ).toThrow(/修改過/)

    // Reserved names are rejected for doc writes too.
    expect(() =>
      saveCollabDoc(
        { docId: 'TEAM.md', expectedMtimeMs: team.mtimeMs, mode: 'appendComment', from: '董事長', author: 'Fable', comment: 'x' },
        tmpGov,
      ),
    ).toThrow(/不得使用/)
  })

  it('never lets a web display name be Fable, Argon or CEO, whatever the role (OBS-0004 §2-3)', () => {
    for (const author of ['Fable', 'argon', 'ＣＥＯ', 'Fable 董事長', ' C E O ', '流程長', 'External Observer']) {
      expect(isReservedWebName(author)).toBe(true)
      expect(() => buildMessage({ from: '董事長', source: 'web', author, topic: 't', body: 'b' })).toThrow(/不得使用/)
      expect(() => buildMessage({ from: '協作者', source: 'web', author, topic: 't', body: 'b' })).toThrow(/不得使用/)
    }
    expect(isReservedWebName('林廠長')).toBe(false)
    // The CLI still speaks as Fable / Argon / CEO.
    expect(buildMessage({ from: 'Fable', author: 'Fable', topic: 't', body: 'b' }).from).toBe('Fable')
  })

  it('requires JSON and a same-port localhost Origin for every write', () => {
    const ok = { 'content-type': 'application/json', origin: 'http://127.0.0.1:4175' }
    expect(checkWriteRequest(ok, 4175)).toBeNull()
    expect(checkWriteRequest({ ...ok, origin: 'http://localhost:4175' }, 4175)).toBeNull()
    expect(checkWriteRequest({ ...ok, 'content-type': 'text/plain' }, 4175)?.status).toBe(415)
    expect(checkWriteRequest({ 'content-type': 'application/json' }, 4175)?.status).toBe(403)
    expect(checkWriteRequest({ ...ok, origin: 'https://evil.example' }, 4175)?.status).toBe(403)
    expect(checkWriteRequest({ ...ok, origin: 'http://127.0.0.1:4173' }, 4175)?.status).toBe(403)
    expect(checkWriteRequest({ ...ok, origin: 'null' }, 4175)?.status).toBe(403)
  })

  it('requires invite token when binding non-local host and verifies tokens in constant time', async () => {
    expect(() => validateServerConfig({ host: '0.0.0.0', token: '' })).toThrow(/--token/)
    expect(() => validateServerConfig({ host: '127.0.0.1', token: '' })).not.toThrow()
    expect(tokenMatches('secret-123', 'secret-123')).toBe(true)
    expect(tokenMatches('secret-123', 'wrong')).toBe(false)
    expect(tokenMatches('', '')).toBe(true)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'board-srv-'))
    const govDir = path.join(tmpRoot, 'docs', 'governance')
    fs.mkdirSync(path.join(govDir, 'proposals'), { recursive: true })
    fs.writeFileSync(path.join(govDir, 'TEAM.md'), '# 團隊\n')
    fs.writeFileSync(path.join(govDir, 'STATUS.md'), '# 狀態\n')
    fs.writeFileSync(path.join(govDir, 'proposals', 'PROP-0004.md'), '# PROP-0004\n內容\n')
    const channelPath = path.join(govDir, 'channel.jsonl')

    const server = createServer({
      host: '127.0.0.1',
      port: 0,
      token: 'invite-xyz',
      rootDir: tmpRoot,
      governanceDir: govDir,
      channelPath,
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const addr = server.address()
      const base = `http://127.0.0.1:${addr.port}`

      const health = await fetch(`${base}/api/health`).then((r) => r.json())
      expect(health).toEqual({ ok: true, tokenRequired: true })

      const denied = await fetch(`${base}/api/state`)
      expect(denied.status).toBe(401)

      // Token only from the header, never the URL.
      const urlToken = await fetch(`${base}/api/state?token=invite-xyz`)
      expect(urlToken.status).toBe(400)

      // CSRF: text/plain or a foreign Origin can't post, even with the token.
      const plain = await fetch(`${base}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'x-board-token': 'invite-xyz', Origin: base },
        body: JSON.stringify({ from: '董事長', topic: 'hi', body: 'nope' }),
      })
      expect(plain.status).toBe(415)
      const foreign = await fetch(`${base}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz', Origin: 'https://evil.example' },
        body: JSON.stringify({ from: '董事長', topic: 'hi', body: 'nope' }),
      })
      expect(foreign.status).toBe(403)
      const noOrigin = await fetch(`${base}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz' },
        body: JSON.stringify({ from: '董事長', topic: 'hi', body: 'nope' }),
      })
      expect(noOrigin.status).toBe(403)
      expect(readChannel(channelPath)).toHaveLength(0)

      const spoof = await fetch(`${base}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz', Origin: base },
        body: JSON.stringify({ from: 'Argon', author: 'fake', topic: 'hi', body: 'nope' }),
      })
      expect(spoof.status).toBe(400)

      const created = await fetch(`${base}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz', Origin: base },
        body: JSON.stringify({ from: '協作者', author: '王顧問', to: 'CEO', topic: '共編測試', body: '測試成功' }),
      })
      expect(created.status).toBe(201)

      const docRes = await fetch(`${base}/api/doc?id=${encodeURIComponent('proposals/PROP-0004.md')}`, {
        headers: { 'x-board-token': 'invite-xyz' },
      }).then((r) => r.json())
      expect(docRes.docId).toBe('proposals/PROP-0004.md')

      const saveOk = await fetch(`${base}/api/doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz', Origin: base },
        body: JSON.stringify({
          docId: 'proposals/PROP-0004.md',
          expectedMtimeMs: docRes.mtimeMs,
          mode: 'appendComment',
          from: '協作者',
          author: '王顧問',
          comment: 'HTTP 共編驗證',
        }),
      })
      expect(saveOk.status).toBe(200)

      const conflict = await fetch(`${base}/api/doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-board-token': 'invite-xyz', Origin: base },
        body: JSON.stringify({
          docId: 'proposals/PROP-0004.md',
          expectedMtimeMs: docRes.mtimeMs,
          mode: 'appendComment',
          from: '協作者',
          author: '王顧問',
          comment: '過期版本送出',
        }),
      })
      expect(conflict.status).toBe(409)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
