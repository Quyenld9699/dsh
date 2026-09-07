return {
  apply(ctx) {
    const subprocess = ctx.get('subprocess')
    const registry = ctx.get('workspaceRegistry')
    const sp = ctx.get('systemPrompt')
    const fs = ctx.get('fs')

    const join = (a, b) => String(a).replace(/[\\/]+$/, '') + '/' + String(b).replace(/^[\\/]+/, '')
    const sq = (s) => String(s).replace(/'/g, "''")
    const nameOk = (s) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(s)
    const strip = (s) => String(s).replace(/^[\s'"]+|[\s'"]+$/g, '')
    const enc = (s) => btoa(String(s))
    const dec = (b) => atob(String(b || ''))
    const normUrl = (u) => {
      let v = String(u || '').trim()
      if (!v) throw new Error('Thiếu URL GitHub')
      if (v.indexOf("'") !== -1) throw new Error('URL chứa ký tự không hợp lệ')
      v = v.replace(/^git@github\.com:/, 'https://github.com/')
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v
      const m = /^https?:\/\/(www\.)?github\.com\/([^/]+\/[^/?#]+)/i.exec(v)
      if (!m) throw new Error('URL không hợp lệ - cần dạng https://github.com/owner/repo')
      return 'https://github.com/' + m[2].replace(/\.git$/i, '')
    }
    const fmtErr = (e) => {
      const msg = String((e && e.message) || e)
      if (/denied|Access to the path|UnauthorizedAccess/i.test(msg)) {
        return msg + ' — Hộp cát chặn plugin ghi vào nơi này. Hãy bấm “Kiểm tra quyền ghi” để xem, hoặc nhờ agent (danger-full-access).'
      }
      return msg
    }

    let psBinCache = null
    let gitBinCache = null
    let markerPathCache = null
    const autoSections = new Map()

    async function spawnRaw(bin, args, cwd) {
      if (!subprocess) throw new Error('Service subprocess không khả dụng')
      const handle = subprocess.spawn({
        argv: [bin].concat(args || []),
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 1 << 20, spill: { maxBytes: 32 << 20 } },
          stderr: { maxBytes: 1 << 20, spill: { maxBytes: 32 << 20 } },
        },
        graceMs: 3000,
      })
      let outcome
      try { outcome = await handle.done } catch (e) {
        throw new Error('Không khởi động được ' + bin + ': ' + String((e && e.message) || e))
      }
      let out = ''
      let err = ''
      try { out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : '' } catch (e) {}
      try { err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : '' } catch (e) {}
      if (outcome.exitCode !== 0) {
        throw new Error(bin + ' thoát mã ' + outcome.exitCode + ': ' + String(err || out).slice(0, 500))
      }
      return { exitCode: outcome.exitCode, stdout: out, stderr: err }
    }

    async function pickPs() {
      if (psBinCache) return psBinCache
      const cands = []
      const add = (v) => { if (v && cands.indexOf(v) === -1) cands.push(v) }
      add('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
      if (subprocess) { try { add(await subprocess.resolveExecutable('powershell')) } catch (e) {} }
      if (subprocess) { try { add(await subprocess.resolveExecutable('pwsh')) } catch (e) {} }
      add('C:/Program Files/PowerShell/7/pwsh.exe')
      add('C:/Program Files (x86)/PowerShell/7/pwsh.exe')
      for (const c of cands) {
        try {
          await spawnRaw(c, ['-NoProfile', '-NonInteractive', '-Command', 'Write-Output ok'], 'C:/')
          psBinCache = c
          return c
        } catch (e) {}
      }
      throw new Error('Không tìm thấy PowerShell khả dụng')
    }
    async function ps(script, cwd) {
      const bin = await pickPs()
      return spawnRaw(bin, ['-NoProfile', '-NonInteractive', '-Command', script], cwd || 'C:/')
    }
    async function psB64(script, cwd) {
      const r = await ps(script, cwd)
      return dec(String(r.stdout || '').trim())
    }
    async function fileExistsLeaf(p) {
      try { return !!(await ps(`if(Test-Path -LiteralPath '${sq(p)}' -PathType Leaf){ Write-Output '1' }`, 'C:/')).stdout.trim() } catch (e) { return false }
    }

    async function pickGit() {
      if (gitBinCache) return gitBinCache
      const cands = []
      const add = (v) => { if (v && cands.indexOf(v) === -1) cands.push(v) }
      if (subprocess) { try { add(await subprocess.resolveExecutable('git')) } catch (e) {} }
      add('C:/Program Files/Git/cmd/git.exe')
      add('C:/Program Files/Git/bin/git.exe')
      add('C:/Program Files (x86)/Git/cmd/git.exe')
      add('C:/Program Files (x86)/Git/bin/git.exe')
      add('C:/ProgramData/chocolatey/bin/git.exe')
      try {
        const bin = await pickPs()
        const r = await spawnRaw(bin, ['-NoProfile', '-NonInteractive', '-Command', "try { (Get-Command git -ErrorAction Stop).Source } catch { 'NOTFOUND' }"], 'C:/')
        const p = String(r.stdout || '').trim().split(/\r?\n/)[0]
        if (p && p !== 'NOTFOUND') add(p)
      } catch (e) {}
      for (const c of cands) {
        try { await spawnRaw(c, ['--version'], 'C:/'); gitBinCache = c; return c } catch (e) {}
      }
      throw new Error('Không tìm thấy Git (git.exe). Hãy cài Git for Windows rồi thử lại.')
    }
    async function git(args, cwd) {
      return spawnRaw(await pickGit(), args, cwd || 'C:/')
    }

    const listWorkspaces = () => {
      if (!registry) return []
      try { return registry.list().map((w) => ({ id: String(w.id), title: String(w.title || ''), path: String(w.path || '') })) } catch (e) { return [] }
    }
    const findWs = (id) => {
      if (!registry || !id) return null
      const list = registry.list()
      for (const w of list) if (String(w.id) === String(id)) return w
      return null
    }
    const wsRootForFiles = () => {
      const l = listWorkspaces()
      return l.length && l[0].path ? String(l[0].path) : 'C:/'
    }
    async function homeDir() {
      const r = await ps("Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([Environment]::GetFolderPath('UserProfile'))))", 'C:/')
      const v = dec(String(r.stdout || '').trim())
      return v || 'C:/Users/Public'
    }
    async function markerCandidates() {
      const w = wsRootForFiles()
      const out = [join(w, '.agents', 'skill-autoload.json')]
      if (w !== 'C:/') out.push(join(w, 'skill-autoload.json'))
      let home = ''
      try { home = await homeDir() } catch (e) {}
      if (home) { out.push(join(home, '.agents', 'skill-autoload.json')); out.push(join(home, 'skill-autoload.json')) }
      return out
    }
    async function fsWriteTextFile(pathStr, content) {
      if (!fs) throw new Error('Dịch vụ fs không khả dụng')
      const target = await fs.resolve(pathStr)
      await fs.writeText(target, String(content))
      return true
    }
    async function fsReadTextFile(pathStr) {
      if (!fs) return null
      try {
        const target = await fs.resolve(pathStr)
        return await fs.readText(target)
      } catch (e) { return null }
    }
    async function psWriteTextFile(pathStr, content) {
      const b64 = enc(String(content))
      const s =
        `$ErrorActionPreference='Stop'; $f='${sq(pathStr)}'; $d=Split-Path -Parent $f; New-Item -ItemType Directory -Force -Path $d | Out-Null; ` +
        `[IO.File]::WriteAllText($f, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')), (New-Object System.Text.UTF8Encoding($false)))`
      await ps(s, 'C:/')
      return true
    }
    async function ensureMarker() {
      if (markerPathCache) return markerPathCache
      const cands = await markerCandidates()
      for (const c of cands) {
        const txt = await fsReadTextFile(c)
        if (txt !== null) {
          try { JSON.parse(txt); markerPathCache = c; return c } catch (e) {}
        }
      }
      const empty = JSON.stringify({ version: 3, entries: [] })
      for (const c of cands) {
        try { await fsWriteTextFile(c, empty); markerPathCache = c; return c } catch (e) {}
      }
      for (const c of cands) {
        try { await psWriteTextFile(c, empty); markerPathCache = c; return c } catch (e) {}
      }
      throw new Error('Không ghi được file đánh dấu tự kích hoạt — hộp cát chặn cả fs lẫn subprocess. Hãy nhờ agent.')
    }
    async function readAutoEntries() {
      try {
        const p = await ensureMarker()
        const txt = await fsReadTextFile(p)
        if (txt === null) return []
        const obj = JSON.parse(txt || '{}')
        const arr = Array.isArray(obj.entries) ? obj.entries : []
        return arr.filter((e) => e && typeof e.key === 'string' && typeof e.dir === 'string')
      } catch (e) { return [] }
    }
    async function writeAutoEntries(entries) {
      const p = await ensureMarker()
      const payload = JSON.stringify({ version: 3, entries }, null, 2)
      await fsWriteTextFile(p, payload)
    }

    async function readTextFile(p) {
      const r = await ps(`Write-Output ([Convert]::ToBase64String([IO.File]::ReadAllBytes('${sq(p)}')))`, 'C:/')
      return dec(String(r.stdout || '').trim())
    }

    async function areasFor(workspaceId) {
      const out = []
      try {
        const home = await homeDir()
        out.push({ key: 'user-agents', origin: 'user', label: '~/.agents/skills', root: join(home, '.agents/skills') })
        out.push({ key: 'user-dsh', origin: 'user', label: '~/.dsh/skills', root: join(home, '.dsh/skills') })
      } catch (e) {}
      const ws = findWs(workspaceId)
      if (ws) {
        out.push({ key: 'proj-agents', origin: 'project', label: '.agents/skills', root: join(ws.path, '.agents/skills') })
        out.push({ key: 'proj-dsh', origin: 'project', label: '.dsh/skills', root: join(ws.path, '.dsh/skills') })
      }
      return out
    }
    const findArea = async (workspaceId, key) => {
      const list = await areasFor(workspaceId)
      for (const a of list) if (a.key === key) return a
      return null
    }

    async function listSkillsAt(root, cwd) {
      const s =
        `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $root='${sq(root)}'; $rows=@(); ` +
        `if(Test-Path -LiteralPath $root){ Get-ChildItem -LiteralPath $root -Directory -Force | ForEach-Object { $d=$_.FullName; $md=Join-Path $d 'SKILL.md'; $mdo=Join-Path $d 'SKILL.md.disabled'; ` +
        `$has=$false; $en=$false; if(Test-Path -LiteralPath $md -PathType Leaf){ $has=$true; $en=$true } elseif(Test-Path -LiteralPath $mdo -PathType Leaf){ $has=$true }; ` +
        `if($has){ $files=Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue; $len=($files | Measure-Object -Property Length -Sum).Sum; ` +
        `$rows += [pscustomobject]@{ dir=$d; kb=[math]::Round($len/1KB); enabled=$en } } } }; ` +
        `$json=if($rows.Count -gt 0){ $rows | ConvertTo-Json -Compress -Depth 3 } else { '[]' }; ` +
        `Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))`
      const out = await psB64(s, cwd)
      try { return JSON.parse(out) } catch (e) { return [] }
    }

    function parseMeta(text, fallbackName) {
      const head = String(text || '').slice(0, 30000)
      const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head)
      let name = ''
      let description = ''
      if (m) {
        const lines = m[1].split(/\r?\n/)
        let inDesc = false
        for (const raw of lines) {
          const line = raw.replace(/\r$/, '')
          const key = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
          if (key) {
            if (key[1] === 'name' && !name) name = strip(key[2])
            else if (key[1] === 'description') { inDesc = true; description = strip(key[2]) }
            else inDesc = false
          } else if (inDesc && /^\s+/.test(line)) {
            description += (description ? ' ' : '') + strip(line)
          } else if (inDesc) {
            inDesc = false
          }
        }
        description = strip(description).slice(0, 500)
      }
      if (!name) name = String(fallbackName || '').toLowerCase()
      return { name, description }
    }

    async function collectAreaItems(area, cwd) {
      const out = []
      const rows = await listSkillsAt(area.root, cwd)
      for (const row of rows) {
        const dir = String(row.dir || '')
        const enabled = !!row.enabled
        const fb = dir.replace(/[\\/]+$/, '').split('/').pop()
        const file = enabled ? 'SKILL.md' : 'SKILL.md.disabled'
        let content = ''
        try { content = await readTextFile(join(dir, file)) } catch (e) { continue }
        const meta = parseMeta(content, fb)
        out.push({
          name: String(meta.name || fb).toLowerCase(),
          description: meta.description,
          areaKey: area.key,
          origin: area.origin,
          areaLabel: area.label,
          dir,
          kb: Number(row.kb) || 0,
          disabled: !enabled,
        })
      }
      return out
    }

    const slug = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_').toLowerCase()
    function unregisterAuto(key) {
      const cur = autoSections.get(key)
      if (cur) {
        try { if (typeof cur.disposer === 'function') cur.disposer() } catch (e) {}
        autoSections.delete(key)
      }
    }
    async function registerAuto(entry) {
      const md = join(entry.dir, 'SKILL.md')
      if (!(await fileExistsLeaf(md))) { unregisterAuto(entry.key); return }
      if (!sp) return
      let content = ''
      try { content = await readTextFile(md) } catch (e) { return }
      content = String(content || '').slice(0, 50000)
      const cur = autoSections.get(entry.key)
      if (cur && cur.content === content) return
      unregisterAuto(entry.key)
      const name = 'skillmgr.auto.' + slug(entry.key)
      const text = '## Skill tự kích hoạt (như plugin): ' + entry.name + '\n\n' + content
      let disposer = null
      try { disposer = sp.section({ name, order: 90000, text }) } catch (e) { console.error('[skillmgr] section', e); return }
      autoSections.set(entry.key, { name, disposer, content })
      console.log('[skillmgr] auto-loaded skill:', entry.key, 'chars', content.length)
    }
    async function refreshAutos() {
      const entries = await readAutoEntries()
      const keys = new Set()
      for (const e of entries) { keys.add(e.key); try { await registerAuto(e) } catch (err) {} }
      for (const key of Array.from(autoSections.keys())) if (!keys.has(key)) unregisterAuto(key)
    }

    async function coreDiscover(urlIn, refIn, destRoot, wsPath) {
      const url = normUrl(urlIn)
      let ref = String(refIn || '').trim() || undefined
      if (ref && !/^[A-Za-z0-9._\/\-]+$/.test(ref)) throw new Error('branch/tag không hợp lệ')
      if (ref === '') ref = undefined
      const cwd = wsPath || 'C:/'
      const stageBase = join(join(cwd, '.agents'), '.skill-installer')
      try { await ps(`Remove-Item -LiteralPath '${sq(stageBase)}' -Recurse -Force -ErrorAction SilentlyContinue`, cwd) } catch (e) {}
      await ps(`New-Item -ItemType Directory -Force -Path '${sq(stageBase)}' | Out-Null`, cwd)
      const repoDir = join(stageBase, 'repo')
      const cloneArgs = ['clone', '--depth', '1']
      if (ref) cloneArgs.push('--branch', ref)
      cloneArgs.push(url, repoDir)
      await git(cloneArgs, cwd)
      await ps(`New-Item -ItemType Directory -Force -Path '${sq(destRoot)}' | Out-Null`, cwd)
      const scan =
        `$ErrorActionPreference='SilentlyContinue'; $ProgressPreference='SilentlyContinue'; $rows=@(); ` +
        `function Walk($p,$depth){ if($depth -gt 5){return}; $md=Join-Path $p 'SKILL.md'; if(Test-Path -LiteralPath $md -PathType Leaf){ $rows += [pscustomobject]@{ dir=$p }; return }; Get-ChildItem -LiteralPath $p -Directory -Force | ForEach-Object { ` +
        `$n=$_.Name; if($n -eq '.git' -or $n -eq 'node_modules' -or $n -eq 'dist' -or $n -eq 'build' -or $n -eq '__pycache__'){return}; ` +
        `if($n.StartsWith('.') -and $n -ne '.claude' -and $n -ne '.agents'){return}; Walk $_.FullName ($depth+1) } }; ` +
        `Walk '${sq(repoDir)}' 0; $json=if($rows.Count -gt 0){ $rows | Select-Object -Unique -Property dir | ConvertTo-Json -Compress } else { '[]' }; ` +
        `Write-Output ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))`
      const out = await psB64(scan, cwd)
      let rows = []
      try { rows = JSON.parse(out) } catch (e) { rows = [] }
      const seen = new Map()
      for (const row of rows) {
        const dir = String(row.dir || '')
        if (!dir) continue
        let content = ''
        try { content = await readTextFile(join(dir, 'SKILL.md')) } catch (e) { continue }
        const fb = dir.replace(/[\\/]+$/, '').split('/').pop()
        const meta = parseMeta(content, fb)
        let nm = String(meta.name || fb).trim().toLowerCase()
        if (!nameOk(nm) || seen.has(nm)) continue
        const rel = dir.slice(repoDir.length).replace(/^[\\/]+/, '')
        const destPath = join(destRoot, nm)
        let exists = false
        try { exists = !!(await ps(`if(Test-Path -LiteralPath '${sq(destPath)}'){ Write-Output '1' }`, cwd)).stdout.trim() } catch (e) {}
        seen.set(nm, { name: nm, description: meta.description, rel, exists, destPath })
      }
      const skills = []
      for (const v of seen.values()) skills.push(v)
      return { repoDir, destRoot, skills, stageBase, cwd }
    }

    harness.handle('skillmgr.workspaces', async () => {
      try { return { ok: true, workspaces: listWorkspaces() } }
      catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.list', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const ws = findWs(wsId)
        const cwd = ws ? ws.path : wsRootForFiles()
        const areas = await areasFor(wsId)
        const items = []
        for (const a of areas) {
          const got = await collectAreaItems(a, cwd)
          for (const it of got) items.push(it)
        }
        let marker = ''
        let autoEntries = []
        try { marker = await ensureMarker(); autoEntries = await readAutoEntries() } catch (e) {}
        const autoMap = new Map()
        for (const e of autoEntries) autoMap.set(e.key, true)
        for (const it of items) it.auto = !!autoMap.get(it.areaKey + '/' + it.name)
        return {
          ok: true,
          workspace: ws ? { id: String(ws.id), title: String(ws.title || ''), path: String(ws.path) } : null,
          areas: areas.map((a) => ({ key: a.key, origin: a.origin, label: a.label, root: a.root })),
          items,
          marker,
        }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.probe', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const w = (findWs(wsId) || {}).path ? String(findWs(wsId).path) : wsRootForFiles()
        let home = ''
        try { home = await homeDir() } catch (e) {}
        const dirs = [join(w, '.agents'), w]
        if (w !== 'C:/') dirs.push(join(w, 'wiki'))
        if (home) dirs.push(join(home, '.agents'), home)
        const cands = []
        for (const d of dirs) {
          if (cands.some((c) => c.dir === d)) continue
          const probe = join(d, '.skillmgr-write-probe.txt')
          let psOk = false
          try { await ps(`New-Item -ItemType File -Force -Path '${sq(probe)}' | Out-Null`, 'C:/'); psOk = true } catch (e) { psOk = false }
          let fsOk = false
          try { await fsWriteTextFile(probe, 'probe'); fsOk = true } catch (e) { fsOk = false }
          cands.push({ dir: d, ps: psOk, fs: fsOk })
        }
        let marker = ''
        try { marker = await ensureMarker() } catch (e) {}
        return { ok: true, cands, marker }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.autotoggle', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const area = await findArea(wsId, args && args.area)
        const nm = String((args && args.name) || '')
        const on = !!args.on
        if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/thư mục skill không hợp lệ' }
        if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent đánh dấu “tự kích hoạt”.' }
        const dir = join(area.root, nm)
        const key = area.key + '/' + nm
        const entries = await readAutoEntries()
        const next = []
        for (const e of entries) if (e.key !== key) next.push(e)
        if (on) next.push({ key, areaKey: area.key, name: nm, dir })
        await writeAutoEntries(next)
        await refreshAutos()
        return { ok: true, key, on }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.toggle', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const area = await findArea(wsId, args && args.area)
        const nm = String((args && args.name) || '')
        if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/thư mục skill không hợp lệ' }
        if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent Bật/Tắt.' }
        const dir = join(area.root, nm)
        const on = join(dir, 'SKILL.md')
        const off = join(dir, 'SKILL.md.disabled')
        const enable = !!args.enable
        const script = enable
          ? `$ErrorActionPreference='Stop'; if(Test-Path -LiteralPath '${sq(off)}'){ Move-Item -LiteralPath '${sq(off)}' -Destination '${sq(on)}' -Force }`
          : `$ErrorActionPreference='Stop'; if(Test-Path -LiteralPath '${sq(on)}'){ Move-Item -LiteralPath '${sq(on)}' -Destination '${sq(off)}' -Force }`
        await ps(script, 'C:/')
        try { await refreshAutos() } catch (e) {}
        return { ok: true, enabled: enable }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.delete', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const area = await findArea(wsId, args && args.area)
        const nm = String((args && args.name) || '')
        if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/thư mục skill không hợp lệ' }
        if (area.origin === 'user') return { ok: false, error: 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent Xoá.' }
        const dir = join(area.root, nm)
        const key = area.key + '/' + nm
        await ps(`Remove-Item -LiteralPath '${sq(dir)}' -Recurse -Force`, 'C:/')
        const entries = await readAutoEntries()
        await writeAutoEntries(entries.filter((e) => e.key !== key))
        unregisterAuto(key)
        return { ok: true }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.open', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const area = await findArea(wsId, args && args.area)
        const nm = String((args && args.name) || '')
        if (!area || !nameOk(nm)) return { ok: false, error: 'Vùng/thư mục skill không hợp lệ' }
        await ps(`Start-Process -FilePath 'C:/Windows/explorer.exe' -ArgumentList '${sq(join(area.root, nm))}'`, 'C:/')
        return { ok: true }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.discover', async (args) => {
      try {
        const wsId = String((args && args.workspaceId) || '')
        const destKey = (args && args.dest) === 'user-agents' ? 'user-agents' : 'proj-agents'
        const area = await findArea(wsId, destKey)
        if (!area) return { ok: false, error: 'Chưa chọn được nơi cài' }
        if (destKey === 'user-agents') return { ok: false, error: 'Cài vào thư mục user bị chặn với plugin — hãy cài vào Workspace hoặc nhờ agent.' }
        const ws = findWs(wsId)
        if (!ws) return { ok: false, error: 'Cần một workspace để tải tạm repo' }
        const res = await coreDiscover(args && args.url, args && args.ref, area.root, String(ws.path))
        return { ok: true, destRoot: area.root, skills: res.skills.map((s) => ({ name: s.name, description: s.description, exists: s.exists })) }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    harness.handle('skillmgr.install', async (args) => {
      try {
        const namesIn = Array.isArray(args && args.names) ? args.names.map((n) => String(n)) : []
        const force = !!(args && args.force)
        if (!namesIn.length) return { ok: false, error: 'Chưa chọn skill nào' }
        const wsId = String((args && args.workspaceId) || '')
        const destKey = (args && args.dest) === 'user-agents' ? 'user-agents' : 'proj-agents'
        const area = await findArea(wsId, destKey)
        if (!area) return { ok: false, error: 'Không xác định được nơi cài đích' }
        if (destKey === 'user-agents') return { ok: false, error: 'Cài vào thư mục user bị chặn với plugin — hãy cài vào Workspace hoặc nhờ agent.' }
        const ws = findWs(wsId)
        if (!ws) return { ok: false, error: 'Cần một workspace để tải tạm repo' }
        const res = await coreDiscover(args.url, args.ref, area.root, String(ws.path))
        const byName = new Map(res.skills.map((s) => [s.name, s]))
        const installed = []
        const skipped = []
        const errors = []
        for (const nm of namesIn) {
          const skill = byName.get(nm)
          if (!skill) { skipped.push({ name: nm, reason: 'không tìm thấy trong repo' }); continue }
          if (skill.exists && !force) { skipped.push({ name: nm, reason: 'đã tồn tại (bật Ghi đè)' }); continue }
          const src = join(res.repoDir, skill.rel)
          const script =
            `$ErrorActionPreference='Stop'; $dst='${sq(skill.destPath)}'; $parent=Split-Path -Parent $dst; New-Item -ItemType Directory -Force -Path $parent | Out-Null; ` +
            `if(Test-Path -LiteralPath $dst){ Remove-Item -LiteralPath $dst -Recurse -Force }; Copy-Item -LiteralPath '${sq(src)}' -Destination $dst -Recurse -Force`
          try { await ps(script, res.cwd); installed.push({ name: skill.name, description: skill.description, dest: skill.destPath }) }
          catch (e) { errors.push({ name: skill.name, reason: fmtErr(e) }) }
        }
        try { await ps(`Remove-Item -LiteralPath '${sq(res.stageBase)}' -Recurse -Force -ErrorAction SilentlyContinue`, res.cwd) } catch (e) {}
        try { await refreshAutos() } catch (e) {}
        return { ok: true, destRoot: area.root, installed, skipped, errors }
      } catch (e) { return { ok: false, error: fmtErr(e) } }
    })

    refreshAutos().catch((e) => console.error('[skillmgr] initial autoload failed', e))
    console.log('[skillmgr] host ready v8')
  },
}
