import { describe, expect, it } from 'vitest'
import { buildStallWatchPlist, findReviewOverdue, findStalls, newStalls, notificationText, parseChannel } from './stall-watch.mjs'

const msg = (id, at, from, to, topic = 't') => ({ id, at, from, to, topic, body: '' })
const NOW = Date.parse('2026-11-15T09:20:00+08:00')

describe('stall-watch', () => {
  it('flags the 11/14 22:00 case: Argon asked Fable, Fable silent for 11 hours', () => {
    const messages = [
      msg('a1', '2026-11-14T21:46:00+08:00', 'Fable', 'Argon'),
      msg('a2', '2026-11-14T22:00:00+08:00', 'Argon', 'Fable', '請複走解鎖 4b'),
    ]
    const stalls = findStalls(messages, NOW)
    expect(stalls).toHaveLength(1)
    expect(stalls[0]).toMatchObject({ id: 'a2', from: 'Argon', waitingOn: 'Fable' })
    expect(stalls[0].minutes).toBe(11 * 60 + 20)
  })

  it('flags a round summary the process chief has not reviewed after 2 hours (C-36)', () => {
    const summary = msg('s1', '2026-11-15T10:00:00+08:00', 'CEO', '全體', '第 5 輪摘要')
    const now = Date.parse('2026-11-15T12:30:00+08:00')
    const out = findReviewOverdue([summary], now)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'review:s1', waitingOn: '流程長', minutes: 150 })
    expect(findReviewOverdue([summary], Date.parse('2026-11-15T11:30:00+08:00'))).toHaveLength(0)
    const reviewed = [summary, msg('c1', '2026-11-15T11:00:00+08:00', '流程長', '全體')]
    expect(findReviewOverdue(reviewed, now)).toHaveLength(0)
    expect(findReviewOverdue([msg('x', '2026-11-15T10:00:00+08:00', 'CEO', '全體', '開工：5')], now)).toHaveLength(0)
  })

  it('is quiet once the addressee posts anything later', () => {
    const messages = [
      msg('a2', '2026-11-14T22:00:00+08:00', 'Argon', 'Fable'),
      msg('f1', '2026-11-15T09:19:00+08:00', 'Fable', '全體'),
    ]
    expect(findStalls(messages, NOW)).toEqual([])
  })

  it('ignores broadcasts, messages under the threshold, and anything older than 48 hours', () => {
    const messages = [
      msg('b1', '2026-11-15T07:00:00+08:00', 'Argon', '全體'),
      msg('b2', '2026-11-15T08:40:00+08:00', 'Argon', 'Fable'),
      msg('b3', '2026-11-12T08:00:00+08:00', 'Fable', 'Argon'),
    ]
    expect(findStalls(messages, NOW)).toEqual([])
  })

  it('reports the longest wait per addressee, and both directions', () => {
    const messages = [
      msg('x1', '2026-11-15T06:00:00+08:00', 'Argon', 'Fable'),
      msg('x2', '2026-11-15T07:00:00+08:00', 'Argon', 'Fable'),
      msg('x3', '2026-11-15T07:30:00+08:00', 'Fable', 'Argon'),
    ]
    // Fable 07:30 posted, so x1/x2 are answered; x3 waits on Argon.
    expect(findStalls(messages, NOW).map((s) => s.id)).toEqual(['x3'])
    const both = [msg('y1', '2026-11-15T06:00:00+08:00', 'Argon', 'Fable'), msg('y2', '2026-11-15T06:10:00+08:00', 'CEO', 'Argon')]
    expect(findStalls(both, NOW).map((s) => s.waitingOn).sort()).toEqual(['Argon', 'Fable'])
  })

  it('notifies each stall once', () => {
    const stalls = [{ id: 'a2' }, { id: 'a3' }]
    expect(newStalls(stalls, ['a2'])).toEqual([{ id: 'a3' }])
  })

  it('writes a Chinese notification that names who waits on whom', () => {
    const text = notificationText({ id: 'a2', from: 'Argon', waitingOn: 'Fable', topic: '請複走解鎖 4b', at: '', minutes: 680 })
    expect(text.title).toBe('綠媒：Argon 在等 Fable（11 小時）')
    expect(text.body).toContain('請叫醒 Fable')
  })

  it('skips malformed channel lines', () => {
    expect(parseChannel('{"id":"1","at":"2026-11-15T00:00:00Z","from":"A","to":"B"}\nnot json\n\n')).toHaveLength(1)
  })

  it('builds a 10-minute launchd job that runs `run`', () => {
    const plist = buildStallWatchPlist({ nodePath: '/usr/bin/node', rootDir: '/r', logDir: '/l' })
    expect(plist).toContain('<string>/r/scripts/stall-watch.mjs</string>')
    expect(plist).toContain('<string>run</string>')
    expect(plist).toContain('<integer>600</integer>')
  })
})
