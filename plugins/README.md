# dsh-plugins — bộ plugin DSH tự quản lý

Repo chứa các plugin/skill tự viết cho DeepSeek Harness. Cấu trúc:

```
dsh-skill-manager/
├── dynamic/   # Nguồn plugin UI "Skill Manager" (dạng dynamic Cordis Plugin) + README tái tạo
└── static/    # Plugin host tĩnh (tự kích hoạt skill ⚡ mỗi khi boot harness) + package.json
```

## dsh-skill-manager

- **dynamic/** — dựng lại trang Settings → Skill Manager trong một session (plugin động, chết khi restart):
  mở hội thoại và nhắn: *"Dựng lại plugin Skill Manager từ dynamic/ (đọc README rồi cordis_define + run)"*.
- **static/** — tự kích hoạt các skill đã đánh dấu ⚡ (đọc `<workspace>/.agents/skill-autoload.json` và đăng ký
  systemPrompt sections) mỗi lần bật harness. Không có UI.

### Cài static trên máy (per-machine)

1. Copy thư mục `static` → `<DSH_HOME>/profiles/web/node_modules/dsh-skill-manager`
   (thường `C:\Users\<user>\.dsh\profiles\web\node_modules\dsh-skill-manager`).
2. Thêm loader row vào `<DSH_HOME>/profiles/web/cordis.patch.yml`:
   ```yaml
   - insert:
       - id: skillmgr-static
         name: 'dsh-skill-manager'
   ```
3. Khởi động lại harness.
   Rollback: xoá 2 mục trên rồi restart.

### Dữ liệu

- Marker "tự kích hoạt": `<workspace>/.agents/skill-autoload.json`
- Skill được quản lý nằm ở `.agents/skills` / `.dsh/skills` của workspace và `~/.agents/skills` / `~/.dsh/skills`.
