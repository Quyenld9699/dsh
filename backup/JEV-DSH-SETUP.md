# Dùng API JEV (TypeSafe) từ dsh — cần làm gì

Trả lời câu hỏi: *"doc JEV có nhắc tới skill, vậy với agent như dsh cần làm gì để dùng được API của JEV?"*

Nguồn: `https://docs.typesafe.ai/` (Introduction, **Jev with coding agents**, **Agent skill**, Quick start, API reference, SDK) — đọc ngày 2026-09-30.

## 1. Ba điều tài liệu nói rõ (và hệ quả cho dsh)

| Tài liệu nói | Hệ quả với dsh |
| --- | --- |
| **Jev KHÔNG phải LLM chat/code-completion.** "There is no `model: "jev-latest"` setting that turns your coding agent into a Jev-powered agent." | Không thể nhét Jev làm model của dsh. Jev là **thứ code gọi vào**, không phải thứ chạy agent. |
| **Skill = ngữ cảnh cho agent**, để agent *viết code gọi đúng API*. Skill không cấp key, không cấp tool, không tự gọi API. | Skill `typesafe-ai` (đã cài) đủ để agent biết cách thiết kế; **vẫn phải có key + một đường gọi**. |
| **API**: `POST https://api.typesafe.ai/v1/systemone`, header `Authorization: Bearer <API_KEY>`, body `{ state, model:"jev-latest", questions:{...} }` → trả `answers` có kiểu (noul / choice / score) + `usage`. Key lấy ở `console.typesafe.ai/keys`. | Đây là toàn bộ hợp đồng. Không cần gì thêm để gọi từ dsh. |

SDK (tuỳ chọn): JS `npm install @typesafe-ai/sdk` (Node ≥ 20), Python `pip install typesafe-sdk` (≥ 3.10).
Máy này: **Node v24.20.0 có**, **Python không có** → đường SDK khả dụng là JS.

## 2. Trạng thái hiện tại trên máy (đã kiểm tra)

| Hạng mục | Trạng thái |
| --- | --- |
| Skill `typesafe-ai` | ✅ đã cài global (`~\.agents\skills\typesafe-ai`), khớp upstream `main@65a39f3`, DSH đã nạp |
| Plugin `dsh-jev-verify` (tool native `jev_*`) | ⛔ chưa cài (và mọi bản đang ghim `dsh-tools@0.1.5-rc.2` → phải cài qua guard, xem `JEV-RCA.md`) |
| `TYPESAFE_API_KEY` trong `refs` của `~\.dsh\.credentials.yaml` | ❌ **chưa có** |
| `TYPESAFE_API_KEY` trong env | ❌ không có |
| `.env` ở workspace/DSH_HOME | ❌ không có |
| DSH có tiêm credentials vào shell tool không? | ❌ **không** (đã kiểm chứng: `DEEPSEEK_API_KEY`, `INCEPTIONLABS_API_KEY`, `GOOGLE_API_KEY` đều không có trong env của shell) |
| Client gọi API có sẵn | ✅ `D:\dsh\scripts\jev.ps1` (mới, đã kiểm thử) |

⇒ **Việc còn thiếu duy nhất là API key.** Mọi thứ khác đã sẵn sàng.

## 3. Việc cần làm — 4 bước

### Bước 0 — Lấy key
Vào `https://console.typesafe.ai/keys` tạo key. (Key chỉ nằm ở phía bạn; **không dán vào chat**, không commit vào repo.)

### Bước 1 — Đưa key vào chỗ dsh đọc được (1 trong 2)

```yaml
# ~/.dsh/.credentials.yaml  (thêm vào mục refs, giữ nguyên các key khác)
refs:
  TYPESAFE_API_KEY: <key-cua-ban>
```

hoặc mở GUI: **Settings → Plugins → Plugin configuration → Jev** và nhập key (ghi cùng nguồn credentials).
> Vì dsh không tiêm credentials vào shell, script `jev.ps1` **đọc trực tiếp file này** (mục `refs`) — cùng nguồn mà plugin dùng, nên chỉ cần nhập một lần.

### Bước 2 — Chọn đường nối (chọn 1; có thể dùng song song nhiều cái)

