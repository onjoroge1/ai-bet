/**
 * PR-7 guard: the retired Replit backend must never be a default again.
 * No hardcoded host, no hardcoded API key, anywhere in app/, lib/ or scripts/.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const DIRS = ['app', 'lib', 'scripts', 'components', 'hooks']
const FORBIDDEN = [/bet-genius-ai-onjoroge1\.replit\.app/, /betgenius_secure_key_2024/]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(p, out)
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(p)
    }
  }
  return out
}

describe('legacy backend is opt-in only', () => {
  it('has no hardcoded Replit host or default API key in source', () => {
    const offenders: string[] = []
    for (const dir of DIRS) {
      const abs = path.join(ROOT, dir)
      if (!fs.existsSync(abs)) continue
      for (const file of walk(abs)) {
        const src = fs.readFileSync(file, 'utf8')
        if (FORBIDDEN.some(re => re.test(src))) offenders.push(path.relative(ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('env.example does not ship the backend as a default', () => {
    const env = fs.readFileSync(path.join(ROOT, 'env.example'), 'utf8')
    expect(env).not.toMatch(/^BACKEND_API_URL=/m)
    expect(env).not.toMatch(/^NEXT_PUBLIC_MARKET_KEY=/m)
    expect(env).not.toMatch(/replit\.app/)
  })

  it('backend-config reports paused when nothing is configured', async () => {
    const saved = { a: process.env.BACKEND_API_URL, b: process.env.BACKEND_URL, c: process.env.BACKEND_API_KEY, d: process.env.NEXT_PUBLIC_MARKET_KEY }
    delete process.env.BACKEND_API_URL; delete process.env.BACKEND_URL
    delete process.env.BACKEND_API_KEY; delete process.env.NEXT_PUBLIC_MARKET_KEY
    jest.resetModules()
    const mod = await import('@/lib/backend-config')
    expect(mod.BACKEND_URL).toBeNull()
    expect(mod.backendConfigured()).toBe(false)
    const res = mod.backendUnavailable({ feature: 'soccer' })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.paused).toBe(true)
    expect(body.feature).toBe('soccer')
    const empty = mod.backendPausedEmpty({ matches: [] })
    expect(empty.status).toBe(200)
    expect((await empty.json()).matches).toEqual([])
    process.env.BACKEND_API_URL = saved.a; process.env.BACKEND_URL = saved.b
    process.env.BACKEND_API_KEY = saved.c; process.env.NEXT_PUBLIC_MARKET_KEY = saved.d
  })
})
