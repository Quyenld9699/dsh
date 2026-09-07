# DSH Custom Vault — kho plugin / theme / skill tự dựng cho DeepSeek Harness

> Repo trung tâm: đổi máy / cài lại DSH từ đầu → pull repo này về, chạy 1 lệnh kích hoạt, làm vài bước thủ công nhỏ là xong.

```
D:\dsh\
├── plugins\            # Plugin tự dựng (dạng source)
│   └── dsh-skill-manager\
│       ├── dynamic\    #   UI "Skill Manager" (plugin động, dựng lại trong session)
│       └── static\     #   Host tĩnh: tự kích hoạt skill ⚡ mỗi khi boot harness
├── themes\             # Theme tự dựng (trống, chờ bổ sung)
├── skills\             # Skill GLOBAL (dùng mọi workspace) — CHỈ thêm khi bạn chỉ định
│                       #   (skill chỉ dùng 1 workspace KHÔNG nằm ở đây, giữ ở <workspace>\.agents\skills)
├── scripts\
│   └── activate.ps1    # ★ SCRIPT KÍCH HOẠT — chạy trên máy mới
└── README.md           # Bạn đang đọc file này (playbook)
```

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
1. Copy `plugins\dsh-skill-manager\static` → `<DSH_HOME>\profiles\web\node_modules\dsh-skill-manager`.
2. Thêm loader row `skillmgr-static` vào `<DSH_HOME>\profiles\web\cordis.patch.yml` (chỉ thêm nếu chưa có).
3. Copy mọi thư mục con trong `skills\` (skill global đã chọn) → `~\.agents\skills\`.
4. In danh sách việc cần làm tay còn lại.

### Bước 3 — Làm tay (script in ra)
1. **Khởi động lại harness** → plugin host tĩnh chạy: các skill đang đánh dấu ⚡ tự kích hoạt (đọc
   `<workspace>\.agents\skill-autoload.json`; file này theo từng máy — sau khi restore cần đánh dấu lại qua UI hoặc nhờ agent).
2. **UI "Skill Manager"** (trang Settings) là plugin động theo session → mở 1 hội thoại và nhắn:
   > "Dựng lại plugin Skill Manager từ D:\dsh\plugins\dsh-skill-manager\dynamic (đọc README, cordis_define + run)."
3. Kiểm tra danh mục skill ở hội thoại mới (các skill global + skill của từng workspace
   — workspace skills nằm trong `<workspace>\.agents\skills`, không nằm trong repo này).

---

## Ghi chú vận hành

- **Plugin động**: chết khi restart harness; dữ liệu trên đĩa thì bền. Để policy approval = **ask** lúc dựng lại (lần chạy đầu cần duyệt trên UI).
- **Plugin tĩnh**: tự chạy mỗi boot, không cần duyệt; rollback = xoá thư mục `node_modules\dsh-skill-manager` + dòng `insert: skillmgr-static` trong `cordis.patch.yml`, restart.
- **Hộp cát**: plugin chỉ ghi được trong workspace hiện tại; thao tác ghi `~\.agents` (user toàn máy) nên **nhờ agent** (file policy danger-full-access) hoặc chạy script với quyền phù hợp.
- **Market/theme**: themes/ để trống chờ bổ sung; nếu sau này có theme tự dựng thì đặt ở `themes/<tên>` kèm hướng dẫn.
- **Phân biệt phạm vi skill**: `skills\` = global (mọi workspace); `<workspace>\.agents\skills\` = chỉ workspace đó.
  Chỉ bỏ vào `skills\` khi bạn chủ động yêu cầu "lưu global".
- Nếu bạn để skill nhạy cảm (số liệu nội bộ…) trong repo này → **đặt repo GitHub ở chế độ Private**.

## Thêm thứ mới vào kho
Mỗi plugin/skill/theme: đặt vào đúng thư mục con kèm `README` nhỏ mô tả chức năng + cách kích hoạt, rồi commit.
