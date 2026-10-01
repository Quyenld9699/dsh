#Requires -Version 7.0
<#
.SYNOPSIS
  Cài plugin market vào một dsh profile CÓ RÀO CHẮN: kiểm tra trước, chụp ảnh cấu hình,
  cài, soi lại bằng chính hàm kiểm tra của dsh, và tự rollback nếu profile sẽ không bật được.

.DESCRIPTION
  Vì sao cần: dsh chỉ kiểm tra tương thích plugin lúc KHỞI ĐỘNG. Cài xong mà profile hỏng thì
  lần bật sau mới biết. Script này chạy preflight của dsh TRƯỚC khi bạn restart:

    1. Preflight registry : soi dependency cứng của gói định cài (cái mà dsh/plugin-manager KHÔNG soi).
                            Gặp dependency trỏ vào dòng @deepseek-ai/dsh-* cũ hơn runtime -> DỪNG.
    2. Snapshot           : sao lưu package.json / pnpm-lock.yaml / pnpm-workspace.yaml / cordis.*.yml.
    3. Cài                : dsh plugin --profile <p> add <gói>.
    4. Hậu kiểm          : dựng lại preflight trên chính profile, dùng evaluatePluginCompatibility()
                            của dsh -> nếu có row sẽ bị disable thì ROLLBACK ngay (khôi phục file +
                            pnpm install lại) và xác nhận profile đã lành.

.PARAMETER Package
  Gói cần cài, vd: dsh-jev-verify  hoặc  dsh-jev-verify@0.7.4

.PARAMETER PinRuntimeTools
  Ghim @deepseek-ai/dsh-tools về đúng bản của dsh runtime bằng pnpm `overrides`.
  Đây là cách đã được kiểm chứng để cài dsh-jev-verify mà web vẫn bật được
  (plugin chỉ dùng đúng một API: defineTool, có ở cả 0.1.5-rc.2 và 0.2.0-rc.2).

.PARAMETER OverridePin
  Ghim tuỳ ý, dạng 'tên-gói@phiên-bản' (lặp được nhiều lần).

.PARAMETER CheckOnly
  Chỉ chạy preflight + hậu kiểm profile hiện tại, không cài gì.

.PARAMETER Force
  Bỏ qua cảnh báo preflight (KHÔNG khuyến nghị).

.EXAMPLE
  # Xem trước, không thay đổi gì
  D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -CheckOnly

