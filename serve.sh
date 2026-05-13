#!/bin/bash
# Local preview server.
# Usage: bash serve.sh [port]

set -e

PORT="${1:-8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Qi Sun Academic Homepage - local preview"
echo "========================================"
echo ""
echo "URL: http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
elif command -v node >/dev/null 2>&1; then
  node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd(),port=Number(process.argv[1]);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let p=decodeURIComponent(url.pathname);if(p==='/')p='/index.html';const file=path.normalize(path.join(root,p));if(!file.startsWith(root)){res.writeHead(403);res.end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);});}).listen(port,()=>console.log('Serving '+root+' at http://localhost:'+port));" "$PORT"
else
  echo "No Python or Node runtime was found."
  exit 1
fi
