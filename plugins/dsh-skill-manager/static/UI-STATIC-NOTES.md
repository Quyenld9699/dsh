# Kế hoạch: UI "Skill Manager" thành static plugin tự load như dshmarket

## Mục tiêu
Sau khi `npx @deepseek-ai/dsh web`, trang Settings → "Skill Manager" tự xuất hiện (không cần dựng plugin động).

## Đã xác minh (từ chính dshmarket & dsh-dracula-theme)

1. Plugin market = npm package trong `<DSH_HOME>/profiles/web/node_modules/<name>`:
   - `package.json` khai `dsh.client` (vd `{ inject: [...], platform: 'web' }`) + `exports["./client"]`.
   - Client là **bundle CJS**: `window.__ModuleLoader__.load({ id: "<package-name>", factory: (require) => {...} })`.
     id PHẢI trùng package name; require() lấy từ module table của web (react, @deepseek-ai/dsh-client-*...).
   - Host là module ESM `export function apply(ctx)` (đã có: `lib/index.js`).
2. **Client tĩnh KHÔNG dùng** `host.call`/`harness.handle` (chỉ dynamic runner có). Thay vào đó:
   - **dshmarket gọi host bằng HTTP JSON**: `fetch(api("/dsh-market/..."))` với route do host đăng ký.
   - → cần host phơi JSON endpoint (xem `webServer` service: `ctx.webServer.register(route)`), client gọi
     `fetch('/<path>')` và đọc JSON.
3. Đăng ký UI: settings.section (hoặc cơ chế settings của ui-settings) — cần xác định chính xác module/API
   (khảo sát `dshmarket/client/client.js` + `@deepseek-ai/dsh-client-ui-settings`).

## Các việc cần làm (theo thứ tự, mỗi bước test qua restart)

- [ ] Host: thêm JSON API cho: list / toggle / delete / open / autotoggle / discover / install / probe
      (port code từ `dynamic/host.js`, bỏ harness.handle → `webServer` routes, giữ fs/ps helpers).
- [ ] package.json: thêm `dsh.client` + `exports["./client"]` trỏ file bundle.
- [ ] Viết `client.js` (bundle CJS kiểu market): require react, đăng ký settings.section,
      mọi thao tác qua `fetch('/...')` tới host API. Tái sử dụng logic/giao diện từ `dynamic/client.js`.
- [ ] Xoá 2 file probe rác nếu có (`*.skillmgr-write-probe.txt`).
- [ ] Restart harness → mở Settings → kiểm tra; rollback nếu hỏng:
      xoá `profiles/web/node_modules/dsh-skill-manager` + dòng `insert: skillmgr-static` trong `cordis.patch.yml`.

## Lưu ý
- Đừng sửa file này cẩu thả trong lúc GUI đang chạy mà không test restart: host/client lỗi có thể làm row không nạp.
- Muốn dựng lại UI tạm (plugin động) giữa chừng: nhắn agent "Dựng lại plugin Skill Manager từ D:\dsh\plugins\dsh-skill-manager\dynamic".
