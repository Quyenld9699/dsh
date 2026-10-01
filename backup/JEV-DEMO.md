# Demo dùng JEV trong dự án này — triage log lỗi dsh

Ngày: 2026-09-30 · Model: `jev-1.13.0` · Key: `refs.TYPESAFE_API_KEY` · Chạy qua `D:\dsh\scripts\jev.ps1`

## Vì sao chọn ca này

Chính dự án này vừa trải qua một lỗi chỉ đọc log là đoán được hướng sửa
(`startup failed: 1 required plugin did not activate`). Đó là dạng việc **phù hợp nhất với Jev**:
đọc một đoạn văn bản, trả về **phán đoán có kiểu**, còn code giữ quyết định.
Không cần LLM, không sinh chữ, chỉ cần "common sense lập trình được".

## Thiết kế phán đoán (4 câu hỏi, 1 request)

| Câu hỏi | Primitive | Vì sao primitive đó |
| --- | --- | --- |
| `blocking` | **Noul** | Câu trả lời là *có/không* kèm xác suất — không có "confidence" riêng, đúng như docs mô tả |
| `category` | **Choice** | Chọn 1 trong tập hữu hạn đã định nghĩa + phân phối xác suất để so các khả năng |
| `severity` | **Score** | Mức độ trên thang có thứ tự; `score` có thể nằm giữa 2 mức, kèm `legend` |
| `evidence_sufficient` | **Noul** | Phán đoán "có đủ dữ kiện để chỉ ra nguyên nhân cụ thể không" → đầu vào cho nhánh **escalate** |

Cả 4 câu hỏi **độc lập trên cùng state** nên được gộp vào **một request** (chúng chạy song song, không thấy
kết quả của nhau). Câu hỏi nằm ở một chỗ duy nhất: `D:\dsh\scripts\jev-demo-triage.questions.json`.

Thực tế mỗi lần gọi: **721–840 input tokens · 135–139 output tokens · 320–720 ms** cho cả 4 phán đoán.

## Kết quả 4 ca thật

| Ca | State (rút gọn) | blocking | category (conf) | severity | evidence | Route do CODE quyết định |
| --- | --- | --- | --- | --- | --- | --- |
| **A** | `disabling profile plugin row "tools" … @deepseek-ai/dsh-tools@0.1.5-rc.2 incompatible … startup failed` | 0.98 | `peer-version-conflict` (1.00) | 2.0 | 0.75 | **AUTO-ROUTE** (chạy guard chẩn đoán version) |
| **B** | `warning: 1 entry did not activate hmr … EBUSY … NTUSER.DAT` | 0.37 | `filesystem-permission` (1.00) | 0.92 | 0.37 | **NOTE** (suy giảm nhẹ, không chặn) |
| **C** | `dsh khong chay duoc, chang ro loi gi, bam hoai khong len` | 0.80 | `other` (**0.27**) | 1.72 | **0.12** | **ESCALATE** (model tự báo không đủ chắc/dữ kiện) |
| **D** | `Error: 401 Unauthorized - invalid api key when calling provider API` | 0.25 | `missing-credential` (1.00) | 1.92 | 0.65 | **INVESTIGATE** (sau khi thêm policy, xem dưới) |

Đáng chú ý: ở ca A, Jev tự gán đúng `peer-version-conflict` — trùng khớp với kết luận gốc rễ mà tôi tìm ra
bằng phân tích mã nguồn dsh và thực nghiệm ở [JEV-RCA.md](JEV-RCA.md). Đây là kiểm chứng chéo độc lập.

## Hai vòng lặp — và cả hai lần đều là lỗi CODE, không phải lỗi model

**Vòng 1 — lỗi ngưỡng.** Bản đầu escalate khi `evidence < 0.4` bất kể mức độ chặn, nên ca B
(warning lành) bị ESCALATE → nhiễu. Sửa policy theo đúng nguyên tắc "threshold theo mức rủi ro":
- rủi ro cao (`severity ≥ 3`) → luôn escalate;
- `blocking < 0.2` → không cần bằng chứng, bỏ qua;
- chỉ escalate khi **phải hành động** (`blocking ≥ 0.8`) mà lại **thiếu dữ kiện**, hoặc model thật sự không chắc
  (`category.confidence < 0.5`).

