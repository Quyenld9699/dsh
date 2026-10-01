#Requires -Version 7.0
<#
.SYNOPSIS
  Demo dùng JEV để phân loại + định tuyến log lỗi DSH. Code giữ workflow, Jev chỉ phán đoán.

.DESCRIPTION
  Một request JEV chứa 4 câu hỏi ĐỘC LẬP trên cùng state (chạy song song trong 1 lần gọi):
    blocking (noul) · category (choice) · severity (score) · evidence_sufficient (noul)
  Sau đó CODE áp ngưỡng (theo docs: confidence threshold không phải một số duy nhất, phải theo mức rủi ro):
    - category.confidence < 0.5  HOẶC evidence_sufficient.noul < 0.4   -> ESCALATE (người xem xét)
    - blocking.noul >= 0.8 và category = peer-version-conflict          -> AUTO-ROUTE: chạy guard chẩn đoán
    - blocking.noul >= 0.8 (loại khác)                                  -> INVESTIGATE (gợi ý lệnh, không tự chạy)
    - còn lại                                                            -> LOG-ONLY (không hành động)
  Script KHÔNG tự chạy hành động sửa nào — chỉ in lệnh gợi ý. An toàn theo mặc định.

.PARAMETER InputText
  Nội dung log/câu hỏi cần đánh giá.

.PARAMETER InputFile
  Hoặc file chứa nội dung đó.

.EXAMPLE
  D:\dsh\scripts\jev-demo-triage.ps1 -InputText "dsh: startup failed: 1 required plugin did not activate"
  D:\dsh\scripts\jev-demo-triage.ps1 -InputFile .\startup.log
#>
[CmdletBinding(DefaultParameterSetName = 'Text')]
param(
    [Parameter(ParameterSetName = 'Text', Position = 0)][string]$InputText,
    [Parameter(ParameterSetName = 'File', Mandatory)][string]$InputFile,
    [string]$QuestionsFile = (Join-Path $PSScriptRoot 'jev-demo-triage.questions.json'),
    [string]$SaveAnswers,
    [string]$Replay,
    [bool]$CredentialNeedsHuman = $true,
    [switch]$ShowRaw
)

$ErrorActionPreference = 'Stop'
$jev = Join-Path $PSScriptRoot 'jev.ps1'
if (-not (Test-Path -LiteralPath $jev)) { throw "Không thấy $jev" }

$stateFile = $null
$preview = '(replay - không cần state)'
if ($Replay) {
    if (-not (Test-Path -LiteralPath $Replay)) { throw "Không thấy file answers: $Replay" }
} elseif ($InputFile) {
    if (-not (Test-Path -LiteralPath $InputFile)) { throw "Không thấy file: $InputFile" }
    $stateFile = (Resolve-Path -LiteralPath $InputFile).Path
    $preview = (Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8).Trim()
} else {
    $stateFile = Join-Path ([System.IO.Path]::GetTempPath()) ("jev-state-$([guid]::NewGuid().ToString('N')).txt")
    Set-Content -LiteralPath $stateFile -Value $InputText -Encoding UTF8
    $preview = $InputText.Trim()
}

Write-Host ""
Write-Host "=== STATE (rút gọn) ===" -ForegroundColor DarkGray
Write-Host ($preview.Substring(0, [Math]::Min(200, $preview.Length)))
Write-Host ""

# ---- 1) một request, 4 phán đoán độc lập ----
$sw = [System.Diagnostics.Stopwatch]::StartNew()
if ($Replay) {
    $sw.Stop()
    $jsonText = Get-Content -LiteralPath $Replay -Raw -Encoding UTF8
    Write-Host "REPLAY: dùng lại phán đoán đã lưu ở $Replay — KHÔNG gọi API, KHÔNG tốn token." -ForegroundColor DarkYellow
} else {
    $jsonText = ((& $jev -StateFile $stateFile -QuestionsFile $QuestionsFile -Raw) -join "`n")
    $sw.Stop()
    if ($SaveAnswers) { Set-Content -LiteralPath $SaveAnswers -Value $jsonText -Encoding UTF8 }
}
$resp = $jsonText | ConvertFrom-Json
if ($ShowRaw) { Write-Host $jsonText; Write-Host "" }

