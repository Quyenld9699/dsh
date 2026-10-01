# Backup cấu hình DSH (DeepSeek Harness) — 2026-09-30 16:51

Backup "chụp nhanh" (snapshot) toàn bộ cấu hình đang chạy được của máy này:
`DSH_HOME = C:\Users\QuyenLD\.dsh`, profile **web**, dsh CLI **0.2.0-rc.2**.

| Hạng mục | Nguồn | Trong backup |
| --- | --- | --- |
| Config DeepSeek / provider / model | `~\.dsh\profiles\web\cordis.patch.yml` | `dsh-home\profiles\web\cordis.patch.yml` |
| API key | `~\.dsh\.credentials.yaml` | bản **che key**: `dsh-home\credentials.redacted.yaml` + bản thật **ngoài repo** |
| Plugin đã cài (danh sách + version) | `profiles\web\package.json`, `pnpm-lock.yaml`, `node_modules` | `dsh-home\profiles\web\*` + `inventory\installed-packages.txt` |
| Plugin Market (vùng, group, plugin bị tắt) | `profiles\web\.dsh-market\state.json`, `log.ndjson` | `dsh-home\profiles\web\.dsh-market\` |
| Lịch sử thao tác cài/gỡ plugin | `profiles\web\.plugin-manager\logs\` | `dsh-home\profiles\web\.plugin-manager\logs\` |
| UI config | `cordis.patch.yml` (`ui-theme` = dark, `ui-settings-general`), `.dsh-market\state.json` | như trên |
| Workspace / session đã ghim | `storages\workspace.json` | `dsh-home\storages\workspace.json` |
| Panel & cache phiên (UI state phía server) | `storages\session_projcache\sessions\*.json` | `dsh-home\storages\session_projcache\` |
| Lịch sử chi phí | `storages\cost-meter\ledger.json` | `dsh-home\storages\cost-meter\ledger.json` |

**Không** backup: nội dung `node_modules` (nặng, phục hồi bằng `pnpm install` theo `pnpm-lock.yaml`),
file `.zstd` phiên chat (`~\.dsh\sessions\`), và `localStorage` của trình duyệt (trạng thái UI thuần client
như tab đang mở / cuộn trang — chỉ nằm trong browser, xóa cache trình duyệt là mất, không phục hồi được từ backup này).

## Cây thư mục

```
dsh-backup-20260930-165128\
├─ MANIFEST.json                 # danh sách file + SHA256 + kích thước
├─ README.md                     # file này
├─ restore.ps1                   # script phục hồi
├─ dsh-home\
│  ├─ .anonymous-user-id
│  ├─ credentials.redacted.yaml  # key đã che (len + sha256 8 ký tự)
│  ├─ profiles\web\
│  │  ├─ cordis.yml
│  │  ├─ cordis.patch.yml        # ⭐ provider/model + UI theme + auto-review
│  │  ├─ package.json            # ⭐ plugin đã cài + thứ tự bundle
│  │  ├─ pnpm-lock.yaml          # ⭐ version chính xác của mọi gói
│  │  ├─ pnpm-workspace.yaml
│  │  ├─ .dsh-market\{state.json, log.ndjson, discovery-compatibility-v1.json}
│  │  └─ .plugin-manager\logs\operation-*\pnpm.log
│  └─ storages\
│     ├─ workspace.json
│     ├─ cost-meter\ledger.json
│     └─ session_projcache\sessions\session-*.json
└─ inventory\
   ├─ runtime.txt                # dsh/node/pnpm version, biến môi trường DSH_*
   ├─ installed-packages.txt     # 190 gói trong node_modules (name@version)
   └─ profile-package.json
