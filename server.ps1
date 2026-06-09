param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $root "server.mjs"
$nodeExe = Join-Path $env:USERPROFILE "node\node.exe"

if (Test-Path $nodeExe) {
    & $nodeExe $serverScript --port $Port
    return
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    & $nodeCommand.Source $serverScript --port $Port
    return
}

throw "Node.js was not found. Install Node.js or update the startup script to point to your local node.exe."
