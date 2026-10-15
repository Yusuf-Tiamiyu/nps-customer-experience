// Tiny static server for previewing dist/ locally.  node etl/serve.js [port]
const http=require('http'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','dist'), port=Number(process.argv[2]||4173);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let f=decodeURIComponent(req.url.split('?')[0]); if(f==='/')f='/index.html';
  const p=path.join(dir,f);
  if(!p.startsWith(dir)||!fs.existsSync(p)){res.writeHead(404).end('not found');return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(port,()=>console.log('http://localhost:'+port));
