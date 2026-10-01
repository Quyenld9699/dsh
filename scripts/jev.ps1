#Requires -Version 7.0
<#
.SYNOPSIS
  Gọi API JEV (TypeSafe System One) từ dsh: POST https://api.typesafe.ai/v1/systemone

.DESCRIPTION
  Client mảnh, không cần SDK, để AGENT gọi được JEV qua shell tool của dsh.
  Lưu ý quan trọng: dsh KHÔNG tiêm credentials refs vào môi trường shell, nên script này
  tự đọc `TYPESAFE_API_KEY` từ (theo thứ tự):
    1) -ApiKey
    2) biến môi trường $env:TYPESAFE_API_KEY
    3) mục `refs:` trong <DSH_HOME>\.credentials.yaml   (cùng nguồn plugin dsh-jev-verify dùng)
  Key KHÔNG bao giờ được in ra đầy đủ (chỉ 4 ký tự đầu + độ dài).

.PARAMETER State
  Nội dung cần đánh giá (string). Với state có cấu trúc, dùng -StateFile (JSON).

.PARAMETER StateFile
  File chứa state: JSON (object/array) hoặc text thường.

.PARAMETER QuestionsFile
  File JSON chứa map questions, vd:
  { "is_urgent": { "type": "noul", "instructions": "Does this convey urgency?" } }

.PARAMETER Check
  Kiểm tra key + kết nối: gửi 1 câu noul đơn giản rồi in kết quả.

.PARAMETER DryRun
  Chỉ in request sẽ gửi (không gọi mạng). Không cần key.

.EXAMPLE
  # Kiểm tra key đã hoạt động chưa
  D:\dsh\scripts\jev.ps1 -Check

