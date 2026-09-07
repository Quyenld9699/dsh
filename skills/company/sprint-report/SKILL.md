---
name: sprint-report
description: Tạo báo cáo sprint cho 1 dự án (VD: GSX) của Product Delivery — đọc dữ liệu trực tiếp từ Notion qua trình duyệt tích hợp VS Code, tính toán KPI dự án, đối chiếu estimate vs time logs thực tế, và đưa ra đánh giá. Dùng khi người dùng yêu cầu "tổng kết sprint", "báo cáo sprint", "đánh giá KPI dự án", "so sánh estimate vs logs", hoặc phân tích thời gian làm việc.
---

# Sprint Report — Báo Cáo Sprint Dự Án

## When to Use

Use this skill when the user asks to:

- Tổng kết / báo cáo 1 sprint cụ thể của dự án
- Đánh giá KPI dự án theo chỉ tiêu
- So sánh estimate vs time logs thực tế (phát hiện OT / cháy giờ / estimate sai)
- Phân tích năng suất từng thành viên
- Theo dõi tiến độ dự án theo thời gian

**Bối cảnh:** QuyenLD (PGĐ) quản lý dự án trên **Notion** workspace A-Star Group (user là **guest**). Xem cấu trúc database tại wiki: `wiki/Notion_Quan_Ly_Du_An.md`. KPI chỉ tiêu tại `wiki/He_Thong_KPI.md`.

## ⚠️ RULE BẮT BUỘC: Đọc Notion bằng TRÌNH DUYỆT TÍCH HỢP VS Code — KHÔNG dùng MCP

- **Lý do:** MCP Notion không expose đủ tools đọc; user là guest nên không cấu hình được quyền integration.
- MCP chỉ dùng được `get-users` / `get-teams` (xác nhận danh tính).
- Tất cả dữ liệu page/database đọc qua **browser tools** (Playwright) như dưới đây.

## Step 1 — Truy cập Notion (trình duyệt tích hợp)

1. Mở `https://www.notion.so` trong trình duyệt tích hợp VS Code.
2. Nếu chưa đăng nhập: **yêu cầu user tự đăng nhập** (KHÔNG nhận mật khẩu/token qua chat).
3. User sẽ thấy workspace A-Star Group → điều hướng tới page dự án (VD: GSX) hoặc database cần xem.
4. Có thể dùng `page.evaluate(() => document.body.innerText)` để đọc nhanh nội dung text.

## Step 2 — Đọc database Sprints (tổng quan sprint + tổng kết)

- Vào view **GSX | Sprints** (sidebar page GSX, link dạng `/370930c1ef03825e...?v=...&pvs=25`).
- Dùng Playwright đọc bảng: tìm index của `"Sprint name"` trong `main.innerText` rồi slice.
- Bảng virtualized → **cuộn qua toàn bộ** (`container.scrollTop += step` + `setTimeout`) để tải đủ dòng.
- Ghi lại cho sprint cần báo cáo: `Total tasks`, `Process Task (%)`, `Total Bugs Fix`, `Process Fix (%)`, `Total Time Estimate (h)`, `People join`, `Total Task Estimate`, `Desc`.

> ⚠️ **Quan trọng:** Tracking Notion GSX chỉ bắt đầu từ **Sprint 6**. Sprint < 6 là backfill thủ công, KHÔNG dùng để đánh giá KPI.

## Step 3 — Đọc Tasks (estimate vs actual)

- Vào view **GSX | Tasks** (link dạng `/6f4930c1ef0383e...?v=...&pvs=25`).
- Bảng có các cột: `ID | Task name | Description | Status | chuyên môn | Assign | Estimate (h) | Total Time Logs | Due | Tags | Feature | Sprint | Is Current Sprint`.
- **Estimate (h)** = giờ PM chốt với thành viên khi giao việc.
- **Total Time Logs** = giờ thực tế đã log.
- So sánh từng task: `Chênh lệch = Actual - Estimate`.
- Lưu ý task **meeting** (Tag `meet`, VD: T319 "Meeting") — **nhiều người cùng log 1 task**, giờ là capacity tổng của team.

## Step 4 — Đọc Task time logs (giờ thực tế theo người)

- Vào view **GSX | Task time logs** (link dạng `/313930c1ef03835d...?v=...&pvs=25`).
- Bảng cột: `Check Valid | Tasks | Bugs Report | Person | Date | Hour (h) | Description`.
- **Cuộn qua toàn bộ bảng** để tải đủ dòng (quan trọng — virtualized).
- Tổng hợp theo Person × Date → tính tổng giờ/người/ngày.
- Mỗi hàng = 1 người log 1 task HOẶC 1 bug trong 1 ngày.

