import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadLocalEncryptionKey,openLocalModelStore} from './local-model-store.mjs';
const root=resolve(import.meta.dirname,'..');
let local={};
try{local=JSON.parse(await readFile(resolve(root,'../work/local-env.json'),'utf8'))}catch{}
const env={...local,...process.env};
env.MODEL_CONFIG_ENCRYPTION_KEY=await loadLocalEncryptionKey({providedKey:env.MODEL_CONFIG_ENCRYPTION_KEY});
env.DB=await openLocalModelStore();
env.LOCAL_SETTINGS_USER_ID='local-owner';
const port=Number(env.PORT||4173);
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')).href)).default;
const server=createServer(async(req,res)=>{
  try{
    if(req.headers.host!=='127.0.0.1:'+port&&req.headers.host!=='localhost:'+port){res.writeHead(403);return res.end('Invalid host')}
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){res.writeHead(413);res.end('Request too large');return}chunks.push(chunk)}
    const request=new Request('http://'+req.headers.host+req.url,{
      method:req.method,headers:req.headers,
      ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks),duplex:'half'}:{})
    });

    const result=await worker.fetch(request,env,{});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end('本地服务暂时出错')}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
server.on('close',()=>env.DB.close());