.EXAMPLE
  # Cài có ghim dsh-tools về bản runtime (đã kiểm chứng boot được)
  D:\dsh\scripts\jev-safe-install.ps1 dsh-jev-verify -PinRuntimeTools
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory, Position = 0)][string]$Package,
    [string]$Profile = 'web',
    [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
    [string]$BackupRoot = 'D:\dsh\backup',
    [switch]$PinRuntimeTools,
    [string[]]$OverridePin = @(),
    [switch]$CheckOnly,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Checker = Join-Path $PSScriptRoot 'dsh-peer-check.mjs'
if (-not (Test-Path -LiteralPath $Checker)) { throw "Không thấy $Checker (đặt cạnh script này)." }

function Say([string]$m) { Write-Host $m }
function Die([string]$m) { Write-Host "DỪNG: $m" -ForegroundColor Red; exit 2 }

# ---------- 0) môi trường ----------
$profileDir = Join-Path $DshHome "profiles\$Profile"
if (-not (Test-Path -LiteralPath (Join-Path $profileDir 'package.json'))) { Die "Không thấy profile '$Profile' tại $profileDir" }
$env:DSH_HOME = $DshHome
$dshVersion = (& dsh --version) 2>$null | Select-Object -First 1
if (-not $dshVersion) { Die "Không gọi được 'dsh --version'." }
$dshVersion = $dshVersion.Trim()

$appBoot = $null
foreach ($candidate in @(
        (Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx\*\node_modules\@deepseek-ai\dsh-app-boot\lib\index.js" -ErrorAction SilentlyContinue)
        (Join-Path (npm root -g) '@deepseek-ai\dsh-app-boot\lib\index.js')
    ) | Where-Object { $_ }) {
    $p = if ($candidate -is [System.IO.FileInfo]) { $candidate.FullName } else { $candidate }
    if (-not (Test-Path -LiteralPath $p)) { continue }
    if ((Get-Content -LiteralPath (Join-Path (Split-Path $p) '..\package.json') -Raw | ConvertFrom-Json).version -eq $dshVersion) { $appBoot = $p; break }
}
if (-not $appBoot) { Die "Không tìm thấy @deepseek-ai/dsh-app-boot@$dshVersion để soi tương thích." }

Say "dsh runtime : $dshVersion"
Say "DSH_HOME    : $DshHome"
Say "profile     : $Profile  ($profileDir)"
Say "gói định cài: $Package"
Say ""

function Invoke-PeerCheck([string]$targetProfileDir, [switch]$Json) {
    $dump = & dsh --profile $Profile --dump-config 2>&1
    $rows = New-Object System.Collections.Generic.List[object]
    $layer = '(unknown)'; $cur = $null
    foreach ($line in $dump) {
        if ($line -match '^#\s*==\s*(.+?)\s*$') { $layer = ($Matches[1] -replace ',\s*patched by.*$', '').Trim(); continue }
        if ($line -match '^\s*-\s+id:\s*(.+?)\s*$') { if ($cur) { $rows.Add($cur) }; $cur = [pscustomobject]@{ id = $Matches[1].Trim("'"); name = $null; layer = $layer; disabled = $false }; continue }
        if ($line -match '^\s*-\s+name:\s*(.+?)\s*$') { if ($cur) { $rows.Add($cur) }; $cur = [pscustomobject]@{ id = $null; name = $Matches[1].Trim("'"); layer = $layer; disabled = $false }; continue }
        if ($cur -and $line -match '^\s+name:\s*(.+?)\s*$') { $cur.name = $Matches[1].Trim("'"); continue }
        if ($cur -and $line -match '^\s+disabled:\s*true\s*$') { $cur.disabled = $true; continue }
    }
    if ($cur) { $rows.Add($cur) }
    $rowsFile = Join-Path ([System.IO.Path]::GetTempPath()) ("peercheck-rows-$([guid]::NewGuid().ToString('N')).json")
    $rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $rowsFile -Encoding UTF8
    $nodeArgs = @($Checker, '--app-boot', $appBoot, '--profile', $targetProfileDir, '--rows', $rowsFile)
    if ($Json) { $nodeArgs += '--json' }
    $out = & node @nodeArgs 2>&1
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $rowsFile -Force -ErrorAction SilentlyContinue
    return [pscustomobject]@{ exit = $code; output = $out }
}

# ---------- 1) preflight registry: dependency cứng của gói định cài ----------
Say "[1/5] Preflight gói định cài (dependency + peer của chính gói đó)"
$spec = if ($Package -match '@') { $Package } else { "$Package@latest" }
$manifestFile = Join-Path ([System.IO.Path]::GetTempPath()) ("pkg-$([guid]::NewGuid().ToString('N')).json")
& npm view $spec dependencies peerDependencies version name --json 2>$null | Set-Content -LiteralPath $manifestFile -Encoding UTF8
if (-not (Test-Path -LiteralPath $manifestFile)) { Die "npm view $spec không trả về gì." }
$depCheck = & node $Checker --app-boot $appBoot --mode deps --manifest $manifestFile 2>&1
$depExit = $LASTEXITCODE
$depCheck | Where-Object { $_ -match 'HARD-FAIL|KẾT LUẬN' } | ForEach-Object { Say "    $_" }
$pinList = @($OverridePin)
if ($PinRuntimeTools) { $pinList += "@deepseek-ai/dsh-tools@$dshVersion" }
$pinList = $pinList | Where-Object { $_ } | Select-Object -Unique
if ($depExit -ne 0) {
    if ($pinList.Count -eq 0 -and -not $Force) {
        Say ""
        Say "    Gói này kéo theo dependency @deepseek-ai/dsh-* của dòng CŨ. Cài vào profile sẽ để lại" -ForegroundColor Yellow
        Say "    bản cũ trong node_modules và dsh sẽ disable row tương ứng ở lần khởi động sau." -ForegroundColor Yellow
        Say "    Chọn một trong các cách:" -ForegroundColor Yellow
        Say "      a) -PinRuntimeTools      : ghim @deepseek-ai/dsh-tools về $dshVersion (đã kiểm chứng boot được)"
        Say "      b) đổi sang plugin khác đã tương thích (vd: dsh-jev-tools, dsh-jev-decide)"
        Say "      c) chờ tác giả plugin cập nhật lên dòng 0.2.x"
        Remove-Item -LiteralPath $manifestFile -Force -ErrorAction SilentlyContinue
        exit 2
    }
    Say "    (tiếp tục vì có -PinRuntimeTools/-OverridePin hoặc -Force)" -ForegroundColor Yellow
}
Remove-Item -LiteralPath $manifestFile -Force -ErrorAction SilentlyContinue

# ---------- 2) hậu kiểm TRƯỚC khi cài (mốc so sánh) ----------
Say "[2/5] Hậu kiểm profile hiện tại (mốc trước khi cài)"
$before = Invoke-PeerCheck $profileDir
$before | Select-Object -ExpandProperty output | Where-Object { $_ -match 'KẾT LUẬN|DENY|SHADOW' } | ForEach-Object { Say "    $_" }
if ($before.exit -ne 0) {
    if ($pinList.Count -gt 0) {
        Say "    Profile đang KHÔNG lành (DENY ở trên) — có ghim runtime nên tiếp tục ở CHẾ ĐỘ SỬA:" -ForegroundColor Yellow
        Say "    ghim lại dependency rồi resolve lại cây, sau đó hậu kiểm (có snapshot + tự rollback)." -ForegroundColor Yellow
    } else {
        Die "Profile ĐANG không lành (xem DENY ở trên) — sửa trước khi cài thêm gì (hoặc dùng -PinRuntimeTools để sửa)."
    }
}
if ($CheckOnly) {
    Say ""
    Say "CheckOnly: dừng ở đây, không cài gì."
    Say "Kết luận preflight: $(if ($depExit -eq 0) { 'gói tương thích, cài được không cần ghim' } else { "gói kéo dependency cũ -> phải dùng -PinRuntimeTools (hoặc bỏ qua rủi ro bằng -Force)" })"
    exit $(if ($depExit -eq 0) { 0 } else { 1 })
}

# ---------- 3) snapshot ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$snap = Join-Path $BackupRoot "pre-plugin-$stamp"
New-Item -ItemType Directory -Force -Path (Join-Path $snap "profiles\$Profile") | Out-Null
$files = @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.yml', 'cordis.patch.yml', 'compatibility.json')
foreach ($f in $files) {
    $src = Join-Path $profileDir $f
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $snap "profiles\$Profile\$f") -Force }
}
$nmTools = Join-Path $profileDir 'node_modules\@deepseek-ai'
if (Test-Path -LiteralPath $nmTools) {
    Get-ChildItem -LiteralPath $nmTools -Force | ForEach-Object {
        $pj = Join-Path $_.FullName 'package.json'
        if (Test-Path -LiteralPath $pj) { "{0}@{1}" -f (Get-Content $pj -Raw | ConvertFrom-Json).name, (Get-Content $pj -Raw | ConvertFrom-Json).version }
    } | Set-Content -LiteralPath (Join-Path $snap 'node_modules-deepseek-before.txt') -Encoding UTF8
    Get-ChildItem -LiteralPath $nmTools -Force -Recurse -Depth 1 | Select-Object -ExpandProperty FullName |
        Set-Content -LiteralPath (Join-Path $snap 'node_modules-deepseek-paths.txt') -Encoding UTF8
}
# Danh sách gói top-level TRƯỚC khi cài: dùng để rollback xoá đúng những gói mới xuất hiện
$nmRoot = Join-Path $profileDir 'node_modules'
if (Test-Path -LiteralPath $nmRoot) {
    $beforePkgs = New-Object System.Collections.Generic.List[string]
    Get-ChildItem -LiteralPath $nmRoot -Force | Where-Object { $_.Name -notlike '.*' } | ForEach-Object {
        if ($_.Name -like '@*') {
            Get-ChildItem -LiteralPath $_.FullName -Force | ForEach-Object { $beforePkgs.Add("$($_.Parent.Name)/$($_.Name)") }
        } else { $beforePkgs.Add($_.Name) }
    }
    $beforePkgs | Sort-Object -Unique | Set-Content -LiteralPath (Join-Path $snap 'node_modules-before.txt') -Encoding UTF8
}
$before.output | Set-Content -LiteralPath (Join-Path $snap 'peercheck-before.txt') -Encoding UTF8
Say "[3/5] Snapshot: $snap"

