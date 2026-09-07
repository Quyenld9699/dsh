---
name: bao-gia
description: Lập báo giá / ước lượng chi phí & thời gian dự án phần mềm outsource theo mô hình ĐỦ 4 role (Code + Hiểu nghiệp vụ/BA + Thiết kế/Designer UIUX + Kiểm thử/Tester = 100%) + NFR (không tính designer) + PM (20–30% total time). BẮT BUỘC hỏi: (1) số người khả dụng cho dự án, (2) tỉ lệ % từng role trong báo giá. Gốc giờ = code thực tế KHÔNG AI; khi user yêu cầu thì điều chỉnh theo bối cảnh (khách, độ khó nghiệp vụ) + mức hỗ trợ AI để linh hoạt. Dùng khi user cần "làm báo giá", "ước lượng chi phí dự án", "bóc tách module tính năng tính giờ", "chốt giá".
---

# Báo Giá Dự Án — Ước Lượng Chi Phí & Thời Gian (Mô Hình Đủ Role)

## When to Use

- "Làm báo giá / bóc tách module → tính năng → giờ để báo giá dự án X"
- "Ước lượng lại chi phí / thời gian theo nghiệp vụ cập nhật"
- "Tính tiền cho khách theo đủ role code/BA/design/test"

## ⚠️ NGUYÊN TẮC CỐT LÕI (mô hình kinh doanh — phải tuân theo)

### 1. Báo giá ra ngoài (cho KH) — LUÔN đủ 4 role, tổng 100%

| Role                          | Nội dung      |
| ----------------------------- | ------------- |
| **Code** (lập trình FE/BE)    | Gốc ước lượng |
| **Hiểu nghiệp vụ (BA)**       | % coding      |
| **Thiết kế (Designer UI/UX)** | % coding      |
| **Kiểm thử (Tester)**         | % coding      |

- **BẮT BUỘC hỏi user tỉ lệ % của 4 role này trong dự án** (VD Code 50 / BA 20 / Design 10 / Test 20 — 4 số cộng = 100%).
- **Yêu cầu phi chức năng (NFR): KHÔNG tính tiền Designer** — NFR chỉ gồm Code + BA + Test (không có UI/UX).
- **PM:** tỉ lệ **20% → 30%** của total time, tuỳ dự án (hỏi user nếu chưa rõ).
- **Mục đích:** báo giá ra ngoài thể hiện **đủ người, đủ bộ phận chức năng** → khách tin là có đội ngũ đầy đủ.

### 2. Gốc giờ ước lượng = Code THỰC TẾ KHÔNG AI

- Luôn ước lượng giờ code dựa trên **năng suất lập trình thực tế (không AI)** làm gốc.
- **SAU ĐÓ**, tuỳ tình hình user sẽ yêu cầu điều chỉnh giờ code khi có AI hỗ trợ (xem mục "Điều chỉnh AI") → để linh hoạt trong báo giá, và để anh em dev thấy thời gian đó là hợp lý.

### 3. Lãi nội bộ (KHÔNG ghi vào báo giá — chỉ biết ngầm)

- **Tester:** thực tế dùng AI viết/chạy test → gần như không cần người, chỉ mất thời gian **đợi check kết quả test** → phần tiền tester là lãi.
- **PM chính là BA:** 1 người đảm nhiệm 2 title job → lãi thêm một người.
- (Code có AI cũng nhanh hơn — dùng để linh hoạt giá, không nhất thiết hạ giá.)

## Quy trình thực hiện

### Bước 0 — Hỏi các thông tin BẮT BUỘC

1. **Số người khả dụng cho dự án** (nội bộ thực tế — VD 4 backend + 1 FE + 1 PM/BA kiêm...).
2. **Tỉ lệ % 4 role** trong báo giá (Code/BA/Design/Tester = 100%).
3. **Tỉ lệ PM** (20–30%).
4. Scope/nghiệp vụ dự án (lấy từ BRD/FSD hoặc mô tả).
5. Thời gian mong muốn (nếu có ràng buộc từ khách).

### Bước 1 — Phân rã module → tính năng → giờ + giải thích

- Dựa trên nghiệp vụ cập nhật mới nhất, phân rã thành **module** (theo nhóm nghiệp vụ).
- Mỗi module → **tính năng** → **giờ FE/BE** + **cột giải thích** vì sao tốn giờ (để thuyết phục khi trình khách).
- **Đầu việc >100h phải bóc tách** thành công việc nhỏ hơn (≤ ~100h).
- Cột giải thích nên xuống dòng (`<br>`) mỗi ý cho rõ.
- **Phân loại mới/cũ:** đánh dấu tính năng **mới so với báo giá trước** (nếu có bản trước) — tô màu/đánh dấu để giải thích phần tăng giá.
- **Ghi rõ giả định phạm vi** (VD: reuse nền tảng/parametrize hay build mới; chỉ backend hay có UI) → để bảo vệ giá.

### Bước 2 — Tính coding gốc (KHÔNG AI) + áp tỉ lệ role

