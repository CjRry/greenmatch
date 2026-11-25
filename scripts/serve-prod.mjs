import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendFeedbackEntry, createRateLimiter } from './feedback-handler.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const FEEDBACK_LOG = path.join(ROOT_DIR, 'docs', 'board', 'live-feedback.jsonl')
const PORT = Number(process.env.PORT ?? 4173)
const MAX_BODY_BYTES = 32 * 1024
const feedbackLimiter = createRateLimiter()

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim()
        const parsed = raw ? JSON.parse(raw) : {}
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(Object.assign(new Error('Expected JSON object'), { status: 400 }))
          return
        }
        resolve(parsed)
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }))
      }
    })
    req.on('error', (err) => reject(Object.assign(err, { status: 400 })))
  })
}

function resolveDistFile(urlPath) {
  let cleanPath = '/'
  try {
    cleanPath = decodeURIComponent(urlPath)
  } catch {
    return path.join(DIST_DIR, 'index.html')
  }
  const rel = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '')
  const candidate = path.resolve(DIST_DIR, rel)
  if (candidate.startsWith(DIST_DIR + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate
  }
  return path.join(DIST_DIR, 'index.html')
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0]

  if (urlPath === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end()
      return
    }
    sendJson(res, 200, { ok: true })
    return
  }

  if (urlPath === '/api/feedback') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' })
      return
    }
    try {
      const payload = await readJsonBody(req)
      const cfIp = req.headers['cf-connecting-ip']
      const ip = (Array.isArray(cfIp) ? cfIp[0] : cfIp) || req.socket.remoteAddress || null
      appendFeedbackEntry({
        logPath: FEEDBACK_LOG,
        payload,
        ip,
        userAgent: req.headers['user-agent'],
        rateLimiter: feedbackLimiter,
      })
      sendJson(res, 200, { ok: true })
    } catch (err) {
      const status = typeof err?.status === 'number' ? err.status : 500
      sendJson(res, status, { ok: false, error: err instanceof Error ? err.message : 'Server error' })
    }
    return
  }

  if (urlPath === '/favicon.ico') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  const filePath = resolveDistFile(urlPath)
  if (!fs.existsSync(filePath)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('dist/index.html not found; waiting for build')
    return
  }

  const ext = path.extname(filePath)
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(filePath).pipe(res)
})

// 只聽本機（PROP-0003 A1）：對外流量一律經 cloudflared → 127.0.0.1:4173。
// 這樣同網段的人無法繞過 tunnel 直連並偽造 cf-connecting-ip。
const HOST = '127.0.0.1'

server.listen(PORT, HOST, () => {
  console.log(`GreenMatch prod server listening on http://${HOST}:${PORT} (dist=${DIST_DIR})`)
})
