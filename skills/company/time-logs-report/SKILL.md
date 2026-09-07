---
name: time-logs-report
description: Báo cáo tổng giờ log / tỉ lệ nhân sự tham gia dự án theo tháng — CHỈ dùng tab Chart (Chart 1 month / Time logs 1 month) của từng DB Task time logs để filter và lấy dữ liệu (mượn Notion tính toán), tổng hợp giờ theo người × dự án. Dùng khi kế toán/quản lý cần "tỉ lệ nhân sự tham gia các dự án", "tổng giờ log theo tháng", "total time logs theo nhân sự", hoặc đối chiếu giờ làm việc giữa các dự án.
---

# Time Logs Report — Báo Cáo Tổng Giờ Log & Tỉ Lệ Nhân Sự Theo Dự Án

## When to Use

- "Cuối tháng kế toán cần tỉ lệ nhân sự tham gia các dự án"
- "Tổng giờ log (total time logs) của từng người theo dự án trong kỳ X"
- Đối chiếu / kiểm chứng giờ log giữa chart Notion và dữ liệu thô

> Nếu cần tình hình tức thời 1 dự án → skill `project-status`. Tổng kết 1 sprint → skill `sprint-report`.

## ⚠️ RULE BẮT BUỘC: Đọc Notion bằng TRÌNH DUYỆT TÍCH HỢP VS Code — KHÔNG dùng MCP

- User là **guest** workspace A-Star Group; MCP không đọc được page.
- Dùng browser tools: `open_browser_page` → `navigate_page` → `run_playwright_code` (`page.evaluate`).
- Cấu trúc database: `wiki/Notion_Quan_Ly_Du_An.md`.

## Nguồn dữ liệu — 6 DB log giờ (Team Works / Product Delivery)

Mỗi dự án có DB `Task time logs` riêng; có thêm DB cấp PD. **Bảng tab chart:**

| DB                     | Tab chart (BẮT BUỘC dùng) | Ghi chú                                                      |
| ---------------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `PD - Tasks time logs` | **Chart 1 month**         | = **A-Star PD** (toàn bộ page, không phân loại gì bên trong) |
| `GSX                   | Task time logs`           | **Time logs 1 month**                                        | ⚠️ Tab ẩn trong menu **"1 more…"** (bấm overflow) |
| `AE OCB                | Task time logs`           | **Time logs 1 month**                                        | Dự án AE OCB (Auto Earning)                       |
| `HTXTTL                | Task time logs`           | **Chart 1 month**                                            | Dự án HTXTTL                                      |
| `BCI                   | Task time logs`           | **Time logs 1 month**                                        | Dự án BCI                                         |
| `G3 TMS                | Task time logs`           | **Time logs 1 month**                                        | Dự án G3 TMS                                      |

> **Quy ước:** toàn bộ `PD - Tasks time logs` = **A-Star PD**. % tham gia dự án chỉ lấy từ DB dự án riêng (GSX, AE OCB, HTXTTL, BCI, G3 TMS).

## Cách lấy dữ liệu (BẮT BUỘC) — dùng tab Chart để Notion tính

Làm trên TỪNG DB `Task time logs` (PD + 5 dự án):

1. Mở DB → tab **Chart** (`Chart 1 month` / `Time logs 1 month`).
2. Bấm **Settings** (⚙):
    - **What to show = `Sum` → chọn cột `Hour (h)`** — ⚠️ **mặc định là `Count` (đếm số dòng log, KHÔNG phải tổng giờ)**. VD: 1 dòng log 3h → Count=1 nhưng Sum=3.
    - **Group by = `Person`** (mỗi nhân sự 1 cột) nếu muốn tổng theo người.
3. Bấm **Filter** → **Date** → chọn **"is between"**:
    - Start: `YYYY/07/15`
    - End: `YYYY/08/14` (⚠️ xem quy ước ranh giới kỳ bên dưới)
    - Nhanh hơn: chọn **Past 2 month** rồi chỉnh lại End nếu cần.

### ⚠️ Quy ước ranh giới kỳ "15/tháng này → 15/tháng sau" (BẮT BUỘC)

