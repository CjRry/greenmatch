import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appendFeedbackEntry,
  createRateLimiter,
  extractBrowserFamily,
  sanitizeFeedbackPayload,
} from './feedback-handler.mjs'

const validPayload = () => ({
  source: 'web-form',
  feedbackRole: 'factory',
  roleLabel: '工廠',
  orgName: '  永豐金屬加工廠  ',
  scores: { ease: 5, clarity: 4, trust: 4, usefulness: 5, visual: 5 },
  perItem: { ease: 25, clarity: 16, trust: 16, usefulness: 20, visual: 15 },
  total: 92,
  nps: 9,
  liked: '補助試算很清楚',
  improve: '希望補充更多縣市方案',
  subject: '[GreenMatch 試用回饋] 工廠｜總分 92/100',
  body: '測試內文',
})

describe('feedback-handler (PROP-0001 Part B)', () => {
  it('whitelists fields, strips unknown fields including client isTest, and recomputes totals', () => {
    const clean = sanitizeFeedbackPayload({
      ...validPayload(),
      total: 9999, // spoofed total ignored
      isTest: true, // client isTest stripped
      adminOverride: 'drop tables',
      extraNested: { evil: 1 },
      liked: 'a'.repeat(2500),
    })
    expect(clean.total).toBe(92)
    expect(clean.orgName).toBe('永豐金屬加工廠')
    expect(clean.liked.length).toBe(2000)
    expect('isTest' in clean).toBe(false)
    expect('adminOverride' in clean).toBe(false)
    expect('extraNested' in clean).toBe(false)
  })

  it('rejects missing or out-of-range scores, nps, or invalid role', () => {
    expect(() => sanitizeFeedbackPayload({ ...validPayload(), feedbackRole: 'hacker' })).toThrow()
    expect(() =>
      sanitizeFeedbackPayload({ ...validPayload(), scores: { ease: 6, clarity: 4, trust: 4, usefulness: 4, visual: 4 } }),
    ).toThrow()
    expect(() => sanitizeFeedbackPayload({ ...validPayload(), nps: 11 })).toThrow()
  })

  it('reduces full User-Agent strings to browser family only', () => {
    expect(extractBrowserFamily('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36')).toBe('Chrome')
    expect(extractBrowserFamily('Mozilla/5.0 HeadlessChrome/131.0.0.0')).toBe('HeadlessChrome')
    expect(extractBrowserFamily('Mozilla/5.0 (iPhone) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari')
    expect(extractBrowserFamily('')).toBe('Unknown')
  })

  it('enforces per-IP rate limiting and log file size cap while preserving IP', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-fb-'))
    const logPath = path.join(dir, 'live-feedback.jsonl')
    try {
      const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 })
      const now = new Date('2026-11-13T08:45:00.000Z')
      const saved = appendFeedbackEntry({
        logPath,
        payload: validPayload(),
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0 Chrome/131.0',
        rateLimiter: limiter,
        maxLogBytes: 2048,
        now,
      })
      expect(saved.ip).toBe('203.0.113.10')
      expect(saved.browserFamily).toBe('Chrome')

      appendFeedbackEntry({
        logPath,
        payload: validPayload(),
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0 Chrome/131.0',
        rateLimiter: limiter,
        maxLogBytes: 2048,
        now,
      })

      // 3rd request from same IP hits rate limit (429)
      expect(() =>
        appendFeedbackEntry({
          logPath,
          payload: validPayload(),
          ip: '203.0.113.10',
          userAgent: 'Mozilla/5.0 Chrome/131.0',
          rateLimiter: limiter,
          maxLogBytes: 2048,
          now,
        }),
      ).toThrow(/Too many/)

      // Different IP hits file size cap (507)
      expect(() =>
        appendFeedbackEntry({
          logPath,
          payload: validPayload(),
          ip: '203.0.113.11',
          userAgent: 'Mozilla/5.0 Chrome/131.0',
          rateLimiter: limiter,
          maxLogBytes: 300,
          now,
        }),
      ).toThrow(/size limit/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
