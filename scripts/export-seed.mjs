// Print the demo seed as {"<collection>/<id>": document} for writing into the shared claude.ai db.
// Usage: npm run export-seed > artifact/seed.json
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { seedData } = await server.ssrLoadModule('/src/data/seed/index.ts')
  const seed = seedData()
  const out = {}
  for (const [col, docs] of Object.entries(seed)) for (const d of docs) out[`${col}/${d.id}`] = d
  process.stdout.write(JSON.stringify(out, null, 1))
} finally {
  await server.close()
}
