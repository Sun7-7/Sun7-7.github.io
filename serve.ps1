# Qi Sun Academic Homepage - local preview for Windows PowerShell
# Usage: .\serve.ps1
#        .\serve.ps1 3000

$ErrorActionPreference = "Stop"
$Port = if ($args.Count -ge 1 -and $args[0] -match '^\d+$') { [int]$args[0] } else { 8080 }
Set-Location $PSScriptRoot

Write-Host "Qi Sun Academic Homepage - local preview" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "URL: http://localhost:$Port"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

function Test-RealPython {
    param([string]$CommandName)

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $cmd) { return $false }
    if ($cmd.Source -like "*Microsoft\WindowsApps*") { return $false }
    return $true
}

if (Test-RealPython "python") {
    & python -m http.server $Port
    exit $LASTEXITCODE
}

if (Test-RealPython "python3") {
    & python3 -m http.server $Port
    exit $LASTEXITCODE
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    $server = @'
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const port = Number(process.argv[1]);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('Serving ' + root + ' at http://localhost:' + port));
'@
    node -e $server $Port
    exit $LASTEXITCODE
}

Write-Host "No real Python or Node runtime was found. Install Python 3 or Node.js, then run this script again." -ForegroundColor Red
exit 1