.EXAMPLE
  # Đánh giá 1 đoạn text theo 3 câu hỏi mẫu
  D:\dsh\scripts\jev.ps1 -State "Payouts failed 3 days, losing sales!" `
      -QuestionsFile D:\dsh\scripts\jev-questions.example.json

.EXAMPLE
  # Xem trước request, không gọi API
  D:\dsh\scripts\jev.ps1 -State "..." -QuestionsFile .\q.json -DryRun
#>
[CmdletBinding()]
param(
    [string]$State,
    [string]$StateFile,
    [string]$QuestionsFile,
    [string]$Model = 'jev-latest',
    [string]$ApiKey,
    [switch]$Check,
    [switch]$DryRun,
    [int]$TimeoutSec = 60,
    [switch]$Raw
)

$ErrorActionPreference = 'Stop'
$Endpoint = 'https://api.typesafe.ai/v1/systemone'
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }

function Fail([string]$msg, [int]$code = 2) { Write-Host $msg -ForegroundColor Red; exit $code }
function Mask([string]$k) { if (-not $k) { return '(không có)' } "$($k.Substring(0, [Math]::Min(4, $k.Length)))…" + "(len=$($k.Length))" }

# ---------- 1) tìm key ----------
function Get-KeyFromCredentials([string]$dshHome) {
    $file = Join-Path $dshHome '.credentials.yaml'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    $inRefs = $false
    foreach ($line in (Get-Content -LiteralPath $file)) {
        if ($line -match '^refs:\s*$') { $inRefs = $true; continue }
        if ($inRefs -and $line -match '^\S') { break }
        if ($inRefs -and $line -match '^\s+TYPESAFE_API_KEY\s*:\s*"?([^"#]+)"?\s*$') { return $Matches[1].Trim() }
    }
    return $null
}
$keySource = 'không có'
if ($ApiKey) { $keySource = '-ApiKey (tham số)' }
elseif ($env:TYPESAFE_API_KEY) { $ApiKey = $env:TYPESAFE_API_KEY; $keySource = 'env:TYPESAFE_API_KEY' }
else {
    $ApiKey = Get-KeyFromCredentials $dshHome
    if ($ApiKey) { $keySource = "$dshHome\.credentials.yaml (refs.TYPESAFE_API_KEY)" }
}

# ---------- 2) dựng request ----------
$questions = $null
if ($Check) {
    $State = 'Test connection from dsh.'
    $questions = [ordered]@{ ping = [ordered]@{ type = 'noul'; instructions = 'Is this a successful test connection?' } }
} else {
    if (-not $QuestionsFile) { Fail "Thiếu -QuestionsFile (hoặc dùng -Check để kiểm tra key)." }
    if (-not (Test-Path -LiteralPath $QuestionsFile)) { Fail "Không thấy file questions: $QuestionsFile" }
    $questions = Get-Content -LiteralPath $QuestionsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $State -and -not $StateFile) { Fail "Thiếu -State hoặc -StateFile." }
    if ($StateFile) {
        if (-not (Test-Path -LiteralPath $StateFile)) { Fail "Không thấy state file: $StateFile" }
        $text = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8
        try { $State = $text | ConvertFrom-Json -ErrorAction Stop } catch { $State = $text }
    }
}

$body = [ordered]@{ state = $State; model = $Model; questions = $questions }
$json = $body | ConvertTo-Json -Depth 20 -Compress:$false

if ($DryRun) {
    Write-Host "== DRY RUN (không gọi mạng) ==" -ForegroundColor Cyan
    Write-Host "endpoint : $Endpoint"
    Write-Host "key      : $(Mask $ApiKey)  [nguồn: $keySource]"
    Write-Host "body     :"
    Write-Host $json
    exit 0
}

if (-not $ApiKey) {
    Fail @"
Chưa có TYPESAFE_API_KEY. Lấy key tại https://console.typesafe.ai/keys rồi chọn 1 cách:
  a) Thêm vào refs của $dshHome\.credentials.yaml:
         refs:
           TYPESAFE_API_KEY: <key>
     (KHÔNG commit key vào repo; plugin dsh-jev-verify cũng dùng đúng chỗ này)
  b) Hoặc set biến môi trường TYPESAFE_API_KEY cho phiên dsh.
  c) Hoặc truyền -ApiKey <key> (chỉ để thử, sẽ lộ trong lịch sử lệnh).
"@
}

# ---------- 3) gọi API ----------
$qCount = if ($questions -is [System.Collections.IDictionary]) { $questions.Count } else { @($questions.PSObject.Properties).Count }
Write-Host "JEV request: model=$Model, questions=$qCount, key=$(Mask $ApiKey) [$keySource]" -ForegroundColor DarkGray

# Log cục bộ mọi lần gọi: đối chiếu với dashboard console (vốn có thể trễ / khác org)
$logPath = Join-Path $dshHome 'storages\jev-calls.csv'
function Write-CallLog([int]$status, [string]$requestId, $respObj, [int]$q, [string]$err) {
    try {
        $inTok = if ($respObj) { [int]$respObj.usage.input_tokens } else { 0 }
        $outTok = if ($respObj) { [int]$respObj.usage.output_tokens } else { 0 }
        $cost = [math]::Round($inTok * 0.042 / 1000000, 8)   # $0.042 / 1M input token, output miễn phí
        $row = [pscustomobject]@{
            utc              = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            local            = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            status           = $status
            request_id       = $requestId
            model            = if ($respObj) { $respObj.model } else { '' }
            questions        = $q
            input_tokens     = $inTok
            output_tokens    = $outTok
            est_cost_usd     = $cost
            error            = $err
        }
        $dir = Split-Path -Parent $logPath
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        if (Test-Path -LiteralPath $logPath) { $row | Export-Csv -LiteralPath $logPath -Append -NoTypeInformation -Encoding UTF8 }
        else { $row | Export-Csv -LiteralPath $logPath -NoTypeInformation -Encoding UTF8 }
    } catch { }
}
$reqId = ''
try {
    $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -TimeoutSec $TimeoutSec `
        -Headers @{ Authorization = "Bearer $ApiKey"; 'User-Agent' = 'dsh-jev-client/1.0' } `
        -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) `
        -ResponseHeadersVariable respHdr
    if ($respHdr -and $respHdr['x-typesafe-request-id']) { $reqId = ($respHdr['x-typesafe-request-id'] -join '') }
    Write-CallLog -status 200 -requestId $reqId -respObj $resp -q $qCount -err ''
    if ($reqId) { Write-Host "request-id: $reqId   (log cục bộ: $logPath)" -ForegroundColor DarkGray }
} catch {
    $status = $null; $detail = $_.Exception.Message
    try { $status = [int]$_.Exception.Response.StatusCode } catch { }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    else {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $detail = $reader.ReadToEnd()
        } catch { }
    }
    Write-CallLog -status ([int]$status) -requestId '' -respObj $null -q $qCount -err $detail
    $hint = switch ($status) {
        401 { 'Key sai/hết hạn — kiểm tra lại ở console.typesafe.ai/keys.' }
        403 { 'Key không có quyền cho endpoint này.' }
        422 { 'Body sai định dạng — xem lại questions (noul/choice/score, criteria bắt buộc với choice/score).' }
        429 { 'Quá rate limit — chờ rồi thử lại.' }
        529 { 'TypeSafe đang quá tải — thử lại sau.' }
        default { 'Xem chi tiết bên dưới.' }
    }
    Fail "Gọi API thất bại (HTTP $status): $hint`n$detail" 1
}

# ---------- 4) in kết quả ----------
if ($Raw) { $resp | ConvertTo-Json -Depth 20 } else {
    Write-Host ""
    Write-Host "model: $($resp.model)   tokens: in=$($resp.usage.input_tokens) out=$($resp.usage.output_tokens)" -ForegroundColor DarkGray
    foreach ($p in $resp.answers.PSObject.Properties) {
        $a = $p.Value
        switch ($a.type) {
            'noul' { Write-Host ("  {0,-22} noul = {1}" -f $p.Name, $a.noul) }
            'choice' {
                $probs = ($a.probabilities.PSObject.Properties | Sort-Object { -$_.Value } | Select-Object -First 3 |
                    ForEach-Object { "$($_.Name)=$([math]::Round($_.Value,3))" }) -join ', '
                Write-Host ("  {0,-22} choice = {1}  (confidence {2}; top: {3})" -f $p.Name, $a.choice, [math]::Round($a.confidence, 3), $probs)
            }
            'score' {
                Write-Host ("  {0,-22} score = {1}  (confidence {2})" -f $p.Name, [math]::Round($a.score, 3), [math]::Round($a.confidence, 3))
            }
            default { Write-Host ("  {0,-22} {1}" -f $p.Name, ($a | ConvertTo-Json -Compress)) }
        }
    }
    Write-Host ""
    Write-Host "(JSON đầy đủ: thêm -Raw)" -ForegroundColor DarkGray
}
exit 0
