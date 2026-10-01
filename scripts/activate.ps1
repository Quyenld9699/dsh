# DSH Vault — kích hoạt lại trên máy mới / sau cài lại.
# Chạy:  powershell -ExecutionPolicy Bypass -File D:\dsh\scripts\activate.ps1
#        (hoặc:  .\scripts\activate.ps1 -DshHome "C:\custom\.dsh")
param(
    [string]$DshHome = ""
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot   # D:\dsh
if ($DshHome -eq "") { $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }
$profileDir = Join-Path $DshHome "profiles\web"
$profilePkg = Join-Path $profileDir "package.json"

Write-Host "== DSH Vault activate ==" -ForegroundColor Cyan
Write-Host "Repo     : $repo"
Write-Host "DSH_HOME : $DshHome"
if (-not (Test-Path $profileDir)) {
    Write-Host "[!] Không thấy profile web: $profileDir — hãy chạy DSH web 1 lần trước." -ForegroundColor Yellow
    exit 1
}

# Đọc profile package.json 1 lần
$pkgText = if (Test-Path $profilePkg) { Get-Content $profilePkg -Raw -Encoding UTF8 } else { "" }

# 1) Skill Center (plugin market có sẵn, KHÔNG thuộc vault này)
if ($pkgText -match 'dsh-client-ui-skill-explorer') {
    Write-Host "[1/3] Skill Center đã có trong profile (dsh-client-ui-skill-explorer)." -ForegroundColor Green
} else {
    Write-Host "[1/3] Chưa thấy Skill Center — cài qua Plugin Market (dshmarket) rồi restart harness." -ForegroundColor Yellow
}

# 2) Plugin Jev (TypeSafe) — dsh-jev-verify từ market/npm
#    QUAN TRỌNG: mọi bản dsh-jev-verify (0.2.0…0.7.4) ghim cứng @deepseek-ai/dsh-tools@0.1.5-rc.2.
#    Cài thẳng bằng 'dsh plugin add' sẽ làm row "tools" bị disable và dsh KHÔNG bật được web.
#    Vì vậy luôn đi qua guard + ghim dsh-tools về đúng bản runtime. Chi tiết: D:\dsh\backup\JEV-RCA.md
$guard = Join-Path $PSScriptRoot 'jev-safe-install.ps1'
$runtimeVer = ""
try { $runtimeVer = (& dsh --version) 2>$null | Select-Object -First 1 } catch { }
$toolsManifest = Join-Path $profileDir "node_modules\@deepseek-ai\dsh-tools\package.json"
$toolsVer = if (Test-Path $toolsManifest) { (Get-Content $toolsManifest -Raw | ConvertFrom-Json).version } else { "" }
$toolsOk = ($toolsVer -eq "") -or ($runtimeVer -ne "" -and $toolsVer -eq $runtimeVer)
if ($pkgText -match 'dsh-jev-verify') {
    Write-Host "[2/3] dsh-jev-verify đã có trong profile (dependencies/bundles)." -ForegroundColor Green
    if (-not $toolsOk -and (Test-Path $guard)) {
        Write-Host "[2/3] CẢNH BÁO: profile đang có @deepseek-ai/dsh-tools=$toolsVer, runtime=$runtimeVer" -ForegroundColor Yellow
        Write-Host "[2/3] Hậu kiểm tương thích bằng preflight của dsh..." -ForegroundColor Cyan
        & $guard dsh-jev-verify -PinRuntimeTools -CheckOnly
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[!] Profile sẽ KHÔNG bật được. Chạy: D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools" -ForegroundColor Red
        }
    }
} else {
    if (Test-Path $guard) {
        Write-Host "[2/3] Cài dsh-jev-verify qua guard (tự ghim @deepseek-ai/dsh-tools về $runtimeVer)..." -ForegroundColor Cyan
        & $guard dsh-jev-verify -PinRuntimeTools
        Write-Host "[2/3] Guard exit $LASTEXITCODE — 0 = cài an toàn, 3 = đã tự rollback (profile vẫn lành)." -ForegroundColor Green
    } else {
        Write-Host "[2/3] Không thấy $guard — KHÔNG cài thẳng (sẽ làm hỏng profile)." -ForegroundColor Red
        Write-Host "      Chạy tay: dsh plugin --profile web add dsh-jev-verify  + thêm vào" -ForegroundColor DarkGray
        Write-Host "      $profileDir\pnpm-workspace.yaml:  overrides: '@deepseek-ai/dsh-tools': $runtimeVer" -ForegroundColor DarkGray
    }
}

# 3) Skill GLOBAL — backup là manifest (không có thư mục skill trong vault)
$srcSkills = Join-Path $repo "skills"
if (Test-Path (Join-Path $srcSkills "manifest.json")) {
    Write-Host "[3/3] Backup skill global = manifest: $srcSkills\manifest.json" -ForegroundColor Green
    Write-Host "      Restore: nhờ agent cài lại theo manifest (clone repo đúng ref, copy skill vào ~/.agents/skills)." -ForegroundColor DarkGray
} else {
    Write-Host "[3/3] Không có skills\manifest.json — bỏ qua." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== XONG phần tự động. Việc tay còn lại ==" -ForegroundColor Cyan
Write-Host "1) TypeSafe key cho Jev — thêm vào mục refs của $DshHome\.credentials.yaml:"
Write-Host "     TYPESAFE_API_KEY: <key>      (hoặc nhập trong Settings -> Plugins -> Plugin configuration -> Jev)"
Write-Host "2) Khởi động DSH web (nếu chưa chạy)."
Write-Host "3) Nhờ agent restore skill global:  'Đọc D:\dsh\skills\manifest.json và cài lại các skill global theo install của từng source.'"
Write-Host "4) Kiểm tra: hỏi agent 'chạy jev_verify' (benchmark 27 câu) hoặc 'jev_overview' để xem trạng thái Jev."
