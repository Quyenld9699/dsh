window.__ModuleLoader__.load({ id: "dsh-skill-manager", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let React = require("react");
const styles = { insert: (css) => {
  let el = document.getElementById("dsh-sm-style");
  if (!el) { el = document.createElement("style"); el.id = "dsh-sm-style"; document.head.appendChild(el); }
  el.textContent = css;
  return () => { el.remove(); };
} };
const __tok = (typeof location !== "undefined" && new URLSearchParams(location.search).get("token")) || "";
const host = { call: (method, args) => fetch("/dsh-sm/" + String(method).replace(/^skillmgr./, "") + (__tok ? "?token=" + encodeURIComponent(__tok) + "&" : "?") + "q=" + encodeURIComponent(JSON.stringify(args || {})), { method: "GET", cache: "no-store" }).then(async (r) => { const t = await r.text(); if (!t) throw new Error("HTTP " + r.status + " — response rỗng"); let j; try { j = JSON.parse(t); } catch (e) { throw new Error("HTTP " + r.status + ": " + t.slice(0, 160)); } if (j && j.ok === false && j.error) throw new Error(j.error); return j; }) };
function makePlugin() {
  return {
    apply(ctx) {
      const slots = ctx.get('slots')
      if (!slots) return
      const timer = ctx.get('timer')
  
      styles.insert(
        '.ski{display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.5;max-width:880px}' +
        '.ski .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
        '.ski input[type=text]{flex:1 1 240px;min-width:200px;padding:6px 8px;border-radius:6px;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#111);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35))}' +
        '.ski select{max-width:100%;padding:6px 8px;border-radius:6px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#111);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));color-scheme:light dark}' +
        '.ski option{background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#111)}' +
        '.ski button{padding:5px 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:transparent;color:var(--dsw-alias-label-primary,#111);cursor:pointer;display:inline-flex;align-items:center;gap:6px;justify-content:center}' +
        '.ski button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}' +
        '.ski button.primary{background:var(--dsw-alias-button-primary-fill,#4f6ef7);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}' +
        '.ski button.danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:var(--dsw-alias-state-error-primary,#f85149)}' +
        '.ski button.auto{color:var(--dsw-alias-state-warn-primary,#d29922);border-color:var(--dsw-alias-state-warn-primary,#d29922)}' +
        '.ski button:disabled{opacity:.5;cursor:default}' +
        '.ski .spin{width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ski-spin .7s linear infinite;flex:none;opacity:.85}' +
        '.ski .tabs{display:flex;gap:6px}' +
        '.ski .tabs button.on{border-color:var(--dsw-alias-button-primary-fill,#4f6ef7);color:var(--dsw-alias-button-primary-fill,#4f6ef7)}' +
        '.ski .chiprow{display:flex;gap:6px;align-items:center}' +
        '.ski .chip{padding:3px 10px;border-radius:99px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary,#666)}' +
        '.ski .chip.on{background:var(--dsw-alias-interactive-bg-active,rgba(79,110,247,.15));border-color:var(--dsw-alias-button-primary-fill,#4f6ef7);color:var(--dsw-alias-button-primary-fill,#4f6ef7)}' +
        '.ski .note{color:var(--dsw-alias-label-tertiary,#888);white-space:pre-wrap}' +
        '.ski .err{color:var(--dsw-alias-state-error-primary,#f85149)}' +
        '.ski .busybar{display:flex;align-items:center;gap:8px;padding:7px 11px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.1));border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));color:var(--dsw-alias-label-secondary,#666)}' +
        '.ski .spinner{width:13px;height:13px;border:2px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));border-top-color:var(--dsw-alias-button-primary-fill,#4f6ef7);border-radius:50%;animation:ski-spin .7s linear infinite;flex:none}' +
        '@keyframes ski-spin{to{transform:rotate(360deg)}}' +
        '.ski .toasts{position:fixed;top:14px;right:14px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:420px}' +
        '.ski .toast{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:10px;font-size:12.5px;line-height:1.45;box-shadow:0 4px 18px rgba(0,0,0,.25);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,#222));color:var(--dsw-alias-label-primary,#eee);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35))}' +
        '.ski .toast.ok{border-left:3px solid var(--dsw-alias-state-success-primary,#3fb950)}' +
        '.ski .toast.err{border-left:3px solid var(--dsw-alias-state-error-primary,#f85149)}' +
        '.ski .toast .x{margin-left:auto;cursor:pointer;opacity:.7;font-size:13px;line-height:1}' +
        '.ski .item{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-1,transparent);border-radius:8px;padding:8px 10px;display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}' +
        '.ski .item.user{border-left:3px solid var(--dsw-alias-state-business-primary,#4f6ef7)}' +
        '.ski .item.project{border-left:3px solid var(--dsw-alias-state-success-primary,#3fb950)}' +
        '.ski .item.off{opacity:.62}' +
        '.ski .group{font-weight:700;margin-top:6px;color:var(--dsw-alias-label-primary,#111)}' +
        '.ski .meta{flex:1;min-width:220px}' +
        '.ski .actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
        '.ski .nm{font-weight:600}' +
        '.ski .desc{color:var(--dsw-alias-label-secondary,#666);font-size:12px;word-break:break-word}' +
        '.ski .tag{font-size:11px;padding:1px 6px;border-radius:99px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.12));color:var(--dsw-alias-label-secondary,#666);white-space:nowrap}' +
        '.ski .tag.dupe{color:var(--dsw-alias-state-warn-primary,#d29922)}' +
        '.ski .tag.off{color:var(--dsw-alias-state-warn-primary,#d29922);border:1px solid var(--dsw-alias-state-warn-primary,#d29922)}' +
        '.ski .tag.auto{color:var(--dsw-alias-state-warn-primary,#d29922);border:1px solid var(--dsw-alias-state-warn-primary,#d29922);background:var(--dsw-alias-bg-layer-1,transparent)}' +
        '.ski .probe{font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.6}' +
        '.ski .empty{color:var(--dsw-alias-label-tertiary,#888);padding:8px 0}' +
        '.ski ::placeholder{color:var(--dsw-alias-label-tertiary,#999)}'
      )
  
      function SkillManager(props) {
        const el = React.createElement
        const [workspaces, setWorkspaces] = React.useState([])
        const [wsId, setWsId] = React.useState('')
        const [tab, setTab] = React.useState('manage')
        const [filter, setFilter] = React.useState('all')
        const [busy, setBusy] = React.useState(false)
        const [busyText, setBusyText] = React.useState('Đang xử lý…')
        const [act, setAct] = React.useState('')
        const [note, setNote] = React.useState('')
        const [toasts, setToasts] = React.useState([])
        const [items, setItems] = React.useState([])
        const [areas, setAreas] = React.useState([])
        const [wsInfo, setWsInfo] = React.useState(null)
        const [markerPath, setMarkerPath] = React.useState('')
        const [probe, setProbe] = React.useState(null)
        const [confirmDel, setConfirmDel] = React.useState('')
        const [url, setUrl] = React.useState('')
        const [ref, setRef] = React.useState('')
        const [force, setForce] = React.useState(false)
        const [dest, setDest] = React.useState('proj-agents')
        const [skills, setSkills] = React.useState([])
        const [pick, setPick] = React.useState({})
        const seq = React.useRef(0)
  
        const call = (method, args) => host.call(method, args || {})
        const goBusy = (t) => { setBusy(true); setBusyText(t) }
        const doneBusy = () => setBusy(false)
  
        const toast = (kind, text) => {
          const id = ++seq.current
          setToasts((prev) => prev.concat([{ id, kind, text }]).slice(-4))
          if (timer) {
            timer.timeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 4000)
          }
        }
        const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
  
        const loadList = (opts) => {
          const o = opts || {}
          if (!o.quiet) goBusy(o.loading || 'Đang tải danh sách skill…')
          call('skillmgr.list', { workspaceId: wsId }).then((r) => {
            if (r && r.ok) {
              setItems(r.items || [])
              setAreas(r.areas || [])
              setWsInfo(r.workspace || null)
              setMarkerPath(r.marker || '')
              if (o.ok) toast('ok', o.ok)
            } else {
              if (!o.quiet) setItems([])
              if (o.silentErr === false) toast('err', (r && r.error) || 'Không đọc được danh sách skill')
              else setNote((r && r.error) || 'Không đọc được danh sách skill')
            }
            if (!o.quiet) doneBusy()
          }).catch((e) => { if (!o.quiet) doneBusy(); if (o.silentErr === false) toast('err', 'Lỗi: ' + String((e && e.message) || e)); else setNote('Lỗi: ' + String((e && e.message) || e)) })
        }
  
        // Thao tác theo dòng: spinner tại nút + toast kết quả + reload lặng
        const rowOp = (id, loading, rpcArgs, okMsg, errMsg) => {
          if (act) return
          setAct(id)
          call(rpcArgs[0], rpcArgs[1]).then((r) => {
            if (r && r.ok) { setConfirmDel(''); toast('ok', okMsg(r) || 'Thành công'); loadList({ quiet: true }) }
            else { toast('err', (r && r.error) || errMsg) }
            setAct('')
          }).catch((e) => { toast('err', 'Lỗi: ' + String((e && e.message) || e)); setAct('') })
          void loading
        }
  
        const runProbe = () => {
          goBusy('Đang kiểm tra quyền ghi…')
          setProbe(null)
          call('skillmgr.probe', { workspaceId: wsId }).then((r) => {
            if (r && r.ok) { setProbe(r); toast('ok', 'Đã kiểm tra quyền ghi — xem chi tiết bên dưới') }
            else toast('err', (r && r.error) || 'Không chạy được kiểm tra')
            doneBusy()
          }).catch((e) => { doneBusy(); toast('err', 'Lỗi: ' + String((e && e.message) || e)) })
        }
  
        React.useEffect(() => {
          goBusy('Đang tải workspace…')
          call('skillmgr.workspaces').then((r) => {
            if (r && r.ok) {
              const list = Array.isArray(r.workspaces) ? r.workspaces : []
              setWorkspaces(list)
              if (list.length) setWsId(String(list[0].id))
            }
            doneBusy()
          }).catch((e) => { doneBusy(); toast('err', 'Lỗi: ' + String((e && e.message) || e)) })
        }, [])
  
        React.useEffect(() => { if (tab === 'manage') loadList({ quiet: !!wsId }) }, [wsId, tab])
  
        const areaOf = (key) => { for (const a of areas) if (a.key === key) return a; return null }
        const areaTitle = (key) => {
          const a = areaOf(key)
          if (!a) return key
          return (a.origin === 'user' ? 'User (toàn máy) · ' : 'Workspace · ') + (a.label || '')
        }
        const originOf = (key) => { const a = areaOf(key); return a ? a.origin : '' }
        const byName = {}
        for (const it of items) { const o = originOf(it.areaKey); byName[it.name] = byName[it.name] || new Set(); byName[it.name].add(o) }
        const visible = items.filter((it) => filter === 'all' || originOf(it.areaKey) === filter)
        const groups = []
        const areaOrder = ['user-agents', 'user-dsh', 'proj-agents', 'proj-dsh']
        for (const key of areaOrder) {
          const a = areaOf(key)
          if (!a) continue
          const list = visible.filter((it) => it.areaKey === key)
          if (list.length) groups.push({ key, title: areaTitle(key), root: a.root, list })
        }
        const autoCount = items.filter((it) => it.auto).length
        const locked = !!act
  
        const spinner = el('span', { className: 'spin' })
        const btnLabel = (id, label) => (act === id ? [spinner, label] : label)
  
        const doAuto = (it, on) => {
          if (originOf(it.areaKey) === 'user') { toast('err', 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent: “⚡ tự kích hoạt skill ' + it.name + ' ở ~/.agents/skills”.'); return }
          if (it.disabled && on) { toast('err', 'Hãy “Bật” skill trước rồi mới “Tự kích hoạt” được.'); return }
          const id = 'auto/' + it.areaKey + '/' + it.name
          rowOp(id, '', ['skillmgr.autotoggle', { workspaceId: wsId, area: it.areaKey, name: it.name, on }],
            (r) => (on ? '✓ Đã chọn tự kích hoạt: ' : '✓ Đã bỏ tự kích hoạt: ') + it.name,
            'Không đổi được trạng thái tự kích hoạt')
        }
        const doToggle = (it, enable) => {
          if (originOf(it.areaKey) === 'user') { toast('err', 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent: “' + (enable ? 'bật' : 'tắt') + ' skill ' + it.name + '”.'); return }
          const id = 'tog/' + it.areaKey + '/' + it.name
          rowOp(id, '', ['skillmgr.toggle', { workspaceId: wsId, area: it.areaKey, name: it.name, enable }],
            (r) => (enable ? '✓ Đã Bật ' : '✓ Đã Tắt ') + it.name + ' — mở hội thoại mới để cập nhật danh mục',
            'Không bật/tắt được skill')
        }
        const doDelete = (it) => {
          if (originOf(it.areaKey) === 'user') { toast('err', 'Skill user (~/.agents) chỉ đọc được từ plugin — hãy nhờ agent: “xoá skill ' + it.name + '”.'); return }
          const cid = it.areaKey + '/' + it.name
          if (confirmDel !== cid) { setConfirmDel(cid); return }
          const id = 'del/' + cid
          rowOp(id, '', ['skillmgr.delete', { workspaceId: wsId, area: it.areaKey, name: it.name }],
            (r) => '✓ Đã xoá ' + it.name + ' (' + areaTitle(it.areaKey) + ')',
            'Không xoá được skill')
        }
        const doOpen = (it) => {
          const id = 'open/' + it.areaKey + '/' + it.name
          if (act) return
          setAct(id)
          call('skillmgr.open', { workspaceId: wsId, area: it.areaKey, name: it.name }).then((r) => {
            if (r && r.ok) toast('ok', 'Đã mở File Explorer tại: ' + it.dir)
            else toast('err', (r && r.error) || 'Không mở được thư mục')
            setAct('')
          }).catch((e) => { toast('err', 'Lỗi: ' + String((e && e.message) || e)); setAct('') })
        }
  
        const togglePick = (name, checked) => { const n = {}; for (const k of Object.keys(pick)) n[k] = pick[k]; n[name] = checked; setPick(n) }
        const discover = () => {
          if (!url.trim()) { toast('err', 'Nhập URL GitHub trước (vd https://github.com/owner/repo)'); return }
          goBusy('Đang git clone repo… (repo lớn có thể mất 1-2 phút)')
          setSkills([])
          call('skillmgr.discover', { workspaceId: wsId, dest, url: url.trim(), ref: ref.trim() }).then((r) => {
            if (r && r.ok) {
              const list = Array.isArray(r.skills) ? r.skills : []
              setSkills(list)
              const init = {}
              for (const s of list) if (!s.exists) init[s.name] = true
              setPick(init)
              setNote('Tìm thấy ' + list.length + ' skill. Tick chọn rồi bấm Cài đặt.\nNơi cài: ' + r.destRoot)
              toast('ok', 'Tìm thấy ' + list.length + ' skill trong repo')
            } else { toast('err', (r && r.error) || 'Không khám phá được repo'); setNote((r && r.error) || '') }
            doneBusy()
          }).catch((e) => { doneBusy(); toast('err', 'Lỗi: ' + String((e && e.message) || e)) })
        }
        const doInstall = () => {
          const names = skills.filter((s) => pick[s.name]).map((s) => s.name)
          if (!names.length) { toast('err', 'Chưa chọn skill nào'); return }
          goBusy('Đang cài ' + names.length + ' skill… (chờ chút)')
          call('skillmgr.install', { workspaceId: wsId, dest, url: url.trim(), ref: ref.trim(), names, force }).then((r) => {
            if (r && r.ok) {
              let m = '✓ Đã cài ' + r.installed.length + (r.skipped.length ? ', bỏ qua ' + r.skipped.length : '') + (r.errors.length ? ', lỗi ' + r.errors.length : '') + ' — ' + r.destRoot
              if (r.errors.length) m += ' | ' + r.errors.map((e) => e.name + ': ' + e.reason).join(' | ')
              setSkills([])
              toast('ok', m)
              loadList({ quiet: true })
            } else { toast('err', (r && r.error) || 'Cài đặt thất bại') }
            doneBusy()
          }).catch((e) => { doneBusy(); toast('err', 'Lỗi: ' + String((e && e.message) || e)) })
        }
  
        const wsOptions = workspaces.map((w) => el('option', { key: w.id, value: w.id }, (w.title || w.path) + '  (' + w.path + ')'))
        const destOptions = [
          { v: 'proj-agents', t: 'Workspace: ' + ((wsInfo && wsInfo.title) || '.agents/skills') },
          { v: 'user-agents', t: 'User toàn máy (~/.agents/skills)' },
        ]
  
        const probeBox = probe ? el('div', { className: 'note probe' },
          probe.marker ? 'Marker: ' + probe.marker + '\n' : '',
          probe.cands.map((c) => c.dir + ' → ps:' + (c.ps ? 'OK' : 'CHẶN') + ' · fs:' + (c.fs ? 'OK' : 'CHẶN') + '\n').join('')) : null
  
        const row = (it) => {
          const dup = byName[it.name] && byName[it.name].size > 1
          const isUser = originOf(it.areaKey) === 'user'
          const cls = 'item ' + (isUser ? 'user' : 'project') + (it.disabled ? ' off' : '')
          const cid = it.areaKey + '/' + it.name
          const aAuto = 'auto/' + cid
          const aTog = 'tog/' + cid
          const aDel = 'del/' + cid
          const aOpen = 'open/' + cid
          return el('div', { key: cid + it.dir, className: cls, title: it.dir },
            el('div', { className: 'meta' },
              el('div', { className: 'row' },
                el('span', { className: 'nm' }, it.name),
                it.auto ? el('span', { className: 'tag auto' }, 'tự kích hoạt') : null,
                it.disabled ? el('span', { className: 'tag off' }, 'đã tắt') : el('span', { className: 'tag' }, 'đang bật'),
                dup ? el('span', { className: 'tag dupe' }, 'có ở user & workspace') : null,
                el('span', { className: 'tag' }, it.kb + ' KB'),
              ),
              it.description ? el('div', { className: 'desc' }, it.description) : null,
            ),
            el('div', { className: 'actions' },
              el('button', {
                className: it.auto ? 'auto' : '',
                onClick: () => doAuto(it, !it.auto),
                disabled: busy || locked || it.disabled || isUser,
                title: 'Nội dung SKILL.md sẽ luôn được chèn vào prompt khi plugin chạy',
              }, btnLabel(aAuto, it.auto ? '⚡ Bỏ tự kích hoạt' : '⚡ Tự kích hoạt')),
              el('button', { className: it.disabled ? 'primary' : '', onClick: () => doToggle(it, it.disabled), disabled: busy || locked || isUser },
                btnLabel(aTog, it.disabled ? 'Bật' : 'Tắt')),
              el('button', { onClick: () => doOpen(it), disabled: busy || locked }, btnLabel(aOpen, 'Mở thư mục')),
              el('button', { className: 'danger', onClick: () => doDelete(it), disabled: busy || locked || isUser },
                btnLabel(aDel, confirmDel === cid ? 'Chắc xoá?' : 'Xoá')),
            ),
          )
        }
  
        const managePanel = el('div', null,
          el('div', { className: 'row' },
            el('span', null, 'Workspace:'),
            el('select', { value: wsId, onChange: (e) => setWsId(e.target.value), disabled: busy || locked || !workspaces.length },
              wsOptions.length ? wsOptions : el('option', { value: '' }, '— chưa có workspace —')),
            el('div', { className: 'chiprow' },
              el('button', { className: 'chip' + (filter === 'all' ? ' on' : ''), onClick: () => setFilter('all') }, 'Tất cả'),
              el('button', { className: 'chip' + (filter === 'user' ? ' on' : ''), onClick: () => setFilter('user') }, 'User (global)'),
              el('button', { className: 'chip' + (filter === 'project' ? ' on' : ''), onClick: () => setFilter('project') }, 'Workspace'),
            ),
            el('button', { onClick: () => loadList({}), disabled: busy || locked }, 'Làm mới'),
            el('button', { onClick: runProbe, disabled: busy || locked }, 'Kiểm tra quyền ghi'),
          ),
          probeBox,
          el('div', { className: 'note' },
            (autoCount ? '⚡ ' + autoCount + ' skill đang tự kích hoạt. ' : '') +
            (markerPath ? 'Marker: ' + markerPath + '. ' : '') +
            'Thao tác skill user (~/.agents) chỉ đọc được từ plugin — nhờ agent thực hiện ghi.'),
          groups.length === 0 && !busy && !act ? el('div', { className: 'empty' }, 'Chưa có skill nào (hoặc đang tải).') : null,
          groups.map((g) =>
            el('div', { key: g.key },
              el('div', { className: 'group' }, g.title),
              g.root ? el('div', { className: 'note' }, g.root) : null,
              g.list.map(row),
            )),
        )
  
        const githubPanel = el('div', null,
          el('div', { className: 'row' },
            el('span', null, 'Cài vào:'),
            el('select', { value: dest, onChange: (e) => setDest(e.target.value), disabled: busy || locked },
              destOptions.map((o) => el('option', { key: o.v, value: o.v }, o.t))),
          ),
          el('div', { className: 'row' },
            el('input', { type: 'text', placeholder: 'https://github.com/owner/repo', value: url, disabled: busy, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') discover() } }),
            el('input', { type: 'text', placeholder: 'branch/tag (trống = mặc định)', value: ref, disabled: busy, style: { flex: '0 1 180px' }, onChange: (e) => setRef(e.target.value) }),
          ),
          el('div', { className: 'row' },
            el('button', { className: 'primary', onClick: discover, disabled: busy || locked }, busy ? el('span', { className: 'spinner' }) : null, busy ? busyText : 'Khám phá skill trong repo'),
            skills.length ? el('button', { onClick: doInstall, disabled: busy || locked }, 'Cài đặt (' + skills.filter((s) => pick[s.name]).length + ')') : null,
            el('label', { style: { display: 'inline-flex', gap: 4, alignItems: 'center' } },
              el('input', { type: 'checkbox', checked: force, onChange: (e) => setForce(e.target.checked) }),
              'Ghi đè nếu đã tồn tại'),
          ),
          skills.map((s) =>
            el('div', { key: s.name, className: 'item' },
              el('input', { type: 'checkbox', checked: !!pick[s.name], disabled: s.exists && !force, onChange: (e) => togglePick(s.name, e.target.checked) }),
              el('div', { className: 'meta' },
                el('div', { className: 'row' },
                  el('span', { className: 'nm' }, s.name),
                  el('span', { className: 'tag' }, s.exists ? 'đã có ở nơi cài' : 'mới'),
                ),
                s.description ? el('div', { className: 'desc' }, s.description) : null,
              ),
            )),
        )
  
        return el('div', { className: 'ski' },
          toasts.length ? el('div', { className: 'toasts' },
            toasts.map((t) =>
              el('div', { key: t.id, className: 'toast ' + t.kind },
                el('span', { style: { whiteSpace: 'pre-wrap', minWidth: 0 } }, t.text),
                el('span', { className: 'x', onClick: () => dismissToast(t.id) }, '✕'),
              )),
          ) : null,
          el('div', { style: { fontSize: 15, fontWeight: 600 } }, 'Quản lý Skill của DSH'),
          el('div', { className: 'row' },
            el('div', { className: 'tabs' },
              el('button', { className: tab === 'manage' ? 'on' : '', onClick: () => setTab('manage') }, 'Quản lý'),
              el('button', { className: tab === 'github' ? 'on' : '', onClick: () => setTab('github') }, 'Thêm từ GitHub'),
            ),
          ),
          busy ? el('div', { className: 'busybar' }, el('span', { className: 'spinner' }), el('span', null, busyText || 'Đang xử lý…')) : null,
          note ? el('div', { className: /Lỗi|thất bại/i.test(note) ? 'note err' : 'note' }, note) : null,
          tab === 'manage' ? managePanel : githubPanel,
          el('div', { className: 'note', style: { marginTop: 8 } },
            'Plugin chạy tạm trong session; thao tác từng skill có spinner tại nút và kết quả hiện toast. Ghi vào thư mục user (~/.agents) cần agent (danger-full-access).'),
        )
      }
  
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'skill-manager', order: 60, label: () => 'Skill Manager' },
        (p) => React.createElement(SkillManager, { close: p.close }),
      ))
    },
  }
}
const plugin = makePlugin();
exports.name = "dsh-skill-manager";
exports.inject = ["slots"];
exports.apply = plugin.apply;
return module.exports;
}
});
//# sourceMappingURL=client.js.map
