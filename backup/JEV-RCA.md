# Vì sao cài `dsh-jev-verify` làm dsh không bật được web — phân tích gốc rễ + cách cài an toàn

Ngày phân tích: **2026-09-30** · Máy: `DSH_HOME=C:\Users\QuyenLD\.dsh`, profile **web**, dsh **0.2.0-rc.2**, pnpm **12.3.4**, node **24.20.0**.

Kết luận ngắn: **không phải lỗi cài đặt của bạn, cũng không phải lỗi runtime.** Plugin `dsh-jev-verify`
(family JEV/TypeSafe trên market) khai một **dependency cứng** `@deepseek-ai/dsh-tools: 0.1.5-rc.2`.
Với profile `web` đang dùng `nodeLinker: hoisted`, pnpm đặt bản `dsh-tools` cũ đó vào
`profiles\web\node_modules\@deepseek-ai\dsh-tools`, và vì dsh resolve **row theo profile trước**,
row `tools` (do `@deepseek-ai/dsh-base` khai) nạp đúng bản cũ → dsh tự disable row `tools`
→ plugin `agent-loop` (bắt buộc, đang chờ service `tools`) không activate → `startup failed`.
Vì tình trạng nằm ở **cây dependency trên đĩa**, tắt/bật lại đọc lại đúng cây đó nên không bao giờ hết.

Nhưng **cứu được**: chỉ cần bỏ plugin khỏi `package.json` + `pnpm install --force` (không cần dsh chạy),
hoặc `dsh rescue --from-default-profile web`. Và cài **an toàn ngay bây giờ** được bằng pnpm `overrides`
ghim `@deepseek-ai/dsh-tools` về bản runtime — đã kiểm chứng boot thành công (mục 4).

---

## 1. Chuỗi nhân quả, kèm bằng chứng

| # | Mắt xích | Bằng chứng |
| --- | --- | --- |
| 1 | `dsh-jev-verify@0.7.4` khai **dependencies** `@deepseek-ai/dsh-tools: "0.1.5-rc.2"` (ghim cứng, không phải peer) | `npm view dsh-jev-verify@0.7.4 dependencies peerDependencies` → `{"@deepseek-ai/dsh-tools":"0.1.5-rc.2","@deepseek-ai/schemastery":"^3.18.4"}`; peers chỉ có `@deepseek-ai/cordis: ">=4.0.1 <5"` |
| 2 | **Mọi** bản đã publish đều ghim y hệt: 0.2.0, 0.5.0, 0.6.0, 0.7.0, 0.7.1, 0.7.2, 0.7.3, 0.7.4 (21/09 → 30/09/2026). Bản 0.7.4 publish 30/09 08:35Z, sự cố startup 08:51Z | vòng lặp `npm view dsh-jev-verify@<v> dependencies` cho từng version |
| 3 | Preflight của market/CLI **không soi dependency cứng**, chỉ soi peer mà chính plugin khai → cài vẫn qua | `@deepseek-ai/dsh-plugin-manager/README.md:63`: "a registry spec is resolved through pnpm's registry lookup for the version its range selects and **the peers that version declares**" |
| 4 | `nodeLinker: hoisted` của profile đặt bản cũ vào `profiles\web\node_modules\@deepseek-ai\dsh-tools` | `profiles\web\pnpm-workspace.yaml` → `nodeLinker: hoisted`; sau khi cài thật (thực nghiệm homeA) `node_modules\@deepseek-ai\dsh-tools\package.json` = **0.1.5-rc.2** |
| 5 | dsh resolve **row** theo base của profile; bundle thì installation-first — chính sự bất đối xứng này tạo bẫy | `@deepseek-ai/dsh-app-boot/lib/index.js`: `prepareProfileEntries`/`preflight` (L2057–2094) gọi `manifestOf(ctx, row.name, parentURL)` (L2013–2023 → `createRequire(parentURL).resolve.paths` / `PluginPackages.packageOf` L3241–3252) tức tìm từ **profile**; còn `resolveBundleDir` (L901–907) ghi rõ bundle phải "installation anchor first … never from a profile-local copy" |
| 6 | Row `tools` nạp bản 0.1.5-rc.2; manifest đó khai peers `^0.1.5-rc.2` cho 8 gói `@deepseek-ai/dsh-*` → không thoả `0.2.0-rc.2` | `npm view @deepseek-ai/dsh-tools@0.1.5-rc.2 peerDependencies` trả **đúng chuỗi JSON** trong log lỗi của bạn; hàm `evaluatePluginCompatibility` (L286–313) và câu thông báo `pluginCompatibilityWarning` (L320–322) khớp từng chữ, kể cả "Exact-version exemption: not active" |
| 7 | Không có exemption nào để "cho qua" | profile **web** không có `compatibility.json`; `dsh plugin --profile web version-exemptions` → `{}` |
| 8 | Row bị `row.disabled = true` → `agent-loop` (required) chờ service `tools` mãi → startup fail | log thật: `dsh: disabling profile plugin row "tools": …` + `dsh: startup failed: 1 required plugin did not activate` (row `tools` xuất hiện trong `dsh --profile web --dump-config` với layer `@deepseek-ai/dsh-base`) |