# ---------- 4) ghim (nếu có) rồi cài ----------
$workspaceFile = Join-Path $profileDir 'pnpm-workspace.yaml'
$pinned = $false
if ($pinList.Count -gt 0) {
    if ($PSCmdlet.ShouldProcess($workspaceFile, "thêm pnpm overrides cho $($pinList -join ', ')")) {
        $text = Get-Content -LiteralPath $workspaceFile -Raw
        $block = "`noverrides:`n" + (($pinList | ForEach-Object { $parts = $_ -split '@(?=[^@]+$)'; "  '$($parts[0])': $($parts[1])" }) -join "`n") + "`n"
        Add-Content -LiteralPath $workspaceFile -Value $block -Encoding UTF8
        Say "[4/5] Đã ghim: $($pinList -join ', ')"
        $pinned = $true
    }
}
$installOut = $null
if ($PSCmdlet.ShouldProcess("profile $Profile", "dsh plugin add $Package")) {
    Say "[4/5] Cài: dsh plugin --profile $Profile add $Package"
    $installOut = & dsh plugin --profile $Profile add $Package 2>&1
    $installCode = $LASTEXITCODE
    $installOut | Select-Object -Last 8 | ForEach-Object { Say "    $_" }
    if ($installCode -ne 0) { Say "    (lệnh cài trả về mã $installCode — vẫn kiểm tra trạng thái profile)" -ForegroundColor Yellow }
}

