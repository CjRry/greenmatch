import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024 // 5 MB
export const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000 // 10 min
export const DEFAULT_RATE_MAX = 10

const SCORE_WEIGHTS = {
  ease: 5,
  clarity: 4,
  trust: 4,
  usefulness: 4,
  visual: 3,
}

const ROLE_LABELS = {
  factory: '工廠',
  vendor: '廠商',
  other: '其他',
}

/** Reduce full User-Agent down to browser family only (never store raw UA fingerprint). */
export function extractBrowserFamily(ua) {
  if (typeof ua !== 'string' || !ua.trim()) return 'Unknown'
  if (/Playwright/i.test(ua)) return 'Playwright'
  if (/HeadlessChrome/i.test(ua)) return 'HeadlessChrome'
  if (/Line\//i.test(ua)) return 'Line'
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Other'
}

function clampString(val, maxLen) {
  if (val == null) return ''
  if (typeof val !== 'string') throw Object.assign(new Error('Invalid string field'), { status: 400 })
  return val.trim().slice(0, maxLen)
}

/**
 * Validate and whitelist POST /api/feedback fields.
 * Unknown fields (including client-supplied `isTest`) are stripped.
 */
export function sanitizeFeedbackPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('Expected JSON object'), { status: 400 })
  }

  const feedbackRole = payload.feedbackRole
  if (feedbackRole !== 'factory' && feedbackRole !== 'vendor' && feedbackRole !== 'other') {
    throw Object.assign(new Error('Invalid feedbackRole'), { status: 400 })
  }

  const rawScores = payload.scores
  if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)) {
    throw Object.assign(new Error('Missing scores'), { status: 400 })
  }

  const scores = {}
  const perItem = {}
  let total = 0
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const val = rawScores[key]
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      throw Object.assign(new Error(`Invalid score for ${key}`), { status: 400 })
    }
    scores[key] = val
    const weighted = val * weight
    perItem[key] = weighted
    total += weighted
  }

  const nps = payload.nps
  if (!Number.isInteger(nps) || nps < 0 || nps > 10) {
    throw Object.assign(new Error('Invalid nps'), { status: 400 })
  }

  const out = {
    source: 'web-form',
    feedbackRole,
    roleLabel: ROLE_LABELS[feedbackRole],
    orgName: clampString(payload.orgName, 120),
    scores,
    perItem,
    total,
    nps,
    liked: clampString(payload.liked, 2000),
    improve: clampString(payload.improve, 2000),
  }

  const subject = clampString(payload.subject, 200)
  if (subject) out.subject = subject
  const body = clampString(payload.body, 4000)
  if (body) out.body = body

  return out
}

export function createRateLimiter({
  windowMs = DEFAULT_RATE_WINDOW_MS,
  maxRequests = DEFAULT_RATE_MAX,
  maxTrackedIps = 5000,
} = {}) {
  const hits = new Map()
  return {
    check(ip, nowMs = Date.now()) {
      const key = ip || 'unknown'
      const cutoff = nowMs - windowMs
      const list = (hits.get(key) ?? []).filter((t) => t > cutoff)
      if (list.length >= maxRequests) {
        hits.set(key, list)
        const retryAfterSec = Math.max(1, Math.ceil((list[0] + windowMs - nowMs) / 1000))
        return { allowed: false, retryAfterSec }
      }
      if (!hits.has(key) && hits.size >= maxTrackedIps) {
        const oldestKey = hits.keys().next().value
        if (oldestKey !== undefined) hits.delete(oldestKey)
      }
      list.push(nowMs)
      hits.set(key, list)
      return { allowed: true }
    },
  }
}

export function appendFeedbackEntry({ logPath, payload, ip, userAgent, rateLimiter, maxLogBytes = DEFAULT_MAX_LOG_BYTES, now = new Date() }) {
  const limit = rateLimiter.check(ip, now.getTime())
  if (!limit.allowed) {
    throw Object.assign(new Error('Too many feedback requests'), {
      status: 429,
      retryAfterSec: limit.retryAfterSec,
    })
  }

  const clean = sanitizeFeedbackPayload(payload)
  const browserFamily = extractBrowserFamily(userAgent)
  const entry = {
    ...clean,
    receivedAt: now.toISOString(),
    browserFamily,
    ip: typeof ip === 'string' && ip.trim() ? ip.trim().slice(0, 64) : null,
  }

  const line = JSON.stringify(entry) + '\n'
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  if (fs.existsSync(logPath)) {
    const curSize = fs.statSync(logPath).size
    if (curSize + Buffer.byteLength(line, 'utf8') > maxLogBytes) {
      throw Object.assign(new Error('Feedback log size limit reached'), { status: 507 })
    }
  }
  fs.appendFileSync(logPath, line, 'utf8')
  return entry
}
