$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Src       = 'C:\Users\QuyenLD\.dsh'
$Repo      = 'D:\dsh'
$Stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'
$Dest      = Join-Path $Repo "backup\dsh-backup-$Stamp"
$SecretDir = 'C:\Users\QuyenLD\.dsh-backup-secrets'

function New-Dir([string]$p) { if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null } }

New-Dir $Dest
New-Dir (Join-Path $Dest 'dsh-home\profiles\web\.dsh-market')
New-Dir (Join-Path $Dest 'dsh-home\profiles\web\.plugin-manager\logs')
New-Dir (Join-Path $Dest 'dsh-home\storages\cost-meter')
New-Dir (Join-Path $Dest 'dsh-home\storages\session_projcache\sessions')
New-Dir (Join-Path $Dest 'inventory')

# ---------- 1) fixed config files ----------
$rel = @(
    '.anonymous-user-id',
    'profiles\web\cordis.yml',
    'profiles\web\cordis.patch.yml',
    'profiles\web\package.json',
    'profiles\web\pnpm-lock.yaml',
    'profiles\web\pnpm-workspace.yaml',
    'profiles\web\.dsh-market\state.json',
    'profiles\web\.dsh-market\log.ndjson',
    'profiles\web\.dsh-market\discovery-compatibility-v1.json',
    'storages\workspace.json',
    'storages\cost-meter\ledger.json'
)
foreach ($r in $rel) {
    $s = Join-Path $Src $r
    $d = Join-Path (Join-Path $Dest 'dsh-home') $r
    if (Test-Path -LiteralPath $s) { New-Dir (Split-Path $d); Copy-Item -LiteralPath $s -Destination $d -Force }
    else { Write-Host "SKIP (missing): $r" -ForegroundColor Yellow }
}

# ---------- 2) session projection cache ----------
$proj = Join-Path $Src 'storages\session_projcache\sessions'
if (Test-Path -LiteralPath $proj) {
    Get-ChildItem -LiteralPath $proj -Filter *.json -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Dest 'dsh-home\storages\session_projcache\sessions') -Force
    }
}

# ---------- 3) plugin-manager operation logs ----------
$pmlogs = Join-Path $Src 'profiles\web\.plugin-manager\logs'
if (Test-Path -LiteralPath $pmlogs) {
    Get-ChildItem -LiteralPath $pmlogs -Directory | ForEach-Object {
        $out = Join-Path $Dest ('dsh-home\profiles\web\.plugin-manager\logs\' + $_.Name)
        New-Dir $out
        Get-ChildItem -LiteralPath $_.FullName -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $out -Force }
    }
}

# ---------- 4) credentials: redacted copy inside repo ----------
$credSrc = Join-Path $Src '.credentials.yaml'
$credRed = Join-Path $Dest 'dsh-home\credentials.redacted.yaml'
$section = ''
$refKeys = @()
$outLines = @()
$outLines += '# REDACTED COPY - gia tri that KHONG nam trong repo nay.'
foreach ($line in (Get-Content -LiteralPath $credSrc -Encoding UTF8)) {
    if ($line -match '^\S') {
        if ($line -match '^([A-Za-z0-9_.-]+)\s*:') { $section = $Matches[1] }
        $outLines += $line
        continue
    }
    $m = [regex]::Match($line, '^(\s+)([A-Za-z0-9_./-]+)\s*:\s*(.*)$')
    if (-not $m.Success) { $outLines += $line; continue }
    $indent = $m.Groups[1].Value; $key = $m.Groups[2].Value; $val = $m.Groups[3].Value
    $val = $val.Trim().Trim('"').Trim("'")
    $secretish = ($section -eq 'refs') -or ($key -match '(?i)^(secret|token|password|apiKey|api_key|key)$')
    if ($secretish -and $val.Length -gt 0 -and $val -notmatch '^<') {
        $sha = [System.BitConverter]::ToString((New-Object System.Security.Cryptography.SHA256Managed).ComputeHash([System.Text.Encoding]::UTF8.GetBytes($val))).Replace('-','').Substring(0,8).ToLower()
        $outLines += ('{0}{1}: "<REDACTED len={2} sha256={3}>"' -f $indent, $key, $val.Length, $sha)
        if ($section -eq 'refs') { $refKeys += $key }
    }
    else { $outLines += $line }
}
Set-Content -LiteralPath $credRed -Value $outLines -Encoding UTF8

