/**
 * Guard for PR-6: the Replit backend is gone, so no scheduled cron may depend on it.
 *
 * Two layers:
 *  1. The known dead-upstream crons stay out of vercel.json.
 *  2. Every remaining cron resolves to an existing route file, and neither the
 *     route nor the first-level libs it imports reference the backend
 *     (BACKEND_URL / BACKEND_API_URL / replit) or the two libs that wrap it
 *     (lib/parlays/sync, lib/predictionAvailability). Routes that reach the
 *     backend through an *internal* fetch are listed explicitly in INTERNAL_PROXIES.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>
}

const DEAD_CRONS = [
  '/api/admin/market/sync-scheduled?type=live',
  '/api/admin/market/sync-scheduled?type=upcoming',
  '/api/admin/market/sync-scheduled?type=completed',
  '/api/admin/market/zombie-sweep',
  '/api/admin/clv/sync-scheduled',
  '/api/admin/predictions/refresh-progressive',
  '/api/admin/parlays/sync-backend-scheduled',
  '/api/admin/predictions/sync-from-availability-scheduled',
  '/api/admin/multisport/sync',
]

/** Scheduler routes that only call another internal route which itself talks to the backend. */
const INTERNAL_PROXIES = [
  'app/api/admin/parlays/sync-backend-scheduled/route.ts',
  'app/api/admin/predictions/sync-from-availability-scheduled/route.ts',
]

const BACKEND_MARKER = /BACKEND_URL|BACKEND_API_URL|replit|lib\/parlays\/sync['"]|lib\/predictionAvailability['"]/

function routeFile(cronPath: string): string {
  const clean = cronPath.split('?')[0].replace(/^\//, '')
  return path.join(ROOT, 'app', clean, 'route.ts')
}

function firstLevelLibs(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/from ['"]@\/(lib\/[^'"]+)['"]/g)) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = path.join(ROOT, m[1] + ext)
      if (fs.existsSync(candidate)) { out.push(candidate); break }
    }
  }
  return out
}

describe('vercel.json crons (post-Replit)', () => {
  it('keeps the dead-backend crons off the schedule', () => {
    const paths = vercel.crons.map(c => c.path)
    for (const dead of DEAD_CRONS) expect(paths).not.toContain(dead)
  })

  it('every scheduled cron resolves to a route file', () => {
    for (const c of vercel.crons) {
      expect(fs.existsSync(routeFile(c.path))).toBe(true)
    }
  })

  it('no scheduled cron (or its first-level libs) references the retired backend', () => {
    const offenders: string[] = []
    for (const c of vercel.crons) {
      const file = routeFile(c.path)
      const rel = path.relative(ROOT, file)
      if (INTERNAL_PROXIES.includes(rel)) { offenders.push(`${c.path} (internal proxy to backend)`); continue }
      const src = fs.readFileSync(file, 'utf8')
      if (BACKEND_MARKER.test(src)) { offenders.push(`${c.path} (direct)`); continue }
      for (const lib of firstLevelLibs(src)) {
        if (BACKEND_MARKER.test(fs.readFileSync(lib, 'utf8'))) {
          offenders.push(`${c.path} (via ${path.relative(ROOT, lib)})`)
          break
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