```

## API key (đã chọn: không để key thật trong repo)

- Trong repo chỉ có **bản che**: `dsh-home\credentials.redacted.yaml`
  (vd `DEEPSEEK_API_KEY: "<REDACTED len=35 sha256=eeb0349c>"`).
- Bản **thật** đã copy ra ngoài repo git:
  `C:\Users\QuyenLD\.dsh-backup-secrets\credentials-20260930-165128.yaml`
  → giữ nguyên quyền truy cập như `~\.dsh`, **không** copy file này vào `D:\dsh` (repo có remote GitHub).
- Danh sách key đang dùng: `DEEPSEEK_API_KEY`, `INCEPTIONLABS_API_KEY`, `GOOGLE_API_KEY`,
  `client-connection/browser-session`. Chưa có `TYPESAFE_API_KEY` (vì JEV chưa cài lại — xem dưới).
- Đã quét toàn bộ `D:\dsh` (trừ `.git`) để chắc chắn không có giá trị key nào lọt vào repo: **0 kết quả**.

## Phục hồi

```powershell
# 1) Xem trước, không ghi gì
D:\dsh\backup\dsh-backup-20260930-165128\restore.ps1 -WhatIf

# 2) Phục hồi config profile (file cũ được đổi tên .bak-<timestamp>, không ghi đè mất)
D:\dsh\backup\dsh-backup-20260930-165128\restore.ps1

# 3) Phục hồi cả credentials thật (lấy từ file ngoài repo)
D:\dsh\backup\dsh-backup-20260930-165128\restore.ps1 `
  -SecretsFile C:\Users\QuyenLD\.dsh-backup-secrets\credentials-20260930-165128.yaml

# 4) Cài lại đúng cây plugin theo lock rồi khởi động lại
cd $env:DSH_HOME\profiles\web; pnpm install
npx @deepseek-ai/dsh web
```

Kiểm tra toàn vẹn trước khi phục hồi (so SHA256 với `MANIFEST.json`):

```powershell
$d='D:\dsh\backup\dsh-backup-20260930-165128'
(Get-Content $d\MANIFEST.json -Raw | ConvertFrom-Json).files |
  ForEach-Object { $h=(Get-FileHash (Join-Path $d $_.path) -Algorithm SHA256).Hash.ToLower()
                   if ($h -ne $_.sha256) { "MISMATCH: $($_.path)" } }
```

## Sự cố đã gặp và cách xử lý

> **Đã phân tích tới gốc rễ và kiểm chứng bằng thực nghiệm cách ly (2026-09-30): xem [JEV-RCA.md](../JEV-RCA.md).**
> Nguyên nhân xác nhận: `dsh-jev-verify` ghim cứng `@deepseek-ai/dsh-tools@0.1.5-rc.2` → pnpm (hoisted) đặt bản cũ
> vào `profiles\web\node_modules` → row `tools` nạp bản cũ → dsh disable row → `startup failed`.
> Cách cài an toàn **đã kiểm chứng boot được**: `D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools`
> (ghim `@deepseek-ai/dsh-tools` về `0.2.0-rc.2` bằng pnpm `overrides`).

**Triệu chứng:** `npx @deepseek-ai/dsh web` → `dsh: disabling profile plugin row "tools":
Plugin @deepseek-ai/dsh-tools@0.1.5-rc.2 is incompatible with dsh 0.2.0-rc.2` →
`startup failed: 1 required plugin did not activate`, kèm 10 plugin kẹt chờ service `tools`
(`agent-loop (required)`, `jev-verify`, `better-sidebar`, `mcp-resources`, `tool-agent-team`, …).

**Nguyên nhân (đã xác nhận bằng mã nguồn dsh + npm metadata + thực nghiệm, xem JEV-RCA.md):** profile `web` còn resolve ra
`@deepseek-ai/dsh-tools@0.1.5-rc.2` — bản này bị kéo vào bởi **dependency cứng** của `dsh-jev-verify`
(`dependencies: {"@deepseek-ai/dsh-tools": "0.1.5-rc.2"}`) và pnpm hoist nó vào `profiles\web\node_modules`,
trong khi runtime là `0.2.0-rc.2` (cần `^0.2.0-rc.1`). Vì dsh resolve row theo base của profile, row `tools`
nạp đúng bản cũ đó. dsh chặn cứng row `tools` → mọi plugin cần
service `tools` đều pending. Đây là vấn đề **resolve dependency ở mức profile**, không phải trạng thái
runtime, nên **tắt/bật lại không có tác dụng** — mỗi lần khởi động lại đọc đúng cây dependency đó.
Lưu ý: màn hình Plugin Market **không** phát hiện được bẫy này (nó chỉ soi peer của chính plugin),
nên đừng tin nút Install — hãy dùng `D:\dsh\scripts\jev-safe-install.ps1`.

