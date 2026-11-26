import './build.mjs';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav'};
createServer(async(req,res)=>{
  try{
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+requested+(requested.endsWith('/')?'index.html':''));
    const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(file)).isFile())throw Error('Not found');
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}).on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 4173 is already in use. If Hidden Trails is already running, open http://localhost:4173; otherwise stop the other service and retry.':error.message);process.exitCode=1;}).listen(4173,'127.0.0.1',()=>console.log('Hidden Trails: http://localhost:4173 (Ctrl+C to stop)'));
