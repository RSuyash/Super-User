# PowerShell Script to Deploy Obsidian Plugin

$ErrorActionPreference = 'Stop' # Exit script on first error

$pluginFolderName = 'Super User' # Changed folder name
$sourceDir = $PSScriptRoot # Assumes script is run from plugin root
# Construct the vault path relative to the script's location (assuming script is in Super User)
$parentDir = Split-Path $sourceDir -Parent
$vaultPath = Join-Path $parentDir 'ObsidianVault' # Go up one level to 'Semester VI', then into 'ObsidianVault'
$vaultPluginsDir = Join-Path $vaultPath '.obsidian\plugins' # Use backslash for Windows path separator consistency if needed
$destDir = Join-Path $vaultPluginsDir $pluginFolderName

Write-Host "Starting deployment for $pluginFolderName..."
Write-Host "Source Directory: $sourceDir"
Write-Host "Destination Directory: $destDir"

# 1. Stop existing WebSocket server (if running)
Write-Host "Checking for running WebSocket server..."
# Find node processes running the specific websocket-server.js script
$serverProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*websocket-server.js*" }
if ($serverProcesses) {
    foreach ($proc in $serverProcesses) {
        Write-Host "Stopping existing server process (PID: $($proc.ProcessId))..."
        try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop; Write-Host "Process $($proc.ProcessId) stopped." }
        catch { Write-Warning "Failed to stop process $($proc.ProcessId): $_" }
    }
} else { Write-Host "No running WebSocket server found." }

# 2. Ensure destination directory exists
if (-not (Test-Path $destDir)) {
    Write-Host "Creating destination directory: $destDir"
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
} else { Write-Host "Destination directory exists: $destDir" }

# 3. Copy essential files
Write-Host "Copying main.js and manifest.json..."
try {
    Copy-Item -Path (Join-Path $sourceDir 'main.js') -Destination $destDir -Force -ErrorAction Stop
    Copy-Item -Path (Join-Path $sourceDir 'manifest.json') -Destination $destDir -Force -ErrorAction Stop
    Write-Host "Files copied successfully."
} catch { Write-Error "Failed to copy files: $_"; exit 1 }

# 4. Restart WebSocket server in the background
Write-Host "Restarting WebSocket server in the background..."
$scriptPath = Join-Path $sourceDir 'websocket-server.js'
Start-Job -ScriptBlock { param($script) node $script } -ArgumentList $scriptPath | Out-Null
Write-Host "WebSocket server started in background job."

Write-Host "Deployment complete. Please restart Obsidian and enable the '$pluginFolderName' plugin."