## Step 5 — Đọc Bugs Report (tùy chọn, khi cần phân loại bug)

- Vào view **GSX | Bugs Report** (link dạng `/0d6930c1ef03826f...?v=...&pvs=25`).
- Xem phân bố bug theo severity/status nếu cần đánh giá chất lượng.
- **⚠️ Rule "bug thật":** Bug mở **không có description → KHÔNG tính là bug** (dòng rác/placeholder). Chỉ tính bug có mô tả lỗi rõ ràng.

## Step 6 — Tính toán KPI dự án

Chỉ tiêu (từ `wiki/He_Thong_KPI.md`) — áp dụng cho dự án/PM/Business Solution:

| KPI                        | Không Đạt | Đạt (Chuẩn) | Vượt  |
| -------------------------- | --------- | ----------- | ----- |
| On-time Delivery           | < 70%     | 80-85%      | > 90% |
| Sprint Completion          | < 70%     | 80-85%      | > 90% |
| Project Health Score       | < 79      | > 79/100    | —     |
| Gross Margin               | < 25%     | 29-35%      | > 35% |
| Critical Defects (go-live) | —         | < 1-2/tháng | 0     |

**Công thức từ dữ liệu có:**

- `Sprint Completion = Process Task` (lấy từ Sprints DB)
- `Task completion % = Tasks done / Total tasks`
- Bugs fix rate = `Process Fix`
- Ghi rõ KPI nào **thiếu dữ liệu** (không suy đoán).

## Step 7 — Đối chiếu Estimate vs Actual (phát hiện OT / bất thường)

1. **Task cháy giờ:** `Actual > Estimate` → ghi mức cháy `(Actual-Est)/Est` (%).
2. **Task log ít hơn estimate** (Actual < Est) → có thể estimate cao hoặc log thiếu.
3. **Task Done nhưng Actual = 0** → đáng ngờ về chất lượng log.
4. **Tổng theo người:** so với chuẩn 40h/tuần (5 ngày × 8h).
5. **Quy tắc OT (từ wiki):**
    - Estimate của 1 người/tuần **> 40h** ⇒ tuần đó phải OT → PM lên kế hoạch OT + chốt lý do.
    - Giai đoạn **vừa phát triển vừa fix bug**: estimate có thể **< 40h** (chừa buffer bug hằng ngày).
6. **Dấu hiệu đáng ngờ:**
    - Lead ôm quá nhiều giờ code (lead bottleneck)
    - 1 task bị nhiều người log (meeting) làm tổng giờ đội lên
    - Ngày làm > 10h, hoặc log 0/0.25h manh mún

## Step 8 — Xuất báo cáo (định dạng chuẩn)

Trình bày theo cấu trúc:

1. **Tiêu đề:** Báo cáo Sprint X — [Dự án] (ngày)
2. **Bảng tổng quan sprint:** tasks, %, bugs fix, estimate tổng, người tham gia
3. **Bảng KPI đối chiếu:** chỉ tiêu vs thực tế vs 🟢/🟡/🔴/🔲
4. **Bảng Estimate vs Actual từng task:** chỉ highlight task chênh lệch đáng chú ý
5. **Tổng hợp theo người:** tổng giờ, phát hiện OT
6. **🚩 Điểm đáng ngờ** (nếu có)
7. **Kết luận + khuyến nghị**

Đánh giá bằng biểu tượng: 🟢 Vượt / 🟡 Đạt / 🔴 Không Đạt / 🔲 Thiếu dữ liệu.

## Step 9 — Lưu kết quả (theo quy ước wiki)

- **Bắt buộc log** vào `wiki/projects/[Tên_Project]/Sprint_X.md` (tạo folder/file nếu chưa có) theo định dạng:
    ```
    ## [YYYY-MM-DD HH:MM] Loại: Báo cáo / Cập nhật
    - Nội dung tổng kết: tasks, %, bugs, estimate vs actual, rủi ro
    ```
- Cập nhật `wiki/index.md` (nếu tạo folder/project mới) + thêm dòng `wiki/log.md` (`CREATE`/`UPDATE`).
- Ghi rõ thời điểm kiểm chứng dữ liệu (ngày đọc từ Notion).

## Notes

- Dữ liệu Notion là **live** — mỗi lần đọc là snapshot tại thời điểm đó, ghi chú ngày.
- Không ghi vào `raw/` khi chưa được phép; đề xuất user nếu cần lưu nguồn.
- Liên hệ: wiki `Notion_Quan_Ly_Du_An.md`, `He_Thong_KPI.md`, `Danh_Muc_Du_An.md`.