**Vì sao tắt/bật lại vô ích:** phán quyết được tính lại mỗi lần boot từ chính cây `node_modules` trên đĩa.
Không có trạng thái treo nào để reset — chỉ có một bản `dsh-tools` cũ đang nằm chắn đường.

## 2. Tái hiện + kiểm chứng trong môi trường cách ly (không đụng profile thật)

Script: `C:\Users\QuyenLD\.dsh-jev-test\run-experiment.ps1`. Dựng 2 `DSH_HOME` clone:

| | Clone | Kết quả `node_modules\@deepseek-ai\dsh-tools` | Soi trước khi boot (dùng chính hàm của dsh) | Boot thật `dsh web --port 0 --no-open` |
| --- | --- | --- | --- | --- |
| **homeA** | clone + `dsh-jev-verify`, không ghim | **0.1.5-rc.2** | `SHADOW` row "tools" + `DENY` đúng thông báo của sự cố | **FAIL**, exit 1: `disabling profile plugin row "tools" … startup failed: 1 required plugin did not activate` |
| **homeB** | clone + `dsh-jev-verify` + `overrides: '@deepseek-ai/dsh-tools': 0.2.0-rc.2` | **0.2.0-rc.2** | `OK` | **OK**: phục vụ tại `http://127.0.0.1:51700` |

→ Tái hiện được 100% lỗi ban đầu, và **cách sửa cũng được chứng minh end-to-end**, không phải suy đoán.

Vì sao ghim được mà không sợ lệch API: plugin chỉ dùng **đúng một** API từ `dsh-tools` —
`({ defineTool } = await import("@deepseek-ai/dsh-tools"))` (tarball `dsh-jev-verify@0.7.4`, `lib/index.js:27`),
và `defineTool(options)` tồn tại ở cả hai bản (`0.1.5-rc.2` `lib/index.js:837`; `0.2.0-rc.2` `lib/index.js:838`,
cùng chữ ký). Vẫn phải smoke-test tool thật sau khi cài (xem mục 5).

## 3. Dấu hiệu nhận biết sớm (trước khi restart)

```powershell
# Nếu thấy @deepseek-ai/dsh-tools phiên bản 0.1.x nằm TRONG profile -> chắc chắn lần boot sau sẽ hỏng
Get-Content "$env:DSH_HOME\profiles\web\node_modules\@deepseek-ai\dsh-tools\package.json" |
  Select-String '"version"'
Select-String "$env:DSH_HOME\profiles\web\pnpm-lock.yaml" -Pattern "dsh-tools@0\.1\."
```

## 4. Cài JEV an toàn — chọn 1 trong 3

### (a) Khuyến nghị: cài `dsh-jev-verify` + ghim `dsh-tools` về bản runtime — **đã kiểm chứng boot OK**

```powershell
# Rào chắn đầy đủ (preflight + snapshot + hậu kiểm + tự rollback)
D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools
```

