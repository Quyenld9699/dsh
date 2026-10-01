# plugins — plugin DSH của máy này

**Không còn plugin tự dựng nào.** Hai bản tự chế trước đây đã gỡ:
- `dsh-skill-manager` (UI "Skill Manager" + host tĩnh ⚡) → thay bằng **Skill Center** có sẵn
  (`@linxin666/dsh-client-ui-skill-explorer` trong `dsh.profile.bundles`).
- `dsh-jev` (tool `jev_evaluate`) → thay bằng **plugin Jev chính thức trên market**: `dsh-jev-verify`
  (xem `..\skills\manifest.json`, source `dsh-jev-verify`).

## Jev đang dùng: `dsh-jev-verify` (market/npm)

> ⚠️ **BẪY ĐÃ GẶP THẬT (2026-09-30) — đọc trước khi cài:** mọi bản `dsh-jev-verify` (0.2.0 → 0.7.4)
> khai **dependency cứng** `@deepseek-ai/dsh-tools: 0.1.5-rc.2`. Với `nodeLinker: hoisted`, pnpm đặt bản cũ
> đó vào `profiles\web\node_modules\@deepseek-ai\dsh-tools`; dsh resolve **row `tools` từ profile trước**,
> nên nó disable row `tools` → `agent-loop` không có service `tools` → **`dsh: startup failed: 1 required
> plugin did not activate`**, và tắt/bật lại không hết (lỗi nằm ở cây dependency trên đĩa).
> Màn hình Plugin Market **không phát hiện** bẫy này (chỉ soi peer của chính plugin).
> Phân tích đầy đủ + cách cứu: `..\backup\JEV-RCA.md`.
>
> **Cách cài an toàn (đã kiểm chứng boot được):**
> ```powershell
> D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools
> ```
> (guard tự preflight → snapshot → cài → hậu kiểm bằng preflight của dsh → tự rollback nếu profile sẽ hỏng.
> `-PinRuntimeTools` ghim `@deepseek-ai/dsh-tools` về đúng bản runtime qua pnpm `overrides`.)

- Cài bằng đường CLI chính thức của market: `dsh plugin --profile web add dsh-jev-verify`
  (hoặc GUI: Settings → **Plugin Market** → tìm `jev` → Install).
  **Chỉ dùng khi đã ghim `@deepseek-ai/dsh-tools` trong `profiles\web\pnpm-workspace.yaml`, hoặc dùng guard ở trên.**
- Tool cấp cho agent: `jev_decision` (choice/score/noul song song ≤25 câu), `jev_verify` (benchmark 27 câu),
  `jev_guard_status`, `jev_overview`.
- Key: `TYPESAFE_API_KEY` qua DSH credentials seam (`refs` trong `<DSH_HOME>\.credentials.yaml`) hoặc
  nhập trong **Settings → Plugins → Plugin configuration → Jev**.
- Profile web có `patchReload: live` → plugin mới xuất hiện **không cần restart** (đã kiểm chứng khi cài `dsh-jev-verify`).
  Nhưng nó chỉ "hiện" khi bước hậu kiểm sạch — nếu không, lần restart sau sẽ hỏng.
- Gỡ/rollback: `dsh plugin --profile web remove dsh-jev-verify` rồi `pnpm install --no-frozen-lockfile --force`
  trong `profiles\web` (pnpm có thể in "Already up to date" và **không** prune bản `dsh-tools` cũ —
  `--force` mới dọn). Hoặc để guard tự rollback.
- ⚠️ Market **chặn cài khi có agent đang chạy** (HTTP 409) — cài từ GUI lúc agent rảnh, hoặc dùng `dsh plugin` CLI.

**Các plugin Jev khác trên market** (chỉ chọn nếu cần, tránh trùng): `dsh-jev-tools` (prune tool output,
chống prompt-injection, gợi ý skill), `dsh-jev-guard` **hoặc** `dsh-jev-interceptor` (van an toàn trước khi
chạy lệnh — hai cái này cùng hook `tools/pre-execute`, đừng cài cả hai), `dsh-jev-decide`, `jevcore-dsh`,
`@khorsheed/dsh-typesafe`, `dsh-jev-adapter` (chạy paradigm Jev bằng LLM, không cần key TypeSafe).
Đã soi dependency: `dsh-jev-tools@0.1.12`, `dsh-jev-interceptor@0.2.4`, `dsh-jev-decide@0.1.2` không có
dependency cứng vào `@deepseek-ai/dsh-*` (an toàn); `jevcore-dsh@0.4.1` khai `dsh-tools <0.2.0` nên bị
preflight của dsh chặn ngay lúc cài (fail an toàn).

## Khi thêm plugin mới (quy ước)

- **Ưu tiên market**: kiểm tra catalog trước (`https://awesome-dsh-plugin.com/plugins.json`) rồi cài bằng
  `dsh plugin --profile web add <pkg>` — không tự viết lại thứ đã có.
- Nếu buộc phải tự viết: source ở `plugins\<tên>\` kèm README; plugin bundle cần
  `package.json` (`main`, `dsh.bundle.patch`) + `cordis.patch.yml` chứa `- insert: - id: <id> / name: '<pkg>'`;
  sau đó thêm package vào `dependencies` **và** `dsh.profile.bundles` của `profiles\web\package.json`.
- Plugin profile-local **import được `@deepseek-ai/*`** (đã kiểm chứng: `@deepseek-ai/dsh-tools` resolve tốt
  trong `profiles\web`; `dsh-better-sidebar` cũng import `defineTool`).
  ⚠️ Mặt trái của chính điều này: bundle thì dsh resolve **installation-first**, nhưng **row thì profile-first** —
  nên nếu plugin kéo một `@deepseek-ai/dsh-*` **khác phiên bản runtime** (kiểu `dependencies` ghim cứng
  `@deepseek-ai/dsh-tools@0.1.5-rc.2`) vào `profiles\web\node_modules`, bản đó sẽ **shadow** row tương ứng và
  dsh từ chối nạp row → startup fail. Xem `..\backup\JEV-RCA.md` mục 1.5 và dùng
  `D:\dsh\scripts\dsh-peer-check.mjs` (hoặc `jev-safe-install.ps1 -CheckOnly`) để soi trước khi restart.

## Ghi chú hộp cát (quan trọng khi viết plugin)

Tiến trình plugin trong profile web **chỉ ghi được file ở ROOT của workspace** (vd `D:\dsh\<file>`):
- ✅ ghi/xoá file ở root workspace
- ❌ tạo/ghi đè file trong thư mục con (`D:\dsh\.agents\...`, `D:\dsh\skills\...`)
- ❌ ghi vào user home (`C:\Users\<user>\.agents\...`)

⇒ Plugin **không nên** tự nhận trách nhiệm ghi file ra ngoài root workspace; việc đó giao cho **agent**
(quyền đầy đủ theo file policy) hoặc script có quyền. **Đọc** file thì không bị giới hạn.
