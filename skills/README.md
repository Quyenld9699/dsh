# skills — backup danh sách skill GLOBAL (manifest), KHÔNG chứa file skill

Thư mục này **không lưu bản sao nội dung skill**. Backup global = **`manifest.json`**:
tên skill + nguồn (repo/ref) + cách cài, để sau này (máy mới / cài lại) **nhờ agent cài lại theo hướng dẫn** trong manifest.

- Thêm skill global mới → chỉ **cập nhật `manifest.json`** (thêm source/skill), không copy thư mục skill vào đây.
- **Skill chỉ dùng cho 1 workspace thì KHÔNG nằm ở đây** — chúng ở `<workspace>\.agents\skills\`
  (vd `D:\PGĐ-Management\.agents\skills\...`) và chỉ áp dụng workspace đó.

## Restore (máy mới / cài lại)
Mở 1 hội thoại DSH và nhắn agent:
> "Đọc `D:\dsh\skills\manifest.json` và cài lại các skill global theo hướng dẫn install của từng source (clone repo đúng ref, copy các thư mục skill vào `~/.agents/skills`)."

Kiểm tra lại bằng danh mục skill trong hội thoại mới; các skill ngoài vault (design, ui-styling…) nguồn theo `~/.agents/.skill-lock.json`.

## Các bundle đang backup (chi tiết trong manifest.json)
| Bundle | Nguồn | Số skill |
|---|---|---|
| superpowers | https://github.com/obra/superpowers (HEAD `b36e082`) | 14 |
| obsidian-skills | https://github.com/kepano/obsidian-skills (HEAD `a1dc48e`) | 5 |
| OfficeCLI | https://github.com/iOfficeAI/OfficeCLI (HEAD `ffa8a0a`) | 11 |
| typesafe-ai | https://github.com/typesafe-ai/skills (HEAD `65a39f3`) | 1 |

**Jev (TypeSafe AI System One)** — dùng **plugin market** `dsh-jev-verify` (không phải skill):
- ⚠️ **BẪY ĐÃ GẶP THẬT (2026-09-30):** mọi bản `dsh-jev-verify` (0.2.0 → 0.7.4) khai dependency cứng
  `@deepseek-ai/dsh-tools: 0.1.5-rc.2`. Với `nodeLinker: hoisted`, pnpm đặt bản cũ vào
  `profiles\web\node_modules\@deepseek-ai\dsh-tools`; dsh resolve row `tools` **từ profile trước** nên
  disable row đó → `agent-loop` thiếu service `tools` → **`dsh: startup failed: 1 required plugin did not
  activate`**, và tắt/bật lại không hết. Phân tích gốc rễ + thực nghiệm: `..\backup\JEV-RCA.md`.
- Cài an toàn (**đã kiểm chứng boot được**): `D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools`
  (guard tự preflight → snapshot → cài → hậu kiểm bằng preflight của dsh → tự rollback; `-PinRuntimeTools`
  ghim `@deepseek-ai/dsh-tools` về đúng bản runtime qua pnpm `overrides`).
- **Đừng** chạy `dsh plugin --profile web add dsh-jev-verify` (hoặc nút Install của market) khi chưa ghim —
  màn hình market không phát hiện được bẫy này.
- Tool cho agent: `jev_decision` (choice/score/noul song song), `jev_verify` (benchmark 27 câu),
  `jev_guard_status`, `jev_overview`.
- 🔑 Key `TYPESAFE_API_KEY`: thêm vào `refs` của `<DSH_HOME>\.credentials.yaml`, hoặc nhập trong
  **Settings → Plugins → Plugin configuration → Jev**. **Không commit key.**
- Skill `typesafe-ai` (chính thức) ở trên dạy cách thiết kế workflow Jev; skill `jev` tự chế đã bị gỡ.
  (Đã đối chiếu 2026-09-30: bản trong `~\.agents\skills\typesafe-ai` khớp `typesafe-ai/skills@main`
  HEAD `65a39f3` — chỉ khác CRLF/LF.)
- 🔌 **Cách nối JEV vào dsh** (skill ≠ key ≠ tool) — chi tiết ở `..\backup\JEV-DSH-SETUP.md`:
  skill chỉ cho agent ngữ cảnh để *viết code gọi đúng API*; muốn gọi được API phải có `TYPESAFE_API_KEY`
  (hiện **chưa có** ở cả 3 nơi) trong `refs` của `<DSH_HOME>\.credentials.yaml`, rồi chọn 1 trong 3 đường:
  **(A)** plugin `dsh-jev-verify` → tool native `jev_decision/jev_verify/jev_overview` (cài bằng
  `..\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools`); **(B)** script HTTP `..\scripts\jev.ps1`
  (không cần plugin, agent gọi qua shell); **(C)** SDK JS `@typesafe-ai/sdk` trong code dự án (máy có Node 24;
  **không** có Python nên SDK Python không dùng được). Kiểm tra key: `D:\dsh\scripts\jev.ps1 -Check`.

**OfficeCLI** khác 2 bundle trên: nó cần **binary native** ngoài skill (không chỉ file SKILL.md).
- Cài binary (Windows): chạy `install.ps1` của repo (mirror `d.officecli.ai` trước, GitHub fallback)
  → `%LOCALAPPDATA%\OfficeCLI\officecli.exe` + thêm vào PATH user. Đã cài: **v1.0.152**.
- **PATH mới chỉ có hiệu lực ở tiến trình mới** → phải **restart DSH** thì lệnh `officecli` mới chạy được;
  trước đó agent dùng đường dẫn đầy đủ `C:\Users\QuyenLD\AppData\Local\OfficeCLI\officecli.exe`.
- 11 skill (`officecli` + 10 scene layer: docx/xlsx/pptx, academic-paper, financial-model,
  data-dashboard, pitch-deck, word-form, morph-ppt, morph-ppt-3d) nằm trong `~/.agents/skills`.
- ⚠️ Tránh `officecli watch` (mở server preview cổng 26315) trừ khi người dùng yêu cầu; mỗi lệnh có thể
  tự bật "resident" nền → dùng `OFFICECLI_NO_AUTO_RESIDENT=1` khi chỉ cần chạy 1 lần.

Quy ước chung: mọi thay đổi trong repo git này để **uncommitted**, người dùng tự commit.
