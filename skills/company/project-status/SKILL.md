---
name: project-status
description: Báo cáo tình hình HIỆN TẠI của 1 dự án tại thời điểm hỏi (VD: "GSX hôm nay thế nào?") — đọc dữ liệu live từ Notion qua trình duyệt tích hợp VS Code, tổng hợp tasks đang chạy, tiến độ, rủi ro, bugs, log giờ hôm nay, và đưa ra đánh giá. Dùng khi user hỏi trạng thái dự án, tiến độ hiện tại, ai đang làm gì, có rủi ro gì không, hoặc muốn check nhanh hằng ngày.
---

# Project Status — Báo Cáo Tình Hình Dự Án (Tức Thời)

## When to Use

Dùng khi user hỏi **trạng thái HIỆN TẠI** của dự án (không phải tổng kết sprint):

- "Dự án GSX hôm nay thế nào?"
- "Tiến độ dự án đang ra sao / có rủi ro gì không?"
- "Ai đang làm task gì? Task nào chưa bắt đầu?"
- "Hôm nay mọi người log giờ chưa / có OT không?"
- Check nhanh hằng ngày / theo dõi liên tục

> Nếu user muốn **tổng kết 1 sprint đã xong** → dùng skill `sprint-report`.

## ⚠️ RULE BẮT BUỘC: Đọc Notion bằng TRÌNH DUYỆT TÍCH HỢP VS Code — KHÔNG dùng MCP

- User là **guest** workspace A-Star Group, MCP không đọc được page.
- Mở `https://www.notion.so` trong trình duyệt tích hợp; nếu chưa đăng nhập thì **yêu cầu user tự đăng nhập**.
- Đọc nội dung bằng Playwright `page.evaluate(() => document.body.innerText)`, **cuộn bảng virtualized** để tải đủ dòng.
- Cấu trúc database xem tại `wiki/Notion_Quan_Ly_Du_An.md`.

## Quy trình lấy dữ liệu (tại thời điểm hỏi)

### Bước 1 — Xác định Sprint hiện tại (DB Sprints)

- Đọc view `GSX | Sprints`, lọc `Is Current Sprint = true`.
- Ghi lại: tên sprint, Dates (bắt đầu → kết thúc), **Process Task (%)**, **Process Fix (%)**, Total Time Estimate, People join.

### Bước 2 — Đọc Tasks theo 3 nhóm trạng thái (DB Tasks)

Đọc view `GSX | Tasks` (cột: `ID | Task name | Status | Assign | Estimate (h) | Total Time Logs | Due | Tags`). Tách:

- **In Progress**: task đang chạy → ai làm, estimate còn bao nhiêu, đã log bao nhiêu, Due khi nào.
- **Not Started**: task chưa bắt đầu → rủi ro nếu Due sắp tới.
- **Done (gần đây)**: task vừa đóng để thấy nhịp độ.

### Bước 3 — Đọc Bugs đang mở (DB Bugs Report)

- Lọc bug chưa fix / chưa đóng.
- Phân theo severity (Critical/Major/Minor) nếu có, ai đang fix, bug mới phát sinh hôm nay.
- **⚠️ Rule "bug thật":** Bug mở nhưng **không có description → KHÔNG tính là bug** (có thể là placeholder/dòng rác chưa điền). Chỉ tính bug có mô tả nội dung lỗi rõ ràng.

### Bước 4 — Đọc Task time logs hôm nay/tuần (DB Task time logs)

- Lọc theo ngày hiện tại (hoặc từ đầu sprint).
- Tổng hợp **giờ đã log theo người**; so với chuẩn 8h/ngày, 40h/tuần.
- Xác định: ai chưa log, ai log > 8h (OT), ai log ít hơn hẳn.

## Các thông số báo cáo (định dạng chuẩn)

Xuất báo cáo gồm các mục sau:

### 1. 🏷️ Tổng quan

- Sprint hiện tại + ngày bắt đầu/kết thúc + **còn X ngày** (hoặc "hết hạn hôm nay")
- % Tasks done, % Bugs fix

### 2. 🌡️ Nhiệt độ tiến độ (Health Check) — QUAN TRỌNG

So sánh tiến độ thực tế với **mức kỳ vọng theo thời gian trôi qua**:

- `% thời gian trôi qua = (hôm nay − ngày bắt đầu) / (ngày kết thúc − ngày bắt đầu)`
- **Nếu `% tasks done < % thời gian trôi`** → 🔴 **chậm tiến độ** (rủi ro trễ hạn)
- **Nếu `% tasks done ≥ % thời gian trôi`** → 🟢 đúng/vượt nhịp
- Ghi rõ con số: "Đã trôi qua 60% thời gian, mới hoàn thành 40% tasks → chậm"

### 3. 🔄 Tasks đang chạy (In Progress)

| Task | Assign | Estimate | Đã log | Còn lại ước tính | Due | Nhận xét |

### 4. ⏳ Tasks chưa bắt đầu (Not Started)

- Đặc biệt chú ý task **Due sắp tới** mà chưa bắt đầu → 🔴 rủi ro cao.

### 5. 🚩 Rủi ro

Tổng hợp các dấu hiệu:

- Task Due sắp tới chưa done / chưa bắt đầu
- Task In Progress **lâu ngày chưa đóng** (trễ)
- Task **log ít hơn hẳn estimate** (có thể kẹt)
- Chậm nhịp theo mục 2
- Bug critical đang mở
- Người phụ trách vắng / chưa log hôm nay

### 6. 🐞 Bugs (đang mở)

- Số bug mở (chỉ tính bug có description), critical, ai fix, bug mới hôm nay.

### 7. ⏱️ Log giờ hôm nay / sprint

- Bảng: người | giờ đã log | so 8h/ngày | OT?
- Ai chưa log hôm nay.

### 8. 🟢🟡🔴 Đánh giá tổng

- **🟢 Ổn định**: đúng nhịp, ít rủi ro
- **🟡 Cần chú ý**: chậm nhẹ / vài rủi ro nhỏ
- **🔴 Rủi ro cao**: chậm nhiều / task trễ / bug critical / thiếu nhân lực
- Kèm **khuyến nghị** ngắn (VD: "nên chuyển task X cho người khác", "cần OT cho task Y")

## Ghi chú

- Dữ liệu là **live tại thời điểm đọc** — ghi rõ ngày giờ trong báo cáo.
- Báo cáo ngắn gọn, ưu tiên bảng, không văn xuôi dài.
- Không phán xét cá nhân, chỉ nêu dữ liệu + rủi ro khách quan.
- Nếu cần chi tiết hơn 1 sprint → chuyển sang skill `sprint-report`.
- Liên hệ wiki: `Notion_Quan_Ly_Du_An.md`, `He_Thong_KPI.md`, `Danh_Muc_Du_An.md`.

## Lưu kết quả (bắt buộc)

Sau khi báo cáo xong, **bắt buộc log** vào `wiki/projects/[Tên_Project]/Sprint_X.md` (tạo file/folder nếu chưa có) theo định dạng:

```
## [YYYY-MM-DD HH:MM] Loại: Báo cáo / Cập nhật
- Tóm tắt: tasks đang chạy, tiến độ, rủi ro, bugs, log giờ
```

- Mỗi lần báo cáo/hỏi là 1 mục log mới theo ngày giờ.
- Cập nhật `wiki/index.md` (nếu tạo folder/project mới) + thêm dòng `wiki/log.md`.