- Kỳ nghiệp vụ "15/07 → 15/08" thực chất là **15/07 → 14/08**: ngày **15/08 thuộc kỳ SAU** (15/08 → 15/09), **không tính** vào kỳ này.
- → **LUÔN pick End = ngày 14 của tháng sau** (VD kỳ 15/07→15/08/2026: filter **is between 15/07 → 14/08**). **KHÔNG có ngoại lệ cuối tuần** — dù 15 rơi vào thứ 7/CN cũng vẫn đặt End = 14 cho đúng kỳ.

4. Đọc **tổng giờ từng nhân sự do chart tính** → **gộp các DB** lại (thủ công hoặc bảng tổng hợp).

> ⚠️ **CHỈ dùng chart — KHÔNG đọc bảng thô để tính.** Bảng thô (tab All) chỉ dùng để xem chi tiết/kiểm tra, KHÔNG dùng để tổng hợp (dễ bỏ sót dòng ở bảng ảo lớn).

### Lưu ý (đã trải nghiệm thực tế)

- **Cấu hình trục (What to show / Group by) có thể bị KHOÁ (disabled) ở view dùng chung quyền guest/shared** → chỉ owner đổi được; nếu bị khoá, nhờ owner set 1 lần.
- **Filter ngày nên làm bằng chuột (click ô ngày trên calendar)** — tự động hoá bằng bàn phím ảo (Enter) chỉ commit được ô Starting, dễ sót ô Ending.
- **Tab chart có thể bị ẩn trong menu "1 more…"** (VD: GSX) — bấm overflow để mở danh sách đầy đủ.
- Mỗi chart chỉ tính **1 DB** → không gộp được nhiều dự án trong 1 chart (cấu trúc task khác nhau); làm từng DB rồi gộp.

## Số liệu tham chiếu — kỳ 15/07 → 15/08/2026 (đọc bằng tab Chart, 25/08)

| Dự án                                | Giờ              | Số người        |
| ------------------------------------ | ---------------- | --------------- |
| **GSX**                              | 543,5            | 10              |
| **A-Star PD** (PD - Tasks time logs) | 511              | 9               |
| **BCI**                              | 205,5            | 5               |
| **HTXTTL**                           | 70               | 1               |
| **AE OCB**                           | 32               | 2               |
| **G3 TMS**                           | 3 (log từ 14/08) | 2               |
| **Tổng**                             | 1.365            | 14 người có log |

> **Ranh giới kỳ:** kỳ "15/07 → 15/08" = **15/07 → 14/08** (15/08 thuộc kỳ sau). Số tham chiếu bên trên của kỳ 15/07→15/08/2026 đọc với filter `15/07 → 15/08` (quyết định thực tế 25/08, không làm lại). **Từ nay pick End = 14** luôn.

**⚠️ Bài học quan trọng:** **đọc bảng thô bằng cách cuộn dễ BỎ SÓT dòng** (virtualized table) → **BẮT BUỘC dùng chart (tab Chart) để Notion tính** cho chính xác (VD GSX: đọc thô ra 419,75h nhưng chart = 529h → 543,5h).

**⚠️ Dữ liệu là LIVE:** mọi con số là **snapshot tại thời điểm đọc** — người log thêm giờ là số thay đổi ngay. Báo cáo phải ghi rõ **ngày giờ đọc**; nếu cần số chốt cho kế toán → chốt đúng thời điểm lấy.

**Lưu ý dữ liệu:** sau khi team bổ sung logs, PD đã có log từ 15/07; GSX từ 23/07; HTXTTL từ 20/07.

## Cách tính Capacity (X) & Tỉ lệ rảnh — báo cáo cuối tháng

**Nguyên tắc (QuyenLD):**

- Mỗi nhân sự làm **8 giờ/ngày**, từ **thứ 2 → thứ 6** (5 ngày/tuần = 40h/tuần).
- **X = capacity trong kỳ** = `8h × số ngày làm việc (thứ 2–6) trong kỳ − số ngày nghỉ lễ`.
- **Total time logs** (tổng từ các chart DB) của 1 nhân sự có thể **< X**.
- **% rảnh / nhàn rỗi = (X − Total time logs) / X** → biết nhân sự còn rảnh bao nhiêu thời gian (phục vụ phân việc / đánh giá tải).

