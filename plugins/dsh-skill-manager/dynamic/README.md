# Skill Manager — bộ nguồn dự phòng (recreate recipe)

Plugin **Skill Manager** (quản lý skill DSH: liệt kê / ⚡ tự kích hoạt / Bật-Tắt / Xoá / Mở thư mục / cài từ GitHub)
là một **dynamic Cordis Plugin** — nó chỉ chạy trong session đã tạo và **biến mất khi khởi động lại harness**.
File marker & skill đã ghi lên đĩa thì bền.

Muốn dựng lại sau khi restart: mở 1 hội thoại mới và nhắn:

> "Dựng lại plugin Skill Manager từ thư mục `.dsh-plugin-sources/skill-manager` (đọc README rồi cordis_define + run)."

Agent sẽ thực hiện:

1. `cordis_define` — `kind: new`, `idPrefix: skli`, name "Skill Manager (restored)".
   - `code.host`   = nội dung file `host.js`  (viết dạng function body trả về plugin)
   - `code.client` = nội dung file `client.js`
2. `cordis_run` với `pluginId`/`packageId` trả về.
3. Vào **Settings → Skill Manager** để dùng. Marker "tự kích hoạt" ở `.agents/skill-autoload.json` tự được áp dụng lại lúc apply.

## Lưu ý

- Lần chạy đầu của plugin mới thường cần duyệt trên UI → để policy approval ở **ask**, không nên để **never**.
- Vì plugin chỉ ghi được trong workspace (hộp cát), các thao tác ghi thư mục user `~/.agents` nên **nhờ agent** (file policy danger-full-access) — agent đọc `host.js`/`client.js` tương tự.
- `client.js` được viết theo API của **dynamic runner** (`React`/`host.call`/`slots`), KHÔNG tương thích trực tiếp với plugin tĩnh dạng market (`__ModuleLoader__` + require của web). Muốn thành plugin market tĩnh phải viết lại client theo dạng bundle CJS của web profile — xem `PACKAGING-NOTES.md` nếu có.
