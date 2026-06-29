# serve.ps1 — dependency-free local web server for internal-hpca.
# Used when Python isn't installed. Serves the folder over http://127.0.0.1:5500
# (Google OAuth rejects file://) and auto-shuts down ~12s after the last browser
# tab is closed. Needs nothing beyond the PowerShell that ships with Windows.

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$port    = 5500
$timeout = 12   # seconds with no heartbeat before shutting down
$script:lastSeen = Get-Date

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
    $listener.Start()
} catch {
    # Port already in use — assume the app is already running and just open it.
    Start-Process "http://127.0.0.1:$port"
    exit 0
}

Start-Process "http://127.0.0.1:$port"

$types = @{
    '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
    '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
    '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
    '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
    '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.webp'='image/webp';
    '.woff'='font/woff'; '.woff2'='font/woff2'; '.map'='application/json'
}

function Send-Response($stream, [int]$code, [string]$status, [string]$ctype, [byte[]]$body) {
    if ($null -eq $body) { $body = [byte[]]::new(0) }
    $head = "HTTP/1.1 $code $status`r`n"
    if ($ctype) { $head += "Content-Type: $ctype`r`n" }
    $head += "Content-Length: $($body.Length)`r`n"
    $head += "Cache-Control: no-store`r`n"
    $head += "Connection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($body.Length) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

$rootFull = [System.IO.Path]::GetFullPath($root)

while ($true) {
    if ($listener.Pending()) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 2000
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII)
            $requestLine = $reader.ReadLine()
            if ($requestLine) {
                $parts = $requestLine.Split(' ')
                $path  = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
                $path  = $path.Split('?')[0]

                if ($path -like '/__alive*') {
                    $script:lastSeen = Get-Date
                    Send-Response $stream 204 'No Content' $null $null
                } else {
                    if ($path -eq '/') { $path = '/index.html' }
                    $rel  = [Uri]::UnescapeDataString($path.TrimStart('/')).Replace('/', '\')
                    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
                    if ($full.StartsWith($rootFull) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
                        $bytes = [System.IO.File]::ReadAllBytes($full)
                        $ext   = [System.IO.Path]::GetExtension($full).ToLower()
                        $ct    = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
                        Send-Response $stream 200 'OK' $ct $bytes
                    } else {
                        Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Not found'))
                    }
                }
            }
        } catch {
        } finally {
            $client.Close()
        }
    } else {
        Start-Sleep -Milliseconds 200
        if (((Get-Date) - $script:lastSeen).TotalSeconds -gt $timeout) { break }
    }
}

$listener.Stop()