# ---------- 5) hậu kiểm + rollback ----------
Say "[5/5] Hậu kiểm profile sau khi cài"
$after = Invoke-PeerCheck $profileDir
$after | Select-Object -ExpandProperty output | Where-Object { $_ -match 'KẾT LUẬN|DENY|SHADOW' } | ForEach-Object { Say "    $_" }
$shadowRows = @()
if ($after.exit -eq 0) {
    $json = Invoke-PeerCheck $profileDir -Json
    try { $shadowRows = ($json.output | Out-String | ConvertFrom-Json).shadows } catch { }
}
$unsafe = $after.exit -ne 0 -or ($shadowRows.Count -gt 0 -and -not $pinned)
if ($unsafe) {
    Say ""
    Say "Profile sẽ KHÔNG bật được (hoặc nạp bản bị shadow) -> ROLLBACK." -ForegroundColor Yellow
    foreach ($f in $files) {
        $bak = Join-Path $snap "profiles\$Profile\$f"
        $dst = Join-Path $profileDir $f
        if (Test-Path -LiteralPath $bak) { Copy-Item -LiteralPath $bak -Destination $dst -Force }
        elseif (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
    }
    # Xoá đúng những gói đã xuất hiện thêm: đây chính là bản bị hoist gây shadow row của dsh.
    # (pnpm install một mình có thể in "Already up to date" và KHÔNG prune — đã gặp thật.)
    $beforeFile = Join-Path $snap 'node_modules-before.txt'
    if ((Test-Path -LiteralPath $beforeFile) -and (Test-Path -LiteralPath $nmRoot)) {
        $beforeSet = @(Get-Content -LiteralPath $beforeFile)
        $added = New-Object System.Collections.Generic.List[string]
        Get-ChildItem -LiteralPath $nmRoot -Force | Where-Object { $_.Name -notlike '.*' } | ForEach-Object {
            if ($_.Name -like '@*') {
                Get-ChildItem -LiteralPath $_.FullName -Force | Where-Object { $beforeSet -notcontains "$($_.Parent.Name)/$($_.Name)" } |
                    ForEach-Object { $added.Add($_.FullName) }
            } elseif ($beforeSet -notcontains $_.Name) { $added.Add($_.FullName) }
        }
        foreach ($p in $added) {
            Say "    xoá gói mới thêm: $($p.Replace($profileDir, ''))"
            Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    # Trường hợp plugin đã cài từ trước (trạng thái hỏng có sẵn, không nằm trong diff trên):
    # xoá mọi @deepseek-ai/dsh-* trong profile KHÁC bản runtime — đúng tập gây shadow row.
    $nmDeep = Join-Path $nmRoot '@deepseek-ai'
    if (Test-Path -LiteralPath $nmDeep) {
        Get-ChildItem -LiteralPath $nmDeep -Force -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $pj = Join-Path $_.FullName 'package.json'
            if (-not (Test-Path -LiteralPath $pj)) { return }
            try { $m = Get-Content -LiteralPath $pj -Raw | ConvertFrom-Json } catch { return }
            if ($m.name -like '@deepseek-ai/dsh-*' -and $m.version -ne $dshVersion) {
                Say "    xoá bản lệch runtime: $($_.Name)@$($m.version) (runtime $dshVersion)"
                Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Push-Location $profileDir
    & pnpm install --no-frozen-lockfile --force 2>&1 | Select-Object -Last 3 | ForEach-Object { Say "    $_" }
    Pop-Location
    $restored = Invoke-PeerCheck $profileDir
    $restored | Select-Object -ExpandProperty output | Where-Object { $_ -match 'KẾT LUẬN|DENY|SHADOW' } | ForEach-Object { Say "    $_" }
    $after.output | Set-Content -LiteralPath (Join-Path $snap 'peercheck-after.txt') -Encoding UTF8
    if ($restored.exit -eq 0) {
        Say ""
        Say "ĐÃ ROLLBACK XONG — profile lành lại, không cần restart để 'cứu'." -ForegroundColor Green
        Say "Snapshot để đối chiếu: $snap"
        exit 3
    }
    Say "ROLLBACK CHƯA LÀNH — làm tay theo README trong $snap, hoặc dùng 'dsh rescue --from-default-profile web'." -ForegroundColor Red
    exit 4
}

$after.output | Set-Content -LiteralPath (Join-Path $snap 'peercheck-after.txt') -Encoding UTF8
Say ""
Say "OK — preflight của dsh không từ chối row nào." -ForegroundColor Green
if ($pinned) { Say "Đã ghim: $($pinList -join ', ') (có trong $snap nếu cần bỏ)." }
Say "Nhớ: restart dsh (hoặc GUI sẽ tự nạp nếu profile có patchReload live) rồi kiểm tra tool thật."
Say "Với JEV còn cần TYPESAFE_API_KEY trong refs của $DshHome\.credentials.yaml (không commit key)."
Say "Snapshot: $snap"
