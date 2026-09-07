# DSH Vault — kích hoạt lại toàn bộ trên máy mới / sau cài lại.
# Chạy:  powershell -ExecutionPolicy Bypass -File D:\dsh\scripts\activate.ps1
#        (hoặc:  .\scripts\activate.ps1 -DshHome "C:\custom\.dsh" -Force)
param(
    [string]$DshHome = "",
    [switch]$Force
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot   # D:\dsh
if ($DshHome -eq "") { $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }
$profileDir = Join-Path $DshHome "profiles\web"
$agentsHome = Join-Path $env:USERPROFILE ".agents"
$skillsRoot = Join-Path $agentsHome "skills"

Write-Host "== DSH Vault activate ==" -ForegroundColor Cyan
Write-Host "Repo     : $repo"
Write-Host "DSH_HOME : $DshHome"
if (-not (Test-Path $profileDir)) {
    Write-Host "[!] Không thấy profile web: $profileDir — hãy chạy DSH web 1 lần trước." -ForegroundColor Yellow
    exit 1
}

# 1) Static plugin: dsh-skill-manager
$srcStatic = Join-Path $repo "plugins\dsh-skill-manager\static"
$dstPkg    = Join-Path $profileDir "node_modules\dsh-skill-manager"
if (Test-Path $srcStatic) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dstPkg) | Out-Null
    Copy-Item $srcStatic $dstPkg -Recurse -Force
    Write-Host "[1/3] Static plugin -> $dstPkg" -ForegroundColor Green
} else {
    Write-Host "[1/3] Bỏ qua (không có static): $srcStatic" -ForegroundColor Yellow
}

# 2) Loader row trong cordis.patch.yml (idempotent)
$patch = Join-Path $profileDir "cordis.patch.yml"
if (Test-Path $patch) {
    $content = Get-Content $patch -Raw -Encoding UTF8
    if ($content -notmatch "skillmgr-static") {
        if ($content.Trim() -eq '[]' -or $content.Trim() -eq '') {
            $block = @"
- insert:
    - id: skillmgr-static
      name: 'dsh-skill-manager'
"@
        } else {
            $block = "`n- insert:`n    - id: skillmgr-static`n      name: 'dsh-skill-manager'`n"
        }
        Add-Content -Path $patch -Value $block -Encoding UTF8
        Write-Host "[2/3] Đã thêm loader row vào cordis.patch.yml" -ForegroundColor Green
    } else {
        Write-Host "[2/3] cordis.patch.yml đã có skillmgr-static (bỏ qua)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "[2/3] Không thấy cordis.patch.yml — bỏ qua." -ForegroundColor Yellow
}

# 3) Skills company -> ~/.agents/skills (toàn máy)
$srcSkills = Join-Path $repo "skills\company"
if (Test-Path $srcSkills) {
    New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null
    $n = 0
    Get-ChildItem $srcSkills -Directory | ForEach-Object {
        $dst = Join-Path $skillsRoot $_.Name
        if ((Test-Path (Join-Path $dst "SKILL.md")) -and -not $Force) {
            Write-Host "[3/3] Bỏ qua (đã có): $($_.Name)" -ForegroundColor DarkGray
        } else {
            Copy-Item $_.FullName $dst -Recurse -Force
            Write-Host "[3/3] Skill -> ~/.agents/skills/$($_.Name)" -ForegroundColor Green
            $n++
        }
    }
} else {
    Write-Host "[3/3] Không có skills\company — bỏ qua." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== XONG phần tự động. Còn 3 việc tay ==" -ForegroundColor Cyan
Write-Host "1) Khởi động lại harness (plugin host tĩnh tự chạy; skill ⚡ đánh dấu sẽ tự kích hoạt nếu có file marker theo máy)."
Write-Host "2) Dựng lại UI 'Skill Manager' (plugin động theo session): mở hội thoại và nhắn agent:"
Write-Host "     Dựng lại plugin Skill Manager từ $repo\plugins\dsh-skill-manager\dynamic (đọc README, cordis_define + run)."
Write-Host "3) Kiểm tra danh mục skill ở hội thoại mới."
Write-Host ""
Write-Host "Rollback static: xoá '$dstPkg' và dòng insert skillmgr-static trong cordis.patch.yml rồi restart."