| | Đường nối | Khi nào dùng | Lệnh |
| --- | --- | --- | --- |
| **A** | **Plugin `dsh-jev-verify`** → tool native `jev_decision`, `jev_verify`, `jev_guard_status`, `jev_overview` | Muốn agent gọi Jev như tool dsh bình thường (không cần shell) | `D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools` |
| **B** | **Script HTTP** `D:\dsh\scripts\jev.ps1` | Không muốn thêm plugin; agent gọi qua tool `pwsh`; hợp với state dài (file), questions tự do | xem mục 4 |
| **C** | **SDK JS** trong code dự án | Jev nằm trong sản phẩm/app bạn đang viết, cần kiểu dữ liệu | `npm install @typesafe-ai/sdk` rồi dùng `TypeSafeClient` |

Không có MCP server chính thức trong `llms.txt` (ngày đọc) → đường "MCP" không khả dụng.

### Bước 3 — Kiểm tra key
```powershell
D:\dsh\scripts\jev.ps1 -Check        # gửi 1 câu noul "ping"; in noul + token usage
```

### Bước 4 — Dùng skill để thiết kế, không phải để gọi
Mời agent: *"Dùng skill TypeSafe, đọc `docs.typesafe.ai/llms.txt` và thiết kế các câu hỏi cho <tình huống>"*.
Nguyên tắc từ chính skill: code giữ workflow; chọn `Choice`/`Noul`/`Score` theo **ý nghĩa** câu trả lời;
hỏi nhiều câu độc lập trong **một request** (song song); ngưỡng/trọng số để trong **code** và hiệu chỉnh trên dữ liệu thật.

## 4. Dùng script `jev.ps1` (đường B)

```powershell
# 1) xem trước request, không gọi mạng, không cần key
D:\dsh\scripts\jev.ps1 -State "Payouts failed 3 days, losing sales!" `
    -QuestionsFile D:\dsh\scripts\jev-questions.example.json -DryRun

# 2) gọi thật
D:\dsh\scripts\jev.ps1 -State "Payouts failed 3 days, losing sales!" `
    -QuestionsFile D:\dsh\scripts\jev-questions.example.json

# 3) state có cấu trúc (JSON) + questions riêng, lấy JSON đầy đủ
D:\dsh\scripts\jev.ps1 -StateFile .\ticket.json -QuestionsFile .\q.json -Raw
```

- Key được tìm theo thứ tự: `-ApiKey` → `$env:TYPESAFE_API_KEY` → `refs` trong `<DSH_HOME>\.credentials.yaml`. Key không bao giờ bị in đầy đủ.
- Mã thoát: `0` OK · `1` lỗi API (kèm body lỗi, có gợi ý theo 401/422/429/529) · `2` thiếu/không hợp lệ tham số hoặc thiếu key.
- Mẫu questions: `D:\dsh\scripts\jev-questions.example.json` (1 choice + 1 score + 1 noul, đúng như ví dụ trong Quick start).
- Với state dài: ghi ra file rồi `-StateFile` để tránh lỗi trích dẫn của shell.

## 5. Đã kiểm chứng tới đâu (trung thực về giới hạn)

| Việc | Kết quả |
| --- | --- |
| Request body khớp tài liệu (state / model / questions; criteria của choice là map, score là mảng) | ✅ kiểm bằng `-DryRun`, so từng phần với API reference |
| Endpoint + header + đường mạng | ✅ gọi thật `POST https://api.typesafe.ai/v1/systemone` với key **sai** → API trả **401** kèm `{"error_type":"authentication_error","message":"Cannot authenticate…"}` — đúng như tài liệu |
| Xử lý lỗi | ✅ 401 được nhận diện, gợi ý đúng, exit code 1 |
| **Gọi thật thành công (200 + answers)** | ❌ chưa làm được vì **máy chưa có key** — sau khi bạn thêm key, chạy `-Check` là xác nhận ngay |

## 6. An toàn

- Key nằm trong `~\.dsh\.credentials.yaml` (ngoài repo `D:\dsh`) — **không** copy vào repo (repo có remote GitHub).
- Skill nhấn mạnh: *"Keep API credentials server-side in web apps."* Trong dsh, "server-side" = file credentials của DSH, không phải biến trong code app gửi ra client.
- Không dán key vào chat/ảnh/log; `jev.ps1` cố ý chỉ in 4 ký tự đầu + độ dài.
- Jev trả **phán đoán có xác suất**, không phải chân lý: ngưỡng phải hiệu chỉnh trên dữ liệu của bạn, và các trường hợp gần ngưỡng nên đẩy sang người/LLM xem lại.
