// dsh-skill-manager — STATIC plugin (host + JSON API + auto ⚡).
// Client tĩnh (window.__ModuleLoader__) gọi host qua /dsh-sm/<method>.
// Không cần dynamic runner; tự nạp mỗi boot nhờ loader row trong cordis.patch.yml.

export const name = 'dsh-skill-manager'
export const inject = []

const join = (a, b) => String(a).replace(/[\\/]+$/, '') + '/' + String(b).replace(/^[\\/]+/, '')
const sq = (s) => String(s).replace(/'/g, "''")
const nameOk = (s) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(s)
const strip = (s) => String(s).replace(/^[\s'"]+|[\s'"]+$/g, '')
const slug = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_').toLowerCase()

const fmtErr = (e) => {
  const msg = String((e && e.message) || e)
  if (/denied|Access to the path|UnauthorizedAccess/i.test(msg)) return msg + ' — Hộp cát chặn ghi ở nơi này.'
  return msg
}

async function readTextFile(ps, p) {
  const r = await ps(`Write-Output ([Convert]::ToBase64String([IO.File]::ReadAllBytes('${sq(p)}')))`, 'C:/')
  return atob(String(r.stdout || '').trim())
}
async function writeTextFile(ps, p, content) {
  const b64 = btoa(String(content))
  await ps(
    `$ErrorActionPreference='Stop'; $f='${sq(p)}'; $d=Split-Path -Parent $f; New-Item -ItemType Directory -Force -Path $d | Out-Null; ` +
    `[IO.File]::WriteAllText($f, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')), (New-Object System.Text.UTF8Encoding($false)))`, 'C:/')
}
async function psB64(ps, script, cwd) {
  const r = await ps(script, cwd || 'C:/')
  return atob(String(r.stdout || '').trim())
}

export function apply(ctx) {
  const svc = (n) => ctx.get(n)

  // ---- powershell resolver (lấy service lúc gọi, tránh chưa sẵn sàng lúc boot) ----
  async function spawnRaw(bin, args, cwd) {
    const sub = svc('subprocess')
    if (!sub) throw new Error('Service subprocess chưa sẵn sàng')
    const handle = sub.spawn({
      argv: [bin].concat(args || []), cwd,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20, spill: { maxBytes: 16 << 20 } }, stderr: { maxBytes: 1 << 20, spill: { maxBytes: 16 << 20 } } },
      graceMs: 3000,
    })
    const outcome = await handle.done
    let out = '', err = ''
    try { out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : '' } catch (e) {}
    try { err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : '' } catch (e) {}
    if (outcome.exitCode !== 0) throw new Error(bin + ' thoát mã ' + outcome.exitCode + ': ' + String(err || out).slice(0, 500))
    return { stdout: out, stderr: err }
  }
  let psBin = null
  async function pickPs() {
    if (psBin) return psBin
    const sub = svc('subprocess')
    const cands = ['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe']
    if (sub) { try { cands.push(await sub.resolveExecutable('powershell')) } catch (e) {} }
    if (sub) { try { cands.push(await sub.resolveExecutable('pwsh')) } catch (e) {} }
    cands.push('C:/Program Files/PowerShell/7/pwsh.exe')
    for (const c of cands) {
      try { await spawnRaw(c, ['-NoProfile', '-NonInteractive', '-Command', 'Write-Output ok'], 'C:/'); psBin = c; return c } catch (e) {}
    }
    throw new Error('Không tìm thấy PowerShell')
  }
  const ps = async (script, cwd) => spawnRaw(await pickPs(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], cwd || 'C:/')

  const wsList = () => {
    const registry = svc('workspaceRegistry')
    if (!registry) return []
    try { return registry.list().map((w) => ({ id: String(w.id), title: String(w.title || ''), path: String(w.path || '') })) } catch (e) { return [] }
  }
  const findWs = (id) => wsList().find((w) => w.id === String(id)) || null
  const firstWs = () => wsList()[0] || null
  const homeDir = async () => {
    const r = await ps("Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([Environment]::GetFolderPath('UserProfile'))))", 'C:/')
    return atob(String(r.stdout || '').trim()) || 'C:/Users/Public'
  }
  const fsRead = async (p) => { const fs = svc('fs'); if (!fs) return null; try { const t = await fs.resolve(p); return await fs.readText(t) } catch (e) { return null } }
  const fsWrite = async (p, content) => { const fs = svc('fs'); if (!fs) throw new Error('Dịch vụ fs chưa sẵn sàng'); const t = await fs.resolve(p); await fs.writeText(t, String(content)) }
  const fileExistsLeaf = async (p) => { try { return !!(await ps(`if(Test-Path -LiteralPath '${sq(p)}' -PathType Leaf){ Write-Output '1' }`, 'C:/')).stdout.trim() } catch (e) { return false } }

  // ---- marker (⚡) ----
  let markerCache = null
  const markerCandidates = async () => {
    const w = (firstWs() || {}).path || 'C:/'
    const out = [join(w, 'skill-autoload.json')]
    if (w !== 'C:/') out.push(join(w, '.agents', 'skill-autoload.json'))
    let home = ''; try { home = await homeDir() } catch (e) {}
    if (home) { out.push(join(home, 'skill-autoload.json')); out.push(join(home, '.agents', 'skill-autoload.json')) }
    return out
  }
  const ensureMarker = async () => {
    if (markerCache) return markerCache
    const cands = await markerCandidates()
    for (const c of cands) { const t = await fsRead(c); if (t !== null) { try { JSON.parse(t); markerCache = c; return c } catch (e) {} } }
    const empty = JSON.stringify({ version: 3, entries: [] })
    for (const c of cands) { try { await fsWrite(c, empty); markerCache = c; return c } catch (e) {} }
    for (const c of cands) { try { await writeTextFile(ps, c, empty); markerCache = c; return c } catch (e) {} }
    throw new Error('Không ghi được file marker ⚡ — hãy nhờ agent.')
  }
  const readAuto = async () => {
    try { const p = await ensureMarker(); const t = await fsRead(p); if (t === null) return []; const o = JSON.parse(t || '{}'); const a = Array.isArray(o.entries) ? o.entries : []; return a.filter((e) => e && typeof e.key === 'string' && typeof e.dir === 'string') } catch (e) { return [] }
  }
  const writeAuto = async (entries) => { await fsWrite(await ensureMarker(), JSON.stringify({ version: 3, entries }, null, 2)) }

  // ---- auto ⚡ sections ----
  const autoSections = new Map()
  function unregisterAuto(key) { const c = autoSections.get(key); if (c) { try { c.disposer() } catch (e) {} autoSections.delete(key) } }
  async function registerAuto(entry) {
    const sp = svc('systemPrompt')
    if (!sp) return
    const md = join(entry.dir, 'SKILL.md')
    if (!(await fileExistsLeaf(md))) { unregisterAuto(entry.key); return }
    let content = ''
    try { content = await readTextFile(ps, md) } catch (e) { return }
    content = String(content || '').slice(0, 50000)
    const prev = autoSections.get(entry.key)
    if (prev && prev.content === content) return
    unregisterAuto(entry.key)
    try {
      const d = sp.section({ name: 'skillmgr.auto.' + slug(entry.key), order: 90000, text: '## Skill tự kích hoạt: ' + entry.name + '\n\n' + content })
      autoSections.set(entry.key, { disposer: d, content })
    } catch (e) { console.error('[dsh-sm] section', e) }
  }
  async function refreshAutos() {
    const entries = await readAuto()
    const keys = new Set()
    for (const e of entries) { keys.add(e.key); try { await registerAuto(e) } catch (err) {} }
    for (const k of Array.from(autoSections.keys())) if (!keys.has(k)) unregisterAuto(k)
  }

  // ---- areas & listing ----
  async function areasFor(wsId) {
    const out = []
    let home = ''; try { home = await homeDir() } catch (e) {}
    if (home) { out.push({ key: 'user-agents', origin: 'user', label: '~/.agents/skills', root: join(home, '.agents/skills') }); out.push({ key: 'user-dsh', origin: 'user', label: '~/.dsh/skills', root: join(home, '.dsh/skills') }) }
    const ws = findWs(wsId)
    if (ws) { out.push({ key: 'proj-agents', origin: 'project', label: '.agents/skills', root: join(ws.path, '.agents/skills') }); out.push({ key: 'proj-dsh', origin: 'project', label: '.dsh/skills', root: join(ws.path, '.dsh/skills') }) }
    return out
  }
  const findArea = async (wsId, key) => (await areasFor(wsId)).find((a) => a.key === key) || null

  async function listAt(root) {
    const s =
      `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $root='${sq(root)}'; $rows=@(); ` +
      `if(Test-Path -LiteralPath $root){ Get-ChildItem -LiteralPath $root -Directory -Force | ForEach-Object { $d=$_.FullName; $md=Join-Path $d 'SKILL.md'; $mdo=Join-Path $d 'SKILL.md.disabled'; ` +
      `$has=$false; $en=$false; if(Test-Path -LiteralPath $md -PathType Leaf){ $has=$true; $en=$true } elseif(Test-Path -LiteralPath $mdo -PathType Leaf){ $has=$true }; ` +
      `if($has){ $files=Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue; $len=($files | Measure-Object -Property Length -Sum).Sum; ` +
      `$rows += [pscustomobject]@{ dir=$d; kb=[math]::Round($len/1KB); enabled=$en } } } }; ` +
      `$json=if($rows.Count -gt 0){ $rows | ConvertTo-Json -Compress -Depth 3 } else { '[]' }; ` +
      `Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))`
    try { return JSON.parse(await psB64(ps, s, 'C:/')) } catch (e) { return [] }
  }
  function parseMeta(text, fallbackName) {
    const head = String(text || '').slice(0, 30000)
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head)
    let name = ''; let description = ''
    if (m) {
      const lines = m[1].split(/\r?\n/); let inDesc = false
      for (const raw of lines) {
        const line = raw.replace(/\r$/, '')
        const k = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
        if (k) { if (k[1] === 'name' && !name) name = strip(k[2]); else if (k[1] === 'description') { inDesc = true; description = strip(k[2]) } else inDesc = false }
        else if (inDesc && /^\s+/.test(line)) description += (description ? ' ' : '') + strip(line)
        else if (inDesc) inDesc = false
      }
      description = strip(description).slice(0, 500)
    }
    if (!name) name = String(fallbackName || '').toLowerCase()
    return { name, description }
  }
  async function collectArea(area) {
    const out = []
    const rows = await listAt(area.root)
    for (const row of rows) {
      const dir = String(row.dir || '')
      const enabled = !!row.enabled
      const fb = dir.replace(/[\\/]+$/, '').split('/').pop()
      let content = ''
      try { content = await readTextFile(ps, join(dir, enabled ? 'SKILL.md' : 'SKILL.md.disabled')) } catch (e) { continue }
      const meta = parseMeta(content, fb)
      out.push({ name: String(meta.name || fb).toLowerCase(), description: meta.description, areaKey: area.key, origin: area.origin, areaLabel: area.label, dir, kb: Number(row.kb) || 0, disabled: !enabled })
    }
    return out
  }

  async function apiList(wsId) {
    const areas = await areasFor(wsId)
    const items = []
    for (const a of areas) { for (const it of await collectArea(a)) items.push(it) }
    const autos = await readAuto(); const am = new Map(autos.map((e) => [e.key, true]))
    for (const it of items) it.auto = !!am.get(it.areaKey + '/' + it.name)
    let marker = ''; try { marker = await ensureMarker() } catch (e) {}
    return { ok: true, workspace: findWs(wsId), areas: areas.map((a) => ({ key: a.key, origin: a.origin, label: a.label, root: a.root })), items, marker }
  }
  async function apiToggle(wsId, areaKey, nm, enable) {
    const area = await findArea(wsId, areaKey)
    if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/name không hợp lệ' }
    if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ static — hãy nhờ agent.' }
    const dir = join(area.root, nm); const on = join(dir, 'SKILL.md'); const off = join(dir, 'SKILL.md.disabled')
    await ps(enable
      ? `$ErrorActionPreference='Stop'; if(Test-Path -LiteralPath '${sq(off)}'){ Move-Item -LiteralPath '${sq(off)}' -Destination '${sq(on)}' -Force }`
      : `$ErrorActionPreference='Stop'; if(Test-Path -LiteralPath '${sq(on)}'){ Move-Item -LiteralPath '${sq(on)}' -Destination '${sq(off)}' -Force }`, 'C:/')
    try { await refreshAutos() } catch (e) {}
    return { ok: true, enabled: enable }
  }
  async function apiAuto(wsId, areaKey, nm, on) {
    const area = await findArea(wsId, areaKey)
    if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/name không hợp lệ' }
    if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ static — hãy nhờ agent đánh dấu ⚡.' }
    const dir = join(area.root, nm); const key = area.key + '/' + nm
    const entries = (await readAuto()).filter((e) => e.key !== key)
    if (on) entries.push({ key, areaKey: area.key, name: nm, dir })
    await writeAuto(entries)
    await refreshAutos()
    return { ok: true, key, on }
  }
  async function apiDelete(wsId, areaKey, nm) {
    const area = await findArea(wsId, areaKey)
    if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/name không hợp lệ' }
    if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ static — hãy nhờ agent.' }
    const dir = join(area.root, nm); const key = area.key + '/' + nm
    await ps(`Remove-Item -LiteralPath '${sq(dir)}' -Recurse -Force`, 'C:/')
    await writeAuto((await readAuto()).filter((e) => e.key !== key))
    unregisterAuto(key)
    return { ok: true }
  }
  async function apiOpen(wsId, areaKey, nm) {
    const area = await findArea(wsId, areaKey)
    if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/name không hợp lệ' }
    await ps(`Start-Process -FilePath 'C:/Windows/explorer.exe' -ArgumentList '${sq(join(area.root, nm))}'`, 'C:/')
    return { ok: true }
  }
  async function apiProbe(wsId) {
    const w = (findWs(wsId) || firstWs() || {}).path || 'C:/'
    let home = ''; try { home = await homeDir() } catch (e) {}
    const dirs = [join(w, '.agents'), w]; if (home) { dirs.push(join(home, '.agents')); dirs.push(home) }
    const cands = []
    for (const d of dirs) {
      if (cands.some((c) => c.dir === d)) continue
      const probe = join(d, '.skillmgr-write-probe.txt')
      let psOk = false, fsOk = false
      try { await ps(`New-Item -ItemType File -Force -Path '${sq(probe)}' | Out-Null`, 'C:/'); psOk = true } catch (e) {}
      try { await fsWrite(probe, 'x'); fsOk = true } catch (e) {}
      cands.push({ dir: d, ps: psOk, fs: fsOk })
    }
    let marker = ''; try { marker = await ensureMarker() } catch (e) {}
    return { ok: true, cands, marker }
  }

  // ---- HTTP JSON API (POST /dsh-sm/<method>) ----
  const handlers = {
    workspaces: async () => ({ ok: true, workspaces: wsList() }),
    list: async (a) => apiList(a.workspaceId || ''),
    toggle: async (a) => apiToggle(a.workspaceId || '', a.area, a.name, !!a.enable),
    autotoggle: async (a) => apiAuto(a.workspaceId || '', a.area, a.name, !!a.on),
    delete: async (a) => apiDelete(a.workspaceId || '', a.area, a.name),
    open: async (a) => apiOpen(a.workspaceId || '', a.area, a.name),
    probe: async (a) => apiProbe(a.workspaceId || ''),
  }
  // Mount JSON API giống hệt pattern của dshmarket: ctx.inject(['webServer'], …)
  ctx.inject(['webServer'], (hostCtx) => {
    const readBody = async (req) => {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const raw = Buffer.concat(chunks).toString('utf8') || '{}'
      try { return JSON.parse(raw) } catch (e) { return {} }
    }
    const send = (res, code, obj) => {
      res.writeHead(code, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(obj))
    }
    const argsOf = (req) => {
      try {
        const u = new URL(req.url || '', 'http://localhost')
        const q = u.searchParams.get('q')
        return q ? JSON.parse(q) : {}
      } catch (e) { return {} }
    }
    const makeHandler = (key) => async (req, res) => {
      try {
        if (req.method === 'POST') {
          send(res, 200, await handlers[key](await readBody(req)))
        } else if (req.method === 'GET') {
          send(res, 200, await handlers[key](argsOf(req)))
        } else {
          send(res, 405, { ok: false, error: 'GET/POST only' })
        }
      } catch (e) {
        send(res, 500, { ok: false, error: fmtErr(e) })
      }
    }
    hostCtx.effect(() => {
      const offs = Object.keys(handlers).map((k) => hostCtx.webServer.register({ kind: 'exact', path: '/dsh-sm/' + k, handler: makeHandler(k) }))
      console.log('[dsh-sm] api mounted:', Object.keys(handlers).join(','))
      return () => { for (const o of offs) { try { o() } catch (e) {} } }
    }, 'dsh-sm api')
  })

  const boot = () => refreshAutos().catch((e) => console.error('[dsh-sm] autoload failed', String((e && e.message) || e)))
  boot()
  const timer = ctx.get('timer')
  if (timer) {
    try { timer.timeout(() => boot(), 2000) } catch (e) {}
    try { timer.timeout(() => boot(), 8000) } catch (e) {}
  }
  console.log('[dsh-sm] static host ready')
}
