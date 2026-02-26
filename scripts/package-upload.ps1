$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$baseName = 'mine-chess-upload'
$distDir = Join-Path $projectRoot 'dist'
$latestZipPath = Join-Path $projectRoot "$baseName.zip"

Write-Host "[package-upload] Building production bundle..."
npm run build

if (-not (Test-Path $distDir)) {
    throw "[package-upload] dist directory was not found after build."
}

$versionRegex = '^mine-chess-upload-v([0-9]+)\.zip$'
$existingZips = Get-ChildItem -Path $projectRoot -Filter "$baseName-v*.zip" -File -ErrorAction SilentlyContinue
$maxVersion = 0

foreach ($zipFile in $existingZips) {
    if ($zipFile.Name -match $versionRegex) {
        $version = [int]$matches[1]
        if ($version -gt $maxVersion) {
            $maxVersion = $version
        }
    }
}

$nextVersion = $maxVersion + 1
$versionedZipPath = Join-Path $projectRoot "$baseName-v$nextVersion.zip"

if (Test-Path $versionedZipPath) {
    Remove-Item $versionedZipPath -Force
}

Write-Host "[package-upload] Creating $([System.IO.Path]::GetFileName($versionedZipPath))..."
$createdByTar = $false
$tarCommand = Get-Command tar -ErrorAction SilentlyContinue

if ($tarCommand) {
    try {
        # Prefer tar because it preserves explicit directory entries (better compatibility on some zip unpackers).
        & tar -a -cf $versionedZipPath -C $distDir .
        if ($LASTEXITCODE -eq 0) {
            $createdByTar = $true
        } else {
            Write-Warning "[package-upload] tar exited with code $LASTEXITCODE. Falling back to Compress-Archive."
        }
    } catch {
        Write-Warning "[package-upload] tar failed: $($_.Exception.Message). Falling back to Compress-Archive."
    }
}

if (-not $createdByTar) {
    Compress-Archive -Path (Join-Path $distDir '*') -DestinationPath $versionedZipPath -CompressionLevel Optimal -Force
}

Write-Host "[package-upload] Updating $([System.IO.Path]::GetFileName($latestZipPath))..."
Copy-Item $versionedZipPath $latestZipPath -Force

Write-Host "[package-upload] Done."
Write-Host "[package-upload] Versioned: $([System.IO.Path]::GetFileName($versionedZipPath))"
Write-Host "[package-upload] Latest:    $([System.IO.Path]::GetFileName($latestZipPath))"
