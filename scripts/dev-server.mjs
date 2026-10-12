import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(fileURLToPath(new URL('../',import.meta.url)));
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer(async(req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const parts = pathname.split('/').filter(Boolean);
    if(parts.some(p=>p.startsWith('.')) || parts.some(p=>['node_modules','security','scripts','tests','docs','server'].includes(p))) throw new Error('private');
    const file = await realpath(resolve(root,`.${pathname === '/' ? '/index.html' : pathname}`));
    if(!file.startsWith(root+sep) || !types[extname(file)]) throw new Error('private');
    if(extname(file) === '.json' && !['manifest.json','test-build.json'].includes(parts.at(-1))) throw new Error('private');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('FitFlow local : http://127.0.0.1:4173 (Firebase émulateurs uniquement)'));
