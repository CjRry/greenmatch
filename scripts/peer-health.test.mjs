import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { inspectPeerHealth, scanTranscriptTail } from './peer-health.mjs'

describe('peer-health', () => {
  it('detects rate_limit and reset text from transcript tail', () => {
    const sample = [
      JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:12:40.000Z', message: { role: 'assistant' } }),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-11-13T10:12:52.000Z',
        error: 'rate_limit',
        isApiErrorMessage: true,
        message: { content: [{ type: 'text', text: "You've hit your limit · resets 9:50pm (Asia/Taipei)" }] },
      }),
    ].join('\n')
    const scan = scanTranscriptTail(sample)
    expect(scan.latestRateLimitMs).toBe(Date.parse('2026-11-13T10:12:52.000Z'))
    expect(scan.latestOkMs).toBe(Date.parse('2026-11-13T10:12:40.000Z'))
    expect(scan.resetText).toContain('resets 9:50pm')
  })

  it('flags Fable as rate_limited and bypass-eligible when rate_limit is newer than healthy turns and channel replies', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-health-'))
    const logFile = path.join(dir, 'session.jsonl')
    fs.writeFileSync(
      logFile,
      [
        JSON.stringify({ type: 'user', timestamp: '2026-11-13T10:12:00.000Z' }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-11-13T10:12:52.000Z',
          error: 'rate_limit',
          message: { content: [{ type: 'text', text: "You've hit your limit · resets 9:50pm (Asia/Taipei)" }] },
        }),
      ].join('\n'),
    )
    const health = inspectPeerHealth({
      projectDir: dir,
      nowMs: Date.parse('2026-11-13T10:17:00.000Z'),
      messages: [
        { id: 'm1', from: 'Fable', to: 'Argon', at: '2026-11-13T18:03:00+08:00', body: 'hi' },
        { id: 'm2', from: 'Argon', to: 'Fable', at: '2026-11-13T18:05:30+08:00', body: 'ack' },
      ],
      checkListener: () => false,
    })
    expect(health.status).toBe('rate_limited')
    expect(health.bypassEligible).toBe(true)
    expect(health.resetText).toContain('resets 9:50pm')
  })

  it('ignores user task-notification rows after rate_limit and treats synthetic auth/rate errors as blocked', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-health-notif-'))
    const logFile = path.join(dir, 'session.jsonl')
    fs.writeFileSync(
      logFile,
      [
        JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:12:40.000Z', message: { model: 'claude-fable-5-2' } }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-11-13T10:12:52.000Z',
          error: 'rate_limit',
          message: { model: '<synthetic>', content: [{ type: 'text', text: "You've hit your limit · resets 9:50pm (Asia/Taipei)" }] },
        }),
        JSON.stringify({ type: 'user', timestamp: '2026-11-13T10:19:06.000Z', message: { content: '<task-notification>' } }),
        JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:19:07.000Z', error: 'authentication_failed', message: { model: '<synthetic>' } }),
      ].join('\n'),
    )
    const health = inspectPeerHealth({
      projectDir: dir,
      nowMs: Date.parse('2026-11-13T10:20:00.000Z'),
      messages: [],
      checkListener: () => false,
    })
    expect(health.status).toBe('rate_limited')
    expect(health.resetText).toContain('resets 9:50pm')
  })

  it('automatically recovers to online once Fable posts or completes a healthy turn after reset', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-health-rec-'))
    const logFile = path.join(dir, 'session.jsonl')
    fs.writeFileSync(
      logFile,
      [
        JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:12:52.000Z', error: 'rate_limit' }),
        JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T13:51:00.000Z', message: { role: 'assistant' } }),
      ].join('\n'),
    )
    const health = inspectPeerHealth({
      projectDir: dir,
      nowMs: Date.parse('2026-11-13T13:51:30.000Z'),
      messages: [],
      checkListener: () => true,
    })
    expect(health.status).toBe('online')
    expect(health.bypassEligible).toBe(false)
  })

  it('falls back to offline_unresponsive when wait listener died and Argon has awaited >3m', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-health-off-'))
    const health = inspectPeerHealth({
      projectDir: dir,
      nowMs: Date.parse('2026-11-13T18:10:00+08:00'),
      messages: [
        { id: 'm1', from: 'Fable', to: 'Argon', at: '2026-11-13T18:03:00+08:00', body: 'hi' },
        { id: 'm2', from: 'Argon', to: 'Fable', at: '2026-11-13T18:05:30+08:00', body: 'ack' },
      ],
      checkListener: () => false,
    })
    expect(health.status).toBe('offline_unresponsive')
    expect(health.listenerAlive).toBe(false)
  })

  it('does not falsely report online when process probe returns null while awaiting reply', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-health-null-'))
    const logFile = path.join(dir, 'session.jsonl')
    fs.writeFileSync(
      logFile,
      JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:00:00.000Z', message: { role: 'assistant' } }),
    )
    const health = inspectPeerHealth({
      projectDir: dir,
      nowMs: Date.parse('2026-11-13T18:10:00+08:00'),
      messages: [
        { id: 'm1', from: 'Fable', to: 'Argon', at: '2026-11-13T18:03:00+08:00', body: 'hi' },
        { id: 'm2', from: 'Argon', to: 'Fable', at: '2026-11-13T18:05:30+08:00', body: 'ack' },
      ],
      checkListener: () => null,
    })
    expect(health.status).toBe('unknown')
    expect(health.listenerAlive).toBeNull()
  })
})