# ---------- 5) credentials: real copy OUTSIDE the git repo ----------
New-Dir $SecretDir
$credReal = Join-Path $SecretDir ("credentials-$Stamp.yaml")
Copy-Item -LiteralPath $credSrc -Destination $credReal -Force

# ---------- 6) inventory ----------
$nm = Join-Path $Src 'profiles\web\node_modules'
$lines = @()
if (Test-Path -LiteralPath $nm) {
    Get-ChildItem -LiteralPath $nm -Directory -Force | Where-Object { $_.Name -notlike '.*' } | ForEach-Object {
        $pkgs = @()
        if ($_.Name -like '@*') { $pkgs = Get-ChildItem -LiteralPath $_.FullName -Directory -Force }
        else { $pkgs = @($_) }
        foreach ($p in $pkgs) {
            $pj = Join-Path $p.FullName 'package.json'
            if (Test-Path -LiteralPath $pj) {
                try { $j = Get-Content -LiteralPath $pj -Raw | ConvertFrom-Json; $lines += ("{0}@{1}" -f $j.name, $j.version) } catch { }
            }
        }
    }
}
$lines = $lines | Sort-Object -Unique
Set-Content -LiteralPath (Join-Path $Dest 'inventory\installed-packages.txt') -Value $lines -Encoding UTF8

$rt = @()
$rt += "backup_stamp            : $Stamp"
$rt += "dsh_home               : $Src"
$rt += "dsh_profile            : $env:DSH_PROFILE"
$rt += "dsh_profile_dir        : $env:DSH_PROFILE_DIR"
$rt += "dsh_web_url            : $env:DSH_WEB_URL"
$rt += "dsh_cli_version        : " + ((Get-Content 'C:\Users\QuyenLD\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\package.json' -Raw | ConvertFrom-Json).version)
$rt += "npx_checkout           : C:\Users\QuyenLD\AppData\Local\npm-cache\_npx\1e7f6d9597241db0"
$rt += "node                   : " + (& node --version)
$rt += "pnpm                   : " + (& pnpm --version)
$rt += "npm                    : " + (& npm --version)
$rt += "os                     : " + [System.Environment]::OSVersion.VersionString
$rt += "credentials_refs       : " + ($refKeys -join ', ')
$rt += "credentials_real_copy  : $credReal"
Set-Content -LiteralPath (Join-Path $Dest 'inventory\runtime.txt') -Value $rt -Encoding UTF8

$pkgsrc = Join-Path $Src 'profiles\web\package.json'
Set-Content -LiteralPath (Join-Path $Dest 'inventory\profile-package.json') -Value (Get-Content -LiteralPath $pkgsrc -Raw -Encoding UTF8) -Encoding UTF8

# ---------- 7) manifest with hashes ----------
$files = Get-ChildItem -LiteralPath $Dest -Recurse -File | Where-Object { $_.Name -ne 'MANIFEST.json' }
$man = @()
foreach ($f in $files) {
    $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLower()
    $man += [pscustomobject]@{
        path   = $f.FullName.Substring($Dest.Length + 1)
        bytes  = $f.Length
        sha256 = $h
    }
}
$manifestObj = [pscustomobject]@{
    createdAt        = (Get-Date).ToString('o')
    source           = $Src
    dshProfile       = $env:DSH_PROFILE
    dshCliVersion    = ($rt | Where-Object { $_ -like 'dsh_cli_version*' })
    credentialsNote  = "credentials.redacted.yaml = masked copy; real file copied to $credReal (outside git repo)"
    fileCount        = $man.Count
    files            = $man
}
$manifestObj | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Dest 'MANIFEST.json') -Encoding UTF8

Write-Host ""
Write-Host "BACKUP_DIR=$Dest"
Write-Host "SECRETS_COPY=$credReal"
Write-Host "FILE_COUNT=$($man.Count)"
Write-Host "TOTAL_BYTES=$((Get-ChildItem -LiteralPath $Dest -Recurse -File | Measure-Object Length -Sum).Sum)"