- Coding = tổng giờ FE + BE (gốc, không AI).
- Áp tỉ lệ role đã hỏi: BA, Design, Tester.
- NFR tách riêng (không designer).
- PM theo tỉ lệ đã chốt.
- **Tổng giờ × đơn giá (đ/giờ) → tổng tiền.**

### Bước 3 — Điều chỉnh AI (chỉ khi user yêu cầu)

- User sẽ nói bối cảnh: đối tượng khách hàng, nghiệp vụ khó/dễ, team dev thấy sao.
- Điều chỉnh giờ code khi có AI (thường giảm ~15–30%) → báo giá linh hoạt.
- **Lưu ý:** không ghi chú "AI" vào báo giá gửi khách — chỉ ngầm.

### Bước 4 — Chốt & trình bày

- Đề xuất dải giá (sàn / khuyến nghị / trần) để đàm phán.
- Lưu vào `wiki/projects/[Project]/Bao_Gia_vX.md` (xem ví dụ `wiki/projects/OCB/Bao_Gia_v2.md`).
- Cập nhật `wiki/index.md` + `wiki/log.md` + `Sprint_X.md`.

## Xuất khối dữ liệu paste Google Sheets / Excel (TSV)

Khi user yêu cầu **"xuất/cho khối data paste vào gg sheet / excel theo mẫu"** (sheet mẫu đã có sẵn header + công thức), xuất **khối TSV 5 cột** để paste 1 lần.

**Cấu trúc khối — ĐÚNG thứ tự 5 cột:**

```
Tiêu đề<TAB>Tính năng<TAB>Ghi chú<TAB>FE<TAB>BE
```

- **Không** kèm header, **không** kèm dòng "Module/Total" (sheet đã có header + công thức SUM sẵn — dán vào sẽ đè công thức).
- User **paste vào ô B5** → map: `B`=Tiêu đề · `C`=Tính năng · `D`=Ghi chú · `E`=Lập trình FE · `F`=Lập trình BE. ⚠️ KHÔNG dán vào A5 (sẽ lệch 1 cột, BE rơi vào cột FE). Cột A (#) để trống.
- Các cột `Total / Hiểu nghiệp vụ / Thiết kế / Kiểm thử / Tổng / MD` là công thức (đã có sẵn) → **không đưa vào block**.

**Quy tắc từng cột:**

- **Tiêu đề (B):** tên module, **lặp lại ở MỌI dòng** của module (KHÔNG chỉ dòng đầu) → tránh cột B trống/lệch hàng. Bỏ tiền tố "MX —" + bỏ phần giờ (VD: `Nghiệp vụ tự động sinh lời (API cho OMNI KH)`, không phải "M1 — … — BE 330h"). Các dòng cùng module đều ghi y hệt tên module này.
- **Tính năng (C):** tên tính năng (bỏ thẻ `<mark>` — không đánh dấu trong block).
- **Ghi chú (D):** nội dung "Giải thích", nối các ý bằng `•` — **KHÔNG dùng `<br>`** vì paste text sẽ vỡ hàng.
- **FE (E):** để trống nếu tính năng backend-only; chỉ điền khi module có FE thật (VD Admin Portal: FE 12 / BE 34).
- **BE (F):** luôn chứa số giờ backend.

**Lưu ý khi user muốn giống sheet target (tên module gộp 1 ô kiểu Merge):**

- Sheet target gộp cột B theo module (Merge & Center). Paste TSV không tạo được merge → sau khi paste hướng dẫn user: chọn cột B cả module → **Merge & Center** (hàng nào cũng có tên nên merge giữ đúng tên). Cách fill nhanh không cần dán lại: chọn ô B có tên → Ctrl+Shift+↓ → **Ctrl+D** (Fill Down).
- Sau paste nên đối chiếu tổng: tổng FE + tổng BE = coding gốc (khớp mục tổng hợp của file báo giá).

## Lưu ý thực tế (để giờ hợp lý)

- Giờ hiện tại chỉ là **ước lượng năng lực**; luôn kiểm chứng với tổng giờ team có thể làm trong timeline đã chốt: `số người × số tháng × ~500–520h/người`.
- Nếu scope > năng lực team trong timeline → báo rõ rủi ro overrun; gợi ý co scope / tăng người / kéo dài.
- Nhắc user về các rủi ro giá (phạm vi tích hợp, nghiệp vụ TBD chưa chốt, bút toán hạch toán...) để có buffer.

## Đầu ra chuẩn (file báo giá)

File `Bao_Gia_vX.md` gồm:

1. Metadata (phiên bản, ngày, đơn giá đ/giờ, thời gian).
2. Giả định phạm vi (bảo vệ giá).
3. Bảng tỉ lệ role (4 role = 100% + NFR + PM).
4. Phân rã module → tính năng → giờ + giải thích (tính năng mới được tô màu/đánh dấu).
5. Tổng hợp chi phí (từng role + tổng).
6. Rủi ro & điều kiện giá + dải đàm phán.

---

_Nguồn: `wiki/Kinh_Nghiem_Lam_Bao_Gia.md`, ví dụ `wiki/projects/OCB/Bao_Gia_v2.md`, `wiki/projects/OCB/BRD/index.md`._
