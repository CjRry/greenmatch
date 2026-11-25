// Turn dist/index.html (one self-contained file from vite-plugin-singlefile) into the claude.ai
// artifact page format: no doctype/html/head/body wrapper (the platform adds it), title first.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const pick = (re) => [...html.matchAll(re)].map((m) => m[0])

const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>綠媒 GreenMatch</title>'
const metas = pick(/<meta name="(?:claude:viewport-fit-sides|description)"[^>]*>/g)
const links = pick(/<link\s[^>]*>/g)
  .filter((l) => /rel="(preconnect|stylesheet)"/.test(l) && /fonts\.(googleapis|gstatic)\.com/.test(l))
  .map((l) => l.replace(/\s+/g, ' '))
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g)
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g)
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '<div id="root"></div>'
const bodyWithoutScripts = body.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim()

if (!scripts.length || !styles.length) {
  console.error('to-artifact: expected inline <script> and <style> in dist/index.html')
  process.exit(1)
}
if (/<script[^>]*\ssrc=/.test(html)) {
  console.error('to-artifact: found an external <script src>; the artifact must be self-contained')
  process.exit(1)
}

const out = [title, ...metas, ...links, ...styles, bodyWithoutScripts, ...scripts].join('\n') + '\n'
mkdirSync('artifact', { recursive: true })
writeFileSync('artifact/greenmatch.html', out)
const kb = (Buffer.byteLength(out) / 1024).toFixed(0)
console.log(`to-artifact: wrote artifact/greenmatch.html (${kb} KB)`)
