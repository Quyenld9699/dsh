#!/usr/bin/env node
/*
 * dsh-peer-check.mjs — mô phỏng đúng bước preflight tương thích plugin của dsh.
 *
 * Vì sao cần: dsh chỉ kiểm tra tương thích khi KHỞI ĐỘNG. Cài một plugin market
 * có thể để lại hậu quả tới lần bật sau mới lộ ra. Công cụ này chạy TRƯỚC khi
 * restart, dùng chính hàm evaluatePluginCompatibility() của dsh nên kết quả
 * trùng với phán quyết lúc startup.
 *
 * Chế độ:
 *   1) --mode profile : soi từng row trong profile (danh sách row lấy từ
 *      `dsh --profile <p> --dump-config`), resolve y như dsh và phán quyết.
 *   2) --mode deps    : soi manifest của gói ĐỊNH CÀI (npm view ... --json) để
 *      phát hiện dependency cứng trỏ vào dòng @deepseek-ai/dsh-* cũ — đúng cái
 *      bẫy mà preflight của dsh/plugin-manager KHÔNG kiểm tra.
 *
 * Cách dùng:
 *   node dsh-peer-check.mjs --app-boot <...>/@deepseek-ai/dsh-app-boot/lib/index.js \
 *        --profile <profileDir> --rows rows.json [--json]
 *   node dsh-peer-check.mjs --app-boot <...> --mode deps --manifest pkg.json [--json]
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const asJson = process.argv.includes('--json');
const mode = arg('--mode', 'profile');
const appBootPath = arg('--app-boot', process.env.DSH_APP_BOOT_PATH ?? '');
const profileDir = arg('--profile', process.env.DSH_PROFILE_DIR ?? '');
const rowsFile = arg('--rows', '');
const manifestFile = arg('--manifest', '');

function fail(msg, code = 2) {
  console.error(`dsh-peer-check: ${msg}`);
  process.exit(code);
}
if (!appBootPath || !existsSync(appBootPath)) fail('thiếu --app-boot <đường dẫn @deepseek-ai/dsh-app-boot/lib/index.js>');

const boot = await import(pathToFileURL(appBootPath).href);
const runtimeVersion = boot.getDshRuntimeVersion();
const requireFromBoot = createRequire(appBootPath);
const semver = requireFromBoot('semver');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
/** `npm view <pkg> <field...> --json` trả về MẢNG các object rời; gộp lại thành một manifest. */
function readManifestJson(file) {
  const parsed = readJson(file);
  if (Array.isArray(parsed)) return Object.assign({}, ...parsed.filter((part) => part && typeof part === 'object'));
  return parsed;
}

