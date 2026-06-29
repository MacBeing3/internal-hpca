# update.ps1 — updates this folder from GitHub WITHOUT requiring Git.
# Used as the fallback when `git` isn't installed. Checks the latest commit on
# main; if it differs from the last one we installed, downloads the repo zip and
# copies the files over the folder (it never deletes files you've added locally).

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # makes Invoke-WebRequest much faster

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo   = 'MacBeing3/internal-hpca'
$branch = 'main'
$marker = Join-Path $root '.hpca_version'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ 'User-Agent' = 'hpca-launcher' }

# 1. What's the latest commit on the remote?
try {
    $remote = (Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/commits/$branch" `
                 -Headers $headers -TimeoutSec 15).sha
} catch {
    Write-Host 'Could not reach GitHub. Starting the current version.'
    exit 0
}

# 2. Compare with what we last installed.
$local = ''
if (Test-Path -LiteralPath $marker) { $local = (Get-Content -LiteralPath $marker -Raw).Trim() }
if ($remote -eq $local) {
    Write-Host 'Already up to date.'
    exit 0
}

# 3. Download and unpack the latest version.
Write-Host 'Update found. Downloading the latest version...'
$tmp = Join-Path $env:TEMP ('hpca_' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    $zip = Join-Path $tmp 'src.zip'
    Invoke-WebRequest -Uri "https://github.com/$repo/archive/refs/heads/$branch.zip" `
        -OutFile $zip -Headers $headers -TimeoutSec 120
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force

    $src = Get-ChildItem -LiteralPath $tmp -Directory |
           Where-Object { $_.Name -like 'internal-hpca-*' } | Select-Object -First 1
    if (-not $src) { Write-Host 'Update package looked wrong. Keeping current version.'; exit 0 }

    # Copy/overwrite files; never purge (so local-only files survive). Skip .git.
    robocopy $src.FullName $root /E /XD ".git" /XF ".hpca_version" /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null

    Set-Content -LiteralPath $marker -Value $remote -NoNewline
    Write-Host 'Updated to the latest version.'
} catch {
    Write-Host 'Update failed; starting the current version.'
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
exit 0