Guard làm đúng các việc sau, và **không restart** cho tới khi hậu kiểm sạch:
thêm vào `%DSH_HOME%\profiles\web\pnpm-workspace.yaml`:

```yaml
overrides:
  '@deepseek-ai/dsh-tools': 0.2.0-rc.2     # = `dsh --version`
```

rồi cài, rồi soi lại toàn bộ row bằng chính `evaluatePluginCompatibility` của dsh.

### (b) Đổi sang plugin JEV khác đã tương thích (không cần ghim)

Kiểm tra bằng `--mode deps` (không có dependency cứng nào vào `@deepseek-ai/dsh-*`):

| Gói | Dependencies cứng | Peers | Kết luận |
| --- | --- | --- | --- |
| `dsh-jev-tools@0.1.12` | chỉ `@deepseek-ai/cosmokit`, `schemastery` | toàn `*` | an toàn |
| `dsh-jev-interceptor@0.2.4` | không có | toàn `*` | an toàn |
| `dsh-jev-decide@0.1.2` | không có | `dsh-tools >=0.1.0-rc.6` | an toàn |
| `jevcore-dsh@0.4.1` | `jevcore` | `dsh-tools <0.2.0` | **bị preflight của dsh chặn ngay lúc cài** (fail an toàn, không phá gì) |
| `dsh-jev-verify@0.7.4` | **`dsh-tools 0.1.5-rc.2`** | `cordis` | **bẫy** — phải ghim hoặc chờ bản mới |

### (c) Chờ tác giả cập nhật plugin lên dòng 0.2.x

Repo: `github.com/xienda/dsh-jev-verify`. Cho tới lúc đó, mọi bản đều là bẫy như nhau.

## 5. Sau khi cài: kiểm tra thật (đừng tin mỗi "cài thành công")

```powershell
# 1) Bản dsh-tools trong profile phải bằng bản runtime
(Get-Content "$env:DSH_HOME\profiles\web\node_modules\@deepseek-ai\dsh-tools\package.json" -Raw | ConvertFrom-Json).version
# 2) Hậu kiểm row (offline, mô phỏng đúng preflight của dsh)
D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -CheckOnly
# 3) Key TypeSafe (không commit): thêm TYPESAFE_API_KEY vào refs của %DSH_HOME%\.credentials.yaml
# 4) Restart dsh rồi hỏi agent: "chạy jev_overview" / "jev_verify" để xác nhận tool sống
```

## 6. Công cụ kèm theo

| File | Việc |
| --- | --- |
| `D:\dsh\scripts\dsh-peer-check.mjs` | Mô phỏng preflight của dsh **trước khi restart**: `--mode profile` (soi mọi row trong profile bằng chính `evaluatePluginCompatibility`) và `--mode deps` (soi dependency/peer của gói định cài, phát hiện bẫy ghim cứng). Exit 1 khi phát hiện nguy hiểm. |
| `D:\dsh\scripts\jev-safe-install.ps1` | Quy trình 5 bước có rào: preflight → snapshot (`D:\dsh\backup\pre-plugin-<ts>`) → cài → hậu kiểm → **tự rollback** (khôi phục file + xoá gói mới thêm + `pnpm install --force`) và xác nhận profile lành lại. `-CheckOnly` để chỉ kiểm tra. |
| `C:\Users\QuyenLD\.dsh-jev-test\run-experiment.ps1` | Dựng 2 clone `homeA`/`homeB` tái hiện lỗi + chứng minh cách sửa, rồi boot thật trên cổng ngẫu nhiên. Không đụng profile thật. |
| `D:\dsh\backup\dsh-backup-20260930-165128\restore.ps1` | Phục hồi cấu hình profile từ backup (có `-WhatIf`, verify SHA256). |

Bài học khi viết công cụ rollback (đã gặp thật, đã sửa): `pnpm install` có thể in **"Already up to date"**
và **không prune** gói đã bị hoist, dù `package.json`/`pnpm-lock.yaml` đã khôi phục đúng.
Rollback phải **xoá tường minh** các gói xuất hiện thêm (so với danh sách trước khi cài) và dùng
`pnpm install --no-frozen-lockfile --force`.