/** Thứ tự resolve của dsh cho row: Node lookup tính từ base của profile. */
function resolveFromProfile(name) {
  if (!profileDir) return undefined;
  const paths = createRequire(join(profileDir, 'package.json')).resolve.paths(name) ?? [];
  for (const searchPath of paths) {
    const candidate = join(searchPath, name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
  }
  return undefined;
}
/** Bản mà chính dsh đang chạy cung cấp (installation anchor). */
function resolveFromInstallation(name) {
  const paths = createRequire(appBootPath).resolve.paths(name) ?? [];
  for (const searchPath of paths) {
    const candidate = join(searchPath, name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
  }
  return undefined;
}
function manifestAt(dir) {
  try {
    return readJson(join(dir, 'package.json'));
  } catch {
    return undefined;
  }
}

const result = {
  mode,
  runtimeVersion,
  profileDir: profileDir || null,
  checked: 0,
  denials: [],
  shadows: [],
  dependencyFlags: [],
  notes: []
};

if (mode === 'deps') {
  if (!manifestFile) fail('--mode deps cần --manifest <file json của npm view>');
  const manifest = readManifestJson(manifestFile);
  const name = manifest.name ?? arg('--name', '(unknown)');
  const version = manifest.version ?? '(unknown)';
  const test = (kind, deps) => {
    for (const [dep, range] of Object.entries(deps ?? {})) {
      if (dep !== '@deepseek-ai/dsh' && !dep.startsWith('@deepseek-ai/dsh-')) continue;
      const ok = semver.satisfies(runtimeVersion, String(range), { includePrerelease: true });
      if (!ok) {
        result.dependencyFlags.push({
          package: `${name}@${version}`,
          kind,
          dependency: dep,
          range: String(range),
          runtimeVersion
        });
      }
    }
  };
  test('dependencies', manifest.dependencies);
  test('peerDependencies', manifest.peerDependencies);
  result.package = `${name}@${version}`;
  result.checked = 1;
} else {
  let rows = [];
  if (rowsFile) {
    rows = readJson(rowsFile);
  } else if (profileDir && existsSync(join(profileDir, 'node_modules'))) {
    // Không có danh sách row: quét mọi manifest trong node_modules của profile.
    const nm = join(profileDir, 'node_modules');
    const names = [];
    for (const entry of requireFromBoot('node:fs').readdirSync(nm, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name.startsWith('@')) {
        for (const sub of requireFromBoot('node:fs').readdirSync(join(nm, entry.name), { withFileTypes: true })) {
          if (sub.isDirectory() || sub.isSymbolicLink()) names.push(`${entry.name}/${sub.name}`);
        }
      } else {
        names.push(entry.name);
      }
    }
    rows = names.map((name) => ({ id: null, name, layer: '(scan node_modules)' }));
    result.notes.push('không có --rows: đã quét toàn bộ node_modules của profile (rộng hơn tập row thật)');
  }

  let exemptions = {};
  if (profileDir) {
    try {
      exemptions = boot.readProfileVersionExemptions(profileDir) ?? {};
    } catch (error) {
      result.notes.push(`không đọc được compatibility.json: ${String(error)}`);
    }
  }

  for (const row of rows) {
    const name = row.name;
    if (typeof name !== 'string' || name.length === 0) continue;
    if (name.startsWith('cordis:') || name.startsWith('.') || name.startsWith('#') || name.startsWith('file:')) continue;
    if (row.disabled === true) continue;
    if (name.startsWith('/') || /^[A-Za-z]:[\\/]/.test(name)) continue;
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) continue;

    const profilePath = resolveFromProfile(name);
    const installPath = resolveFromInstallation(name);
    const chosen = profilePath ?? installPath;
    if (chosen === undefined) {
      result.notes.push(`không resolve được row ${JSON.stringify(row.id ?? name)} (${name})`);
      continue;
    }
    const manifest = manifestAt(chosen);
    if (manifest === undefined) continue;
    result.checked += 1;

    if (profilePath !== undefined && installPath !== undefined && profilePath !== installPath) {
      const a = manifestAt(profilePath);
      const b = manifestAt(installPath);
      if (a?.version !== b?.version) {
        result.shadows.push({
          row: row.id ?? null,
          name,
          layer: row.layer ?? null,
          chosenPath: profilePath,
          profileVersion: a?.version ?? null,
          installationPath: installPath,
          installationVersion: b?.version ?? null
        });
      }
    }

    let issue;
    try {
      issue = boot.evaluatePluginCompatibility(manifest, exemptions, runtimeVersion);
    } catch (error) {
      issue = { name: manifest.name, version: manifest.version, runtimeVersion, peers: {}, error: String(error) };
    }
    if (issue !== undefined && issue.exempted !== true) {
      result.denials.push({
        row: row.id ?? null,
        layer: row.layer ?? null,
        resolvedPath: chosen,
        fromProfile: profilePath !== undefined,
        message: boot.pluginCompatibilityWarning(issue),
        issue
      });
    }
  }
}

if (asJson) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(`runtime dsh        : ${runtimeVersion}`);
  console.log(`profile            : ${result.profileDir ?? '(không kiểm tra profile)'}`);
  console.log(`row/manifest đã soi: ${result.checked}`);
  for (const note of result.notes) console.log(`note               : ${note}`);
  for (const flag of result.dependencyFlags) {
    console.log(`HARD-FAIL [${flag.kind}] ${flag.package}: ${flag.dependency} = ${flag.range} (yêu cầu ${flag.runtimeVersion} thoả range này — KHÔNG thoả)`);
  }
  for (const shadow of result.shadows) {
    console.log(`SHADOW     row "${shadow.row}" (${shadow.name}) sẽ nạp bản TRONG profile: ${shadow.profileVersion} thay vì ${shadow.installationVersion} của dsh`);
  }
  for (const denial of result.denials) console.log(`DENY       ${denial.message}`);
  console.log(
    result.denials.length === 0 && result.dependencyFlags.length === 0
      ? 'KẾT LUẬN   : OK — không thấy row nào bị dsh từ chối.'
      : `KẾT LUẬN   : KHÔNG AN TOÀN — ${result.denials.length} row sẽ bị disable, ${result.dependencyFlags.length} vấn đề dependency.`
  );
}
process.exit(result.denials.length > 0 || result.dependencyFlags.length > 0 ? 1 : 0);
