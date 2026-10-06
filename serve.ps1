# Tiny static file server - no Node required (PowerShell HttpListener)
param(
  [int]$Port = 8765,
  [string]$Root = $PSScriptRoot
)

$prefix = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix - try another port: .\serve.ps1 -Port 8766"
  throw
}

Write-Host "Radius local server"
Write-Host "  Demos:  $($prefix)demos/"
Write-Host "  Root:   $Root"
Write-Host "Ctrl+C to stop."

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.md'   = 'text/markdown; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json'
  '.woff2'= 'font/woff2'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

function Get-ContentType([string]$path) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mime.ContainsKey($ext)) { return $mime[$ext] }
  return 'application/octet-stream'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'demos/index.html' }
    if ($rel.EndsWith('/')) { $rel += 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    $rootFull = [IO.Path]::GetFullPath($Root)
    if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $buf = [Text.Encoding]::UTF8.GetBytes('Forbidden')
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $msg = 'Not found: ' + $rel
      $buf = [Text.Encoding]::UTF8.GetBytes($msg)
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } else {
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = Get-ContentType $full
      $res.ContentLength64 = $bytes.Length
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $res.StatusCode = 500
    $buf = [Text.Encoding]::UTF8.GetBytes([string]$_.Exception.Message)
    $res.OutputStream.Write($buf, 0, $buf.Length)
  } finally {
    $res.OutputStream.Close()
  }
}
