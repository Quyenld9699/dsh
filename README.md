# DSH Custom Vault — kho skill / theme cho DeepSeek Harness

> Repo trung tâm: đổi máy / cài lại DSH từ đầu → pull repo này về, chạy 1 lệnh kích hoạt, làm vài bước thủ công nhỏ là xong.

```
D:\dsh\
├── plugins\            # Không còn plugin tự dựng (Jev dùng plugin market `dsh-jev-verify`) — xem plugins\README.md
├── themes\             # Theme tự dựng (trống, chờ bổ sung)
├── skills\             # Backup skill GLOBAL = MANIFEST (skills\manifest.json: tên+nguồn+cách cài),
│                       #   KHÔNG chứa bản sao skill; restore = nhờ agent cài lại theo manifest
│                       #   (skill chỉ dùng 1 workspace KHÔNG nằm ở đây, giữ ở <workspace>\.agents\skills)
├── scripts\
│   └── activate.ps1    # ★ SCRIPT KÍCH HOẠT — chạy trên máy mới
└── README.md           # Bạn đang đọc file này (playbook)
```

**Quản lý skill giờ dùng Skill Center có sẵn của DSH** (`@linxin666/dsh-client-ui-skill-explorer`,
khai báo trong `%DSH_HOME%\profiles\web\package.json` → `dsh.profile.bundles`) — không cần plugin tự dựng nữa.
Plugin `dsh-skill-manager` trước đây **đã được gỡ bỏ** (source + bản cài trong profile + loader row).

**Jev (TypeSafe AI System One)** dùng plugin market **`dsh-jev-verify`** (cài bằng
`dsh plugin --profile web add dsh-jev-verify`, hoặc GUI Plugin Market) — bản tự chế `dsh-jev` đã gỡ.

---

## ★ CÁCH KÍCH HOẠT LẠI TOÀN BỘ (máy mới / cài lại)

### Bước 0 — Chuẩn bị
- Cài sẵn: Git, Node.js (có pnpm), PowerShell 5.1+.
- Đã chạy được DSH web ít nhất 1 lần (để `$env:USERPROFILE\.dsh` đã tồn tại).

### Bước 1 — Pull repo
```bash
git clone <REPO_URL> D:\dsh
```
(hoặc copy thư mục sang máy mới).

### Bước 2 — Chạy script kích hoạt
```powershell
powershell -ExecutionPolicy Bypass -File D:\dsh\scripts\activate.ps1
```
Script tự làm:
1. Kiểm tra profile web + Skill Center (`dsh-client-ui-skill-explorer`) đã có trong profile chưa.
2. Cài plugin `dsh-jev` (tool `jev_evaluate`) vào `node_modules` + thêm loader row `jev` vào `cordis.patch.yml`.
3. In hướng dẫn restore skill global từ `skills\manifest.json`.

### Bước 3 — Làm tay
1. **Khởi động DSH web** (nếu chưa).
2. **Restore skill global**: mở 1 hội thoại và nhắn agent:
   > "Đọc `D:\dsh\skills\manifest.json` và cài lại các skill global theo hướng dẫn install của từng source."
3. **Kiểm tra** danh mục skill bằng **Skill Center** (Settings) — gồm skill global + skill của từng workspace
   (workspace skills nằm trong `<workspace>\.agents\skills`, không nằm trong repo này).

---

## 🧠 Jev (TypeSafe AI System One) — phán đoán có kiểu cho agent

- **Tool gốc `jev_evaluate`** (plugin `plugins\dsh-jev`): gửi `state` + `questions` (`choice` / `score` / `noul`)
  → nhận answers có kiểu kèm xác suất/confidence. Profile có `patchReload: live` → nạp ngay, không cần restart.
- **CLI**: `node D:\dsh\tools\jev\jev.mjs --check` (kiểm tra key + độ trễ), `--request-file <json>` (chạy 1 request),
  ví dụ mẫu: `tools\jev\example-request.json`.
- **Skill**: `~/.agents/skills/jev/SKILL.md` (nguồn trong repo: `tools\jev\SKILL.md`) + skill chính thức `typesafe-ai`.
- **Key**: env `TYPESAFE_API_KEY`, hoặc `<DSH_HOME>\credentials\typesafe.key`, hoặc `refs.TYPESAFE_API_KEY`
  trong `<DSH_HOME>\.credentials.yaml`. **Không commit key vào repo.**
- Cách dùng đúng: 1 câu hỏi = 1 phán đoán hẹp; gộp nhiều câu vào **1 request** (chạy song song trên cùng state);
  ngưỡng/trọng số đặt trong **code**, Jev chỉ trả phán đoán. Chi phí ~$0.042/1M input token, output miễn phí.

## Ghi chú vận hành

- **Skill Center** là plugin market có sẵn trong profile, **không thuộc vault này**; nâng cấp/gỡ bằng
  `dshmarket` hoặc sửa `%DSH_HOME%\profiles\web\package.json` rồi restart harness.
- **Hộp cát plugin web**: tiến trình plugin trong profile chỉ ghi được file ở **root workspace**
  (vd `D:\dsh\<file>`), **không** ghi được vào thư mục con (`.agents`, `skills`) hay `~\.agents`.
  Thao tác cần ghi ra ngoài vùng đó → **nhờ agent** (agent có quyền full theo file policy).
- **Market/theme**: `themes\` để trống chờ bổ sung; theme tự dựng đặt ở `themes\<tên>` kèm hướng dẫn.
- **Phân biệt phạm vi skill**: `skills\manifest.json` = backup danh sách skill GLOBAL;
  `<workspace>\.agents\skills\` = skill chỉ dùng workspace đó.
  Chỉ thêm vào `skills\manifest.json` khi bạn chủ động yêu cầu "lưu skill global".
- Nếu bạn để skill nhạy cảm (số liệu nội bộ…) trong repo này → **đặt repo GitHub ở chế độ Private**.

## Thêm thứ mới vào kho
Mỗi plugin/theme: đặt vào đúng thư mục con kèm `README` nhỏ mô tả chức năng + cách kích hoạt.
Skill global: chỉ cập nhật `skills\manifest.json` (không copy nội dung skill vào repo).
