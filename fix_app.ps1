$ErrorActionPreference = "Stop"
$path = "src\App.tsx"
# Ensure we map to absolute path correctly in the environment
$absPath = Resolve-Path $path
Write-Host "Target: $absPath"

$lines = Get-Content $absPath
if (!$lines) { throw "Empty file or read error" }

$teleport = $lines[5293..5317]
$part1 = $lines[0..5181]
$part2 = $lines[5182..5292]
$part3 = $lines[5318..5365]
$part4 = $lines[5503..($lines.Count-1)]

$newLines = $part1 + $teleport + $part2 + $part3 + $part4

# Use Out-File with UTF8. Note: PowerShell 5.1 UTF8 includes BOM usually.
# If we need no BOM, we might need [System.IO.File]::WriteAllLines
[System.IO.File]::WriteAllLines($absPath, $newLines) 

Write-Host "Fixed App.tsx"