**Quy trình báo cáo cuối tháng:**

1. Chọn kỳ (VD 15/07 → 15/08/2026).
2. **HỎI người dùng: kỳ đó có ngày nghỉ lễ nào không** (trừ khỏi X) — bắt buộc, không tự đoán.
3. Đếm số ngày thứ 2–6 trong kỳ → `X = 8 × số ngày − nghỉ lễ`.
4. Với từng DB dự án: **dùng tab Chart (bắt buộc)** lấy **Total time logs theo nhân sự** trong kỳ; gộp tất cả DB.
5. So sánh mỗi nhân sự: `Total logs vs X` → ra **% tham gia dự án**, **% rảnh**.
6. Ghi rõ **ngày giờ chốt số liệu** (dữ liệu live).

**⚠️ Vai trò quản lý (BOM/PGĐ):** người ở vai trò lãnh đạo/quản lý (VD Lê Đình Quyền — PGĐ Sản phẩm + BOM) thường **chỉ log khi họp**, còn thời gian điều phối/kiểm soát đội ngũ/nghiên cứu định hướng **không log theo giờ dự án** → **KHÔNG áp dụng % rảnh** cho họ (model 8h/ngày execution sai phạm trù). Báo cáo nên **tách nhóm Ban quản lý** riêng khỏi so sánh utilization.

## Đầu ra chuẩn — Bảng % tham gia cuối tháng (gửi kế toán)

**Mỗi khi user cần "báo cáo cuối tháng / tỉ lệ nhân sự" → xuất ĐÚNG 1 bảng % này** (chuẩn X = capacity kỳ):

| Nhân sự | [Dự án 1] | [Dự án 2] | …   | A-Star PD | Rảnh (chưa logs) |
| ------- | --------- | --------- | --- | --------- | ---------------- |
| Người A | x%        | y%        | …   | z%        | 100% − tổng      |

**Cách tính:**

1. **X (capacity kỳ)** = 8h × số ngày làm việc (thứ 2–6) trong kỳ − ngày nghỉ lễ → **BẮT BUỘC hỏi user: kỳ đó có ngày lễ/nghỉ nào không** (không tự đoán).
2. **% mỗi dự án** = giờ log dự án đó (lấy từ tab Chart) ÷ X.
3. **A-Star PD** = task teamwork / việc chung đội (research skill, học tập, Company Profile, meeting nội bộ, absence…) — user quy ước gọi là **"A-Star PD"** (thay cho "không thuộc dự án").
4. **Rảnh (chưa logs)** = 100% − (tổng % dự án + % A-Star PD) → cho biết nhân sự còn trống bao nhiêu để nhận việc mới.

**Quy ước vai trò (không coi là bất thường):**

- **Customer Success** — Chu Yến Nhi, Khánh Huyền: tham gia **nhiều dự án là bình thường/kỳ vọng** (hỗ trợ xuyên dự án).
- **Ban quản lý** — Lê Đình Quyền (PGĐ + BOM): **không áp dụng % rảnh** (điều phối/kiểm soát không log theo giờ dự án) → ghi chú riêng.

**Ghi chú khi xuất báo cáo:**

- Ghi rõ **ngày giờ chốt số liệu** (dữ liệu live — người log thêm là đổi).
- G3 TMS có thể = 0% nếu chưa log trong kỳ.
- Lưu kết quả vào `wiki/projects/Bao_Cao_Ti_Le_Nhan_Su.md` + cập nhật index.md + log.md.

## Lưu kết quả (bắt buộc)

- Log kết quả vào `wiki/` (VD: `wiki/projects/Bao_Cao_Ti_Le_Nhan_Su.md` hoặc file sprint tương ứng) theo định dạng `## [YYYY-MM-DD HH:MM] Loại: Báo cáo / Cập nhật`.
- Cập nhật `wiki/index.md` (nếu tạo trang mới) + thêm dòng `wiki/log.md`.
- Ghi rõ ngày đọc dữ liệu (snapshot live từ Notion).
