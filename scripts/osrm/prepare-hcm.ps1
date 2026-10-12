[CmdletBinding()]
param([switch]$Force, [switch]$DownloadVietnam)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

function Invoke-DockerChecked {
    param([string[]]$DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker failed ($LASTEXITCODE): $($DockerArguments -join ' ')" }
}

Push-Location $projectRoot
$jobLock = $null
try {
    # Capture config in memory only; never print environment values/credentials.
    $configText = & docker compose --profile routing-tools config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid Docker Compose configuration' }
    $compose = ($configText -join "`n") | ConvertFrom-Json
    $dataDir = ($compose.services.'osrm-tools'.volumes | Where-Object target -eq '/data').source
    $sourceDir = ($compose.services.'osrm-tools'.volumes | Where-Object target -eq '/source').source
    if (-not $dataDir -or -not $sourceDir) { throw 'Missing OSRM bind mounts in Compose' }
    New-Item -ItemType Directory -Force $dataDir | Out-Null
    $jobLock = [System.IO.File]::Open((Join-Path $dataDir '.prepare-hcm.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $sourcePbf = Join-Path $sourceDir 'vietnam-latest.osm.pbf'
    if (-not (Test-Path -LiteralPath $sourcePbf)) {
        if (-not $DownloadVietnam) { throw "Existing Vietnam PBF missing at $sourcePbf. Supply it or rerun with -DownloadVietnam." }
        New-Item -ItemType Directory -Force $sourceDir | Out-Null
        $downloadPath = "$sourcePbf.download-$([guid]::NewGuid().ToString('N'))"
        & curl.exe --fail --location --retry 3 --output $downloadPath 'https://download.geofabrik.de/asia/vietnam-latest.osm.pbf'
        if ($LASTEXITCODE -ne 0) { throw 'Vietnam PBF download failed' }
        $checksum = & curl.exe --fail --silent --show-error --location 'https://download.geofabrik.de/asia/vietnam-latest.osm.pbf.md5'
        if ($LASTEXITCODE -ne 0) { throw 'Could not download PBF checksum' }
        $expected = ($checksum -split '\s+')[0]
        if ((Get-FileHash -LiteralPath $downloadPath -Algorithm MD5).Hash -ine $expected) { throw 'Vietnam PBF checksum mismatch' }
        Move-Item -LiteralPath $downloadPath -Destination $sourcePbf
    }
    $region = Get-Content -Raw (Join-Path $PSScriptRoot 'hcm-region.json') | ConvertFrom-Json
    $sources = Join-Path $dataDir 'sources'
    New-Item -ItemType Directory -Force $sources | Out-Null
    $boundary = Join-Path $sources 'geoBoundaries-VNM-ADM1.geojson'
    if (-not (Test-Path -LiteralPath $boundary)) {
        $candidate = "$boundary.download-$([guid]::NewGuid().ToString('N'))"
        & curl.exe --fail --location --retry 3 --output $candidate $region.boundaryUrl
        if ($LASTEXITCODE -ne 0) { throw 'Boundary download failed' }
        if ((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -ine $region.boundarySha256) { throw 'Boundary checksum mismatch' }
        Move-Item -LiteralPath $candidate -Destination $boundary
    }
    if ((Get-FileHash -LiteralPath $boundary -Algorithm SHA256).Hash -ine $region.boundarySha256) { throw 'Cached boundary checksum mismatch; keep it for inspection and supply the verified boundary.' }
    Invoke-DockerChecked @('compose', '--profile', 'routing-tools', 'build', 'osrm-tools')
    $runArgs = @('compose', '--profile', 'routing-tools', 'run', '--rm', '--no-deps')
    if ($Force) { $runArgs += @('-e', 'OSRM_FORCE=1') }
    Invoke-DockerChecked ($runArgs + 'osrm-tools')
    Invoke-DockerChecked ($runArgs + 'osrm-prepare')
    Write-Host 'HCMC graph validated. Start/recreate only osrm, wait for healthy, then build/start GIS. See README.md.'
} finally {
    if ($jobLock) { $jobLock.Dispose() }
    Pop-Location
}
