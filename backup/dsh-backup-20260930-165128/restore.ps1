#Requires -Version 7.0
<#
    restore.ps1 — phục hồi cấu hình DSH từ backup này.

    Ví dụ:
      .\restore.ps1 -WhatIf                      # xem trước, không ghi gì
      .\restore.ps1                              # phục hồi config profile web
      .\restore.ps1 -IncludeStorages             # thêm workspace.json / cost-meter / projcache
      .\restore.ps1 -SecretsFile C:\Users\QuyenLD\.dsh-backup-secrets\credentials-XXXX.yaml
      .\restore.ps1 -SkipVerify -Force           # bỏ kiểm tra SHA256 và ghi đè dù lệch

    Mọi file bị ghi đè đều được đổi tên thành "<tên>.bak-<timestamp>" trước, không mất dữ liệu cũ.
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [string] $BackupDir = $PSScriptRoot,
    [string] $DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
    [string] $SecretsFile = '',
    [switch] $IncludeStorages,
    [switch] $SkipVerify,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$src   = Join-Path $BackupDir 'dsh-home'

Write-Host "Backup   : $BackupDir"
Write-Host "DSH_HOME : $DshHome"
Write-Host ""

if (-not (Test-Path -LiteralPath $src)) { throw "Không thấy '$src' — BackupDir không đúng?" }
if (-not $Force -and -not $SkipVerify) {
    $mf = Join-Path $BackupDir 'MANIFEST.json'
    if (Test-Path -LiteralPath $mf) {
        $bad = @()
        foreach ($f in (Get-Content -LiteralPath $mf -Raw | ConvertFrom-Json).files) {
            $p = Join-Path $BackupDir $f.path
            if (-not (Test-Path -LiteralPath $p)) { $bad += "MISSING: $($f.path)"; continue }
            $h = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower()
            if ($h -ne $f.sha256) { $bad += "MISMATCH: $($f.path)" }
        }
        if ($bad.Count -gt 0) {
            $bad | ForEach-Object { Write-Warning $_ }
            throw "Backup lệch hash. Dừng lại (dùng -SkipVerify hoặc -Force nếu bạn chủ ý sửa file backup)."
        }
        Write-Host "SHA256: OK (không lệch file nào)"
    }
    else { Write-Warning "Không có MANIFEST.json — bỏ qua kiểm tra toàn vẹn." }
}
Write-Host ""

function Copy-WithBackup {
    [CmdletBinding(SupportsShouldProcess)]
    param([string]$From, [string]$To)
    $dir = Split-Path -Parent $To
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    if (Test-Path -LiteralPath $To) {
        if ($PSCmdlet.ShouldProcess($To, "đổi tên bản cũ thành .bak-$stamp rồi ghi đè")) {
            Move-Item -LiteralPath $To -Destination "$To.bak-$stamp" -Force
        } else { return }
    }
    if ($PSCmdlet.ShouldProcess($To, 'ghi đè từ backup')) {
        Copy-Item -LiteralPath $From -Destination $To -Force
        Write-Host "  -> $To"
    }
}

# ---- config profile (.anonymous-user-id + profiles\web\**) ----
Write-Host "[1/3] Config profile:"
$files = Get-ChildItem -LiteralPath $src -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    if ($rel -like 'storages\*') { return $false }
    if ($rel -eq 'credentials.redacted.yaml') { return $false }
    return $true
}
if ($IncludeStorages) {
    $files += Get-ChildItem -LiteralPath (Join-Path $src 'storages') -Recurse -File -ErrorAction SilentlyContinue
}
foreach ($f in $files) {
    $rel = $f.FullName.Substring($src.Length + 1)
    Copy-WithBackup $f.FullName (Join-Path $DshHome $rel)
}

# ---- credentials thật ----
Write-Host ""
Write-Host "[2/3] Credentials:"
if ($SecretsFile) {
    if (-not (Test-Path -LiteralPath $SecretsFile)) { throw "Không thấy SecretsFile: $SecretsFile" }
    Copy-WithBackup $SecretsFile (Join-Path $DshHome '.credentials.yaml')
} else {
    Write-Host "  (bỏ qua) Chưa truyền -SecretsFile. Bản thật nằm ở C:\Users\QuyenLD\.dsh-backup-secrets\."
    Write-Host "  Key đã che có trong $src\credentials.redacted.yaml để đối chiếu tên key."
}

# ---- bước sau ----
Write-Host ""
Write-Host "[3/3] Xong. Bước tiếp theo:"
Write-Host "  cd `"$DshHome\profiles\web`"; pnpm install"
Write-Host "  npx @deepseek-ai/dsh web"
Write-Host ""
Write-Host "Nếu plugin không hiện: Settings -> Plugin Market (hoặc 'dsh plugin --profile web list')."
