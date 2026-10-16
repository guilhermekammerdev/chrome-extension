#Requires -Version 5.1
<#
Starts an explicitly initiated, local Chrome NetLog diagnostic capture.
Does not read/export certificates, kill Chrome, install services, alter policies,
change TLS trust, or enable sensitive/socket-byte logging.
Raw NetLog may contain navigation URLs. Use a short, dedicated test session.
This helper has not been executed on Windows in the cloud Linux environment.
#>
[CmdletBinding()]
param([string]$ChromePath)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper requires Windows.' }

if (Get-Process -Name chrome -ErrorAction SilentlyContinue) {
    throw 'Chrome is running. Save your work and close Chrome manually, including background instances, before starting the capture. No process was stopped.'
}

if (-not $ChromePath) {
    $candidates = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) |
        Where-Object { $_ } | ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' }
    $ChromePath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $ChromePath -or -not (Test-Path -LiteralPath $ChromePath -PathType Leaf)) { throw 'Chrome was not found. Supply the administrator-approved executable with -ChromePath.' }

$captureRoot = Join-Path $env:LOCALAPPDATA 'CertificateAudit\Capture'
$captureName = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$captureDir = Join-Path $captureRoot $captureName
New-Item -ItemType Directory -Path $captureDir | Out-Null
$logPath = Join-Path $captureDir 'netlog.json'

Write-Host 'Local diagnostic capture only. Raw NetLog can contain navigation URLs.'
Write-Host 'Visit only the test portal, authenticate with A1, then close Chrome manually to finalize the JSON.'
Write-Host 'This does not identify which A1 was used or prove cookie/session reuse.'
Write-Host ('Capture: ' + $logPath)

$launchArgs = @("--log-net-log=`"$logPath`"", '--net-log-capture-mode=Default')
Start-Process -FilePath $ChromePath -ArgumentList $launchArgs -Wait

if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
    throw 'No capture was created. Ask the administrator whether the managed Chrome allows this diagnostic. Do not change organizational policies.'
}
Write-Host 'Chrome exited. Open the extension dashboard and analyze this file locally.'
Write-Host 'Export only the sanitized summary if needed; delete the raw capture when the diagnostic is complete.'
Write-Host $logPath
