// build-static.mjs — chuyển dynamic client thành static client bundle (dsh market format).
// Cách dùng: node build-static.mjs <packageRoot> <dynamicClientFile>
//   packageRoot      = thư mục package tĩnh (có package.json; client.js ghi vào client/client.js)
//   dynamicClientFile= dynamic/client.js (nội dung 'return { apply(ctx){...} }')
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [, , packageRoot, dynFile] = process.argv
if (!packageRoot || !dynFile) {
  console.error('usage: node build-static.mjs <packageRoot> <dynamicClientFile>')
  process.exit(1)
}

const dyn = readFileSync(dynFile, 'utf8').trim()
if (!dyn.startsWith('return {')) {
  console.error('dynamic client file phải là "return {...}" body')
  process.exit(1)
}

const pkgPath = join(packageRoot, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const id = pkg.name

const out = `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {
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
const host = { call: (method, args) => fetch("/dsh-sm/" + method + (__tok ? "?token=" + encodeURIComponent(__tok) + "&" : "?") + "q=" + encodeURIComponent(JSON.stringify(args || {})), { method: "GET", cache: "no-store" }).then(async (r) => { const t = await r.text(); if (!t) throw new Error("HTTP " + r.status + " — response rỗng"); let j; try { j = JSON.parse(t); } catch (e) { throw new Error("HTTP " + r.status + ": " + t.slice(0, 160)); } if (j && j.ok === false && j.error) throw new Error(j.error); return j; }) };
function makePlugin() {
${dyn.split('\n').map((l) => '  ' + l).join('\n')}
}
const plugin = makePlugin();
exports.name = ${JSON.stringify(id)};
exports.inject = ["slots"];
exports.apply = plugin.apply;
return module.exports;
}
});
//# sourceMappingURL=client.js.map
`

mkdirSync(join(packageRoot, 'client'), { recursive: true })
writeFileSync(join(packageRoot, 'client', 'client.js'), out)
pkg.exports = { ...(pkg.exports || {}), './client': './client/client.js', './package.json': './package.json' }
pkg.dsh = { ...(pkg.dsh || {}), client: { inject: ['@deepseek-ai/dsh-client-ui-slots'], platform: 'web' } }
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('client.js', out.length, 'bytes ->', join(packageRoot, 'client', 'client.js'))
console.log('package.json updated')
