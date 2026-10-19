<#
.SYNOPSIS
  把 dsh-skill-panel 装进 DSH profile：依赖 + dsh.profile.bundles + cordis.patch.yml 插入项 + node_modules 链接。
  如果检测到旧名 dsh-session-skills，会自动迁移（删掉旧条目），不会出现两条「技能」。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Profile desktop
#>
[CmdletBinding()]
param(
  [string]$Profile = '',
  [string]$ProfileDir = '',
  [string]$PackageDir = ''
)

$ErrorActionPreference = 'Stop'
$pkgName = 'dsh-skill-panel'
$oldName = 'dsh-session-skills'
$nl = [char]10
$repoRoot = if ($PackageDir) { (Resolve-Path $PackageDir).Path } elseif ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

function Write-Utf8NoBom {
  param([string]$Path, [string]$Text)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Resolve-ProfileDir {
  param([string]$Name, [string]$Dir)
  if ($Dir) {
    if (-not (Test-Path $Dir)) { throw ('profile 目录不存在：' + $Dir) }
    return (Resolve-Path $Dir).Path
  }
  $root = Join-Path $env:USERPROFILE '.dsh\profiles'
  if (-not (Test-Path $root)) { throw ('找不到 DSH profile 目录：' + $root + '（先启动一次 DSH）') }
  if ($Name) {
    $p = Join-Path $root $Name
    if (-not (Test-Path $p)) { throw ('profile 不存在：' + $p) }
    return $p
  }
  $cands = Get-ChildItem $root -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'cordis.patch.yml') }
  if (-not $cands) { throw ($root + ' 下没有可用的 profile（缺 cordis.patch.yml）') }
  if ($cands.Count -eq 1) { return $cands[0].FullName }
  throw ('有多个 profile：' + (($cands | ForEach-Object { $_.Name }) -join ', ') + '。请用 -Profile 指定一个。')
}

$profileDir = Resolve-ProfileDir $Profile $ProfileDir
$pjPath = Join-Path $profileDir 'package.json'
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$nmDir = Join-Path $profileDir 'node_modules'
if (-not (Test-Path $pjPath)) { throw ('缺少 ' + $pjPath) }
if (-not (Test-Path $patchPath)) { throw ('缺少 ' + $patchPath) }

Write-Host ('profile: ' + $profileDir)
Write-Host ('package: ' + $repoRoot)
Copy-Item $pjPath ($pjPath + '.bak') -Force
Copy-Item $patchPath ($patchPath + '.bak') -Force

# 1) 依赖（顺便删掉旧名）
$pj = Get-Content $pjPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $pj.PSObject.Properties['dependencies']) { $pj | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force }
if ($pj.dependencies.PSObject.Properties[$oldName]) {
  $pj.dependencies.PSObject.Properties.Remove($oldName)
  Write-Host ('已移除旧依赖 ' + $oldName)
}
$linkTarget = $repoRoot -replace '\\', '/'
$pj.dependencies | Add-Member -NotePropertyName $pkgName -NotePropertyValue ('link:' + $linkTarget) -Force

# 2) dsh.profile.bundles
if (-not $pj.PSObject.Properties['dsh']) { $pj | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force }
if (-not $pj.dsh.PSObject.Properties['profile']) { $pj.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force }
if (-not $pj.dsh.profile.PSObject.Properties['bundles']) { $pj.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @() -Force }
$bundles = @($pj.dsh.profile.bundles) | Where-Object { $_ -ne $oldName }
if ($bundles -notcontains $pkgName) { $bundles = @($bundles) + $pkgName }
$pj.dsh.profile.bundles = @($bundles)
Write-Utf8NoBom $pjPath ($pj | ConvertTo-Json -Depth 32)

# 3) cordis.patch.yml：删旧插入项，写新插入项
$patch = Get-Content $patchPath -Raw -Encoding UTF8
$oldBlock = '(?ms)^# ── dsh-session-skills.*?^      name: ' + [regex]::Escape($oldName) + '\r?\n\r?\n?'
if ($patch -match $oldBlock) {
  $patch = [regex]::Replace($patch, $oldBlock, '')
  Write-Host '已从 cordis.patch.yml 移除旧插入项'
}
if ($patch -notmatch [regex]::Escape('name: ' + $pkgName)) {
  $block = '# ── dsh-skill-panel：左侧导航「插件」下面的「技能」行 ──' + $nl + '- insert:' + $nl + '    - id: skill-panel' + $nl + '      name: ' + $pkgName
  $patch = $patch.TrimEnd() + $nl + $nl + $block + $nl
  Write-Host '已写入 cordis.patch.yml 插入项'
}
Write-Utf8NoBom $patchPath $patch

# 4) node_modules 链接（junction，普通权限即可）
if (-not (Test-Path $nmDir)) { New-Item -ItemType Directory -Path $nmDir | Out-Null }
$linkPath = Join-Path $nmDir $pkgName
$oldLink = Join-Path $nmDir $oldName
if (Test-Path $oldLink) { $it = Get-Item $oldLink -Force; if ($it.LinkType) { [System.IO.Directory]::Delete($oldLink); Write-Host ('已删除旧链接 ' + $oldLink) } }
if (Test-Path $linkPath) {
  $item = Get-Item $linkPath -Force
  if ($item.LinkType) { [System.IO.Directory]::Delete($linkPath) } else { throw ($linkPath + ' 已存在且不是链接，请先手动处理') }
}
& cmd.exe /c ('mklink /J "' + $linkPath + '" "' + $repoRoot + '"') | Out-Null
if (-not (Test-Path (Join-Path $linkPath 'package.json'))) { throw ('链接创建失败：' + $linkPath) }

Write-Host ''
Write-Host '装好了。重启一次 DeepSeek Harness，左侧「插件」下面就会出现「技能」。' -ForegroundColor Green
Write-Host ('备份：' + $pjPath + '.bak / ' + $patchPath + '.bak')