$blocking = $resp.answers.blocking.noul
$cat = $resp.answers.category.choice
$catConf = [double]$resp.answers.category.confidence
$sev = [double]$resp.answers.severity.score
$sevConf = [double]$resp.answers.severity.confidence
$evidence = [double]$resp.answers.evidence_sufficient.noul

# ---- 2) POLICY do CODE quyết định (thứ tự ưu tiên = mức rủi ro; đổi policy KHÔNG cần gọi lại Jev) ----
$decision = if ($sev -ge 3) { 'ESCALATE' }                                  # data-loss / bảo mật
elseif ($CredentialNeedsHuman -and $cat -eq 'missing-credential' -and $catConf -ge 0.8) { 'INVESTIGATE' }
elseif ($blocking -lt 0.2) { 'LOG-ONLY' }                                   # lành, không cần làm gì
elseif ($catConf -lt 0.5) { 'ESCALATE' }                                    # model không chắc
elseif ($blocking -ge 0.8 -and $evidence -lt 0.4) { 'ESCALATE' }             # phải sửa nhưng thiếu dữ kiện
elseif ($blocking -ge 0.8 -and $cat -eq 'peer-version-conflict') { 'AUTO-ROUTE' }
elseif ($blocking -ge 0.8) { 'INVESTIGATE' }
else { 'NOTE' }                                                             # suy giảm nhẹ, ghi nhận

# ---- 3) in kết quả ----
Write-Host "=== PHÁN ĐOÁN CỦA JEV ($($resp.model)) ===" -ForegroundColor Cyan
Write-Host ("  blocking           : noul = {0}" -f $blocking)
Write-Host ("  category           : {0}  (confidence {1})" -f $cat, $catConf)
Write-Host ("  severity           : {0}  (confidence {1})" -f $sev, $sevConf)
Write-Host ("  evidence_sufficient: noul = {0}" -f $evidence)
Write-Host ("  tokens             : in={0} out={1} · độ trễ {2} ms" -f $resp.usage.input_tokens, $resp.usage.output_tokens, $sw.ElapsedMilliseconds)
Write-Host ""
Write-Host "=== QUYẾT ĐỊNH CỦA CODE (ngưỡng theo mức rủi ro) ===" -ForegroundColor Cyan
$tone = switch ($decision) {
    'ESCALATE' { 'Yellow' }
    'AUTO-ROUTE' { 'Red' }
    'INVESTIGATE' { 'Red' }
    'NOTE' { 'DarkYellow' }
    default { 'Green' }
}
Write-Host ("  -> {0}" -f $decision) -ForegroundColor $tone
Write-Host ("  lý do: severity={0} · blocking={1} · category.confidence={2} · evidence_sufficient={3}" -f $sev, $blocking, $catConf, $evidence) -ForegroundColor DarkGray

switch ($decision) {
    'AUTO-ROUTE' {
        Write-Host "  hành động gợi ý (chưa tự chạy):" -ForegroundColor DarkGray
        Write-Host "     D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -CheckOnly     # hoặc guard -PinRuntimeTools nếu đúng bẫy version"
    }
    'INVESTIGATE' {
        Write-Host "  hành động gợi ý (chưa tự chạy):" -ForegroundColor DarkGray
        Write-Host "     D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-tools@0.1.12 -CheckOnly   # soi tương thích profile"
        Write-Host "     Get-Content `$env:DSH_HOME\logs\* -Tail 50                                # xem log startup đầy đủ"
    }
    'ESCALATE' {
        Write-Host "  -> Jev tự báo là không đủ chắc/đủ dữ kiện: đưa cho người hoặc agent đọc log đầy đủ, đừng hành động tự động." -ForegroundColor DarkGray
    }
    'NOTE' {
        Write-Host "  -> Suy giảm nhẹ, KHÔNG chặn: ghi nhận để xem sau, không cần bằng chứng hay hành động." -ForegroundColor DarkGray
    }
    'LOG-ONLY' {
        Write-Host "  -> Không cần làm gì." -ForegroundColor DarkGray
    }
}
Write-Host ""