**Cách đã khắc phục trên máy này (đang chạy tốt):** resolve lại toàn bộ cây dependency của profile —
log `operation-H63ghS` (16:29) ghi `resolved 173, reused 173, added 173` + `dsh-cost-meter ^1.7.44`,
sau đó dsh khởi động bình thường (phiên hiện tại chạy `dsh 0.2.0-rc.2`, profile web, có đầy đủ tool).

**Thứ tự xử lý khi tái phát:**

```powershell
# a) Xem thực tế đang có gì
Get-ChildItem "$env:DSH_HOME\profiles\web\node_modules\@deepseek-ai" -Force
Select-String "$env:DSH_HOME\profiles\web\pnpm-lock.yaml" -Pattern 'dsh-tools'
dsh plugin --profile web list        # nếu CLI hỗ trợ; xem thêm: dsh plugin --help

# b) Cách 1 (khuyến nghị): làm mới cây dependency
cd $env:DSH_HOME\profiles\web; pnpm install
# c) Cách 2: gỡ plugin kéo theo dsh-tools cũ rồi cài lại bản tương thích
dsh plugin --profile web remove dsh-jev-verify
dsh plugin --profile web add dsh-jev-verify
# d) Cách 3 (chỉ khi buộc giữ): exemption đúng phiên bản — dsh cảnh báo có thể crash/mất dữ liệu
dsh plugin allow-version --help
```

**Quy tắc tránh lặp lại:** mọi plugin cài từ Market phải cùng dòng phiên bản với runtime
(`dsh 0.2.0-rc.x` ↔ plugin khai `^0.2.0-rc.1`). Trước khi cài plugin mới, xem
`.dsh-market\discovery-compatibility-v1.json` (đã backup) để biết plugin nào tương thích.

## Trạng thái JEV hiện tại

- **Chưa cài lại** (đúng như bạn nói). Trong `package.json`/`dsh.profile.bundles` không có
  `dsh-jev-verify`; `node_modules` không có gói `jev*`; `refs` của credentials không có `TYPESAFE_API_KEY`.
- Plugin JEV chính của máy là **`dsh-jev-verify`** (market/npm, repo `github.com/xienda/dsh-jev-verify`),
  cung cấp tool `jev_decision`, `jev_verify`, `jev_guard_status`, `jev_overview`
  (xem `D:\dsh\skills\manifest.json` và `D:\dsh\plugins\README.md` của repo).
- Khi cài lại, đúng 2 bước:
  1. `dsh plugin --profile web add dsh-jev-verify` (profile web có `patchReload: live` → có thể hiện ngay,
     không cần restart) — hoặc GUI: Settings → Plugin Market → tìm `jev` → Install.
  2. Thêm `TYPESAFE_API_KEY: <key>` vào mục `refs` của `%DSH_HOME%\.credentials.yaml`
     (hoặc Settings → Plugins → Plugin configuration → Jev). **Không commit key.**
- Kiểm tra: hỏi agent chạy `jev_overview` / `jev_verify`.

## Ghi chú

- `storages\workspace.json` trong backup liệt kê 2 workspace: `D:\dsh` và
  `C:\Users\QuyenLD\OneDrive\Documents\deepseek-harness\default-workspace`, cùng session đang ghim.
- `pnpm-lock.yaml` là thứ quan trọng nhất để tái lập đúng version plugin; `package.json` cho biết thứ tự bundle.
- Backup này là ảnh chụp tại một thời điểm — nếu bạn cài/gỡ plugin sau này, chạy lại
  `D:\dsh\backup\_make-backup.ps1` để tạo bản mới (script tự đặt tên theo timestamp).
