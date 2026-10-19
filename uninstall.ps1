<#
.SYNOPSIS
  从 DSH profile 里卸载 dsh-skill-panel（也一并清理旧名 dsh-session-skills）。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File uninstall.ps1
#>
[CmdletBinding()]
param(
  [string]$Profile = '',
  [string]$ProfileDir = ''
)

$ErrorActionPreference = 'Stop'
$pkgName = 'dsh-skill-panel'
$oldName = 'dsh-session-skills'

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
  if (-not (Test-Path $root)) { throw ('找不到 DSH profile 目录：' + $root) }
  if ($Name) {
    $p = Join-Path $root $Name
    if (-not (Test-Path $p)) { throw ('profile 不存在：' + $p) }
    return $p
  }
  $cands = Get-ChildItem $root -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'cordis.patch.yml') }
  if (-not $cands) { throw ($root + ' 下没有可用的 profile') }
  if ($cands.Count -eq 1) { return $cands[0].FullName }
  throw ('有多个 profile：' + (($cands | ForEach-Object { $_.Name }) -join ', ') + '。请用 -Profile 指定。')
}

$profileDir = Resolve-ProfileDir $Profile $ProfileDir
$pjPath = Join-Path $profileDir 'package.json'
$patchPath = Join-Path $profileDir 'cordis.patch.yml'

$pj = Get-Content $pjPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($n in @($pkgName, $oldName)) {
  if ($pj.PSObject.Properties['dependencies'] -and $pj.dependencies.PSObject.Properties[$n]) {
    $pj.dependencies.PSObject.Properties.Remove($n)
  }
}
if ($pj.PSObject.Properties['dsh'] -and $pj.dsh.PSObject.Properties['profile'] -and $pj.dsh.profile.PSObject.Properties['bundles']) {
  $pj.dsh.profile.bundles = @($pj.dsh.profile.bundles | Where-Object { $_ -ne $pkgName -and $_ -ne $oldName })
}
Write-Utf8NoBom $pjPath ($pj | ConvertTo-Json -Depth 32)

$patch = Get-Content $patchPath -Raw -Encoding UTF8
foreach ($n in @($pkgName, $oldName)) {
  $pattern = '(?ms)^# ── ' + [regex]::Escape($n + '：') + '.*?^      name: ' + [regex]::Escape($n) + '\r?\n\r?\n?'
  if ($patch -match $pattern) { $patch = [regex]::Replace($patch, $pattern, '') }
}
Write-Utf8NoBom $patchPath $patch.TrimEnd()

foreach ($n in @($pkgName, $oldName)) {
  $linkPath = Join-Path $profileDir ('node_modules\\' + $n)
  if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.LinkType) { [System.IO.Directory]::Delete($linkPath); Write-Host ('已删除链接：' + $linkPath) }
    else { Write-Host ('注意：' + $linkPath + ' 不是链接，未删除') -ForegroundColor Yellow }
  }
}

Write-Host ''
Write-Host '已卸载。重启一次 DeepSeek Harness 后「技能」那一行就消失了。' -ForegroundColor Green
