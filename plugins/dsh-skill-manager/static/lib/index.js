// dsh-skill-manager — static HOST-only half.
// Purpose: on every harness boot, re-apply the "tự kích hoạt (⚡)" choices the
// Skill Manager UI persisted at <workspace>/.agents/skill-autoload.json by
// registering one systemPrompt section per enabled marked skill. No client
// half, no Remote service, no tools — minimal surface, safe to boot.
//
// Rollback: delete the loader row in cordis.patch.yml and this folder, then
// restart the harness.

const join = (a, b) => String(a).replace(/[\\/]+$/, '') + '/' + String(b).replace(/^[\\/]+/, '')
const slug = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_').toLowerCase()

async function readJson(fs, pathStr) {
  try {
    const target = await fs.resolve(pathStr)
    const text = await fs.readText(target)
    const obj = JSON.parse(String(text || '{}'))
    const arr = Array.isArray(obj.entries) ? obj.entries : []
    return arr.filter((e) => e && typeof e.key === 'string' && typeof e.dir === 'string')
  } catch (e) {
    return null
  }
}

async function readContent(fs, pathStr) {
  try {
    const target = await fs.resolve(pathStr)
    return String(await fs.readText(target))
  } catch (e) {
    return null
  }
}

async function attach(ctx) {
  const registry = ctx.get('workspaceRegistry')
  const fs = ctx.get('fs')
  const sp = ctx.get('systemPrompt')
  if (!registry || !fs || !sp) return
  let workspaces = []
  try { workspaces = registry.list() } catch (e) { workspaces = [] }
  const w = workspaces.length && workspaces[0].path ? String(workspaces[0].path) : null
  if (!w) return
  const candidates = [join(w, '.agents', 'skill-autoload.json')]
  if (w !== 'C:/') candidates.push(join(w, 'skill-autoload.json'))

  let entries = null
  for (const c of candidates) {
    const got = await readJson(fs, c)
    if (got !== null) { entries = got; break }
  }
  if (!entries) return

  const disposers = []
  for (const entry of entries) {
    const md = join(entry.dir, 'SKILL.md')
    const content = await readContent(fs, md)
    if (!content) continue
    const trimmed = content.slice(0, 50000)
    const name = 'skillmgr.auto.' + slug(entry.key)
    const text = '## Skill tự kích hoạt (như plugin): ' + String(entry.name || entry.key) + '\n\n' + trimmed
    try {
      const disposer = sp.section({ name, order: 90000, text })
      if (typeof disposer === 'function') disposers.push(disposer)
      console.log('[dsh-skill-manager] auto-loaded:', entry.key, 'chars', trimmed.length)
    } catch (e) {
      console.error('[dsh-skill-manager] section failed', entry.key, String((e && e.message) || e))
    }
  }
  if (disposers.length) {
    ctx.effect(() => () => {
      for (const d of disposers) { try { d() } catch (e) {} }
    })
  }
}

export function apply(ctx) {
  attach(ctx).catch((e) => console.error('[dsh-skill-manager] attach failed', String((e && e.message) || e)))
  const timer = ctx.get('timer')
  if (timer) {
    try { timer.timeout(() => attach(ctx).catch(() => {}), 2000) } catch (e) {}
    try { timer.timeout(() => attach(ctx).catch(() => {}), 8000) } catch (e) {}
  }
}