## 7. Nếu đã lỡ hỏng: 4 đường cứu (không đường nào cần dsh "chạy được")

1. **Guard tự rollback** — dùng `jev-safe-install.ps1`, hoặc chạy lại nó ở chế độ `-Force` rồi để nó tự khôi phục.
2. **Sửa tay, không cần dsh**: xoá `"dsh-jev-verify"` khỏi `dependencies` **và** khỏi `dsh.profile.bundles` trong
   `%DSH_HOME%\profiles\web\package.json`, rồi:
   ```powershell
   cd %DSH_HOME%\profiles\web; pnpm install --no-frozen-lockfile --force; npx @deepseek-ai/dsh web
   ```
3. **`dsh rescue --from-default-profile web`** (có trong `dsh --help`): tạo profile cứu hộ từ template rồi boot —
   hoạt động ngay cả khi profile `web` đang hỏng.
4. **Backup**: `D:\dsh\backup\dsh-backup-20260930-165128\restore.ps1` rồi `pnpm install --force`.

## 8. Dùng Jev đúng cách (theo skill `typesafe-ai`)

Plugin chỉ là phương tiện đưa Jev vào agent. Skill `typesafe-ai` (đã cài tại
`C:\Users\QuyenLD\.agents\skills\typesafe-ai`, khớp upstream `typesafe-ai/skills@main`) nhắc 3 điều áp dụng ngay cho dự án này:

- **Code giữ workflow, model trả phán đoán có kiểu.** Chọn primitive theo *ý nghĩa* câu trả lời:
  `Choice` (một trong tập xác định), `Noul` (đúng/sai theo xác suất), `Score` (mức độ trên thang có thứ tự).
  Đừng dùng Jev cho việc code làm được: tra cứu, tính toán, quy tắc cứng.
- **Hỏi ít câu, nhưng đủ state; gộp các câu độc lập trong cùng một request** (chúng chạy song song và
  không thấy câu trả lời của nhau). Ngưỡng/trọng số để trong code, hiệu chỉnh trên dữ liệu thật của bạn —
  đừng copy ngưỡng trong cookbook.
- **Ngưỡng tin cậy không phải quyền hành động; key phải ở server-side.** Với dsh: giữ
  `TYPESAFE_API_KEY` trong `refs` của `.credentials.yaml`, không commit vào `D:\dsh` (repo có remote GitHub).

Sau khi cài xong, smoke-test bằng `jev_overview`/`jev_verify` rồi mới thiết kế tiếp workflow.
Tài liệu sống (nguồn chân lý) bắt đầu từ `https://docs.typesafe.ai/llms.txt`.

## 9. Bảng dữ kiện then chốt

| Mục | Giá trị |
| --- | --- |
| dsh runtime | 0.2.0-rc.2 (npx checkout `…\_npx\1e7f6d9597241db0`) |
| `@deepseek-ai/dsh-tools` mà runtime cần | `^0.2.0-rc.1` → 0.2.0-rc.2 |
| Bản bị hoist gây lỗi | `@deepseek-ai/dsh-tools@0.1.5-rc.2` (peers `^0.1.5-rc.2`) |
| Row bị disable | `tools` (layer `@deepseek-ai/dsh-base`, patched by `@deepseek-ai/dsh-web-app`) |
| Plugin gây ra | `dsh-jev-verify` — mọi version 0.2.0…0.7.4 |
| Exemption | không có (`compatibility.json` vắng; `version-exemptions` = `{}`) |
| Cách sửa đã kiểm chứng | `overrides: '@deepseek-ai/dsh-tools': 0.2.0-rc.2` trong `profiles\web\pnpm-workspace.yaml` |
| Cứu hộ khi đã hỏng | bỏ plugin khỏi `package.json` + `pnpm install --force`, hoặc `dsh rescue --from-default-profile web` |