→ Ca B chuyển từ ESCALATE sang **NOTE**. Đây là bug của code, sửa bằng 6 dòng `if/elseif`.

**Vòng 2 — thiếu policy.** Ca D: sai API key là việc luôn cần người xác nhận, nhưng policy cũ không có luật nào
cho `missing-credential` nên rơi vào NOTE. Thêm một luật policy — và **không gọi lại Jev**:
luật mới được áp lên **chính phán đoán đã lưu**:

```powershell
# chạy thật 1 lần, lưu phán đoán, policy cũ -> NOTE
D:\dsh\scripts\jev-demo-triage.ps1 -InputText $log -SaveAnswers D:\dsh\backup\jev-demo-answers-key401.json -CredentialNeedsHuman:$false
# đổi policy, dùng lại phán đoán cũ -> INVESTIGATE, 0 token, 0 ms
D:\dsh\scripts\jev-demo-triage.ps1 -Replay D:\dsh\backup\jev-demo-answers-key401.json -CredentialNeedsHuman:$true
```

Đây đúng nguyên tắc trong docs: *"Keep policy explicit and raw judgments reusable."*
Đổi trọng số/ngưỡng/hiển thị **không cần suy luận lại** khi evidence và ý nghĩa câu hỏi chưa đổi.

## Cách dùng / tự chạy

```powershell
# 1 ca bất kỳ
D:\dsh\scripts\jev-demo-triage.ps1 -InputText "dsh: startup failed: 1 required plugin did not activate"
# hoặc từ file log
D:\dsh\scripts\jev-demo-triage.ps1 -InputFile .\startup.log
# xem JSON thô để audit
D:\dsh\scripts\jev-demo-triage.ps1 -InputText "..." -ShowRaw
```

Script **không tự chạy hành động sửa nào** — chỉ in ra lệnh gợi ý. Đây là chủ ý: Jev chỉ phán đoán,
hành động vẫn qua tay người/agent có ngưỡng rõ ràng.

## Nguyên tắc từ skill/docs đã áp dụng

- **Code giữ workflow, model trả phán đoán có kiểu** (skill `typesafe-ai`).
- **Hỏi nhiều câu độc lập trong một request** — 4 câu/1 lần gọi, song song, không thấy nhau
  ([speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md)).
- **Chọn primitive theo ý nghĩa câu trả lời**: Choice/Noul/Score + một Noul "meta" cho nhánh escalate
  ([primitives](https://docs.typesafe.ai/primitives.md)).
- **Confidence là độ tập trung của phân phối, không phải độ đúng**; ngưỡng theo mức rủi ro, hiệu chỉnh trên
  dữ liệu thật ([confidence](https://docs.typesafe.ai/confidence.md),
  [intent routing](https://docs.typesafe.ai/patterns/intent-routing.md)).
- **Typed output bảo đảm giao diện, không bảo đảm sự thật** → ca C/D đều có nhánh escalate.
- **Test trên ca đại diện rồi mới dùng**: 4 ca ở trên là dữ liệu thật của chính dự án, không phải demo giả.

## Giới hạn & bước tiếp

- Đang chấm **một đoạn log**, chưa phải toàn bộ file log; log dài nên cắt theo khối lỗi trước khi đưa vào.
- Ngưỡng hiện tại hiệu chỉnh trên 4 ca — muốn dùng thật nên gom ~20–50 ca có nhãn (route đúng) rồi đo
  tỉ lệ auto-route đúng so với người, giống cookbook
  [classification using confidence](https://docs.typesafe.ai/cookbooks/classification_using_confidence.md).
- Bước tiếp hợp lý: gắn script này vào một skill/hook của dsh để agent tự phân loại log khi gặp lỗi,
  hoặc thêm câu hỏi `next_action` (Choice) để chọn đúng lệnh sửa thay vì gợi ý chung.
