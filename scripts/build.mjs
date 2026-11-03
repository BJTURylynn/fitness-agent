import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'dist/server'),{recursive:true});
await mkdir(resolve(root,'dist/.openai'),{recursive:true});
const assets={};
for(const file of ['index.html','styles.css','calendar.css','app.js','data.js','logic.js','anatomy.js','calendar.js','calendar-view.js']){
  assets['/'+file]=await readFile(resolve(root,'public',file),'utf8');
}
const data=(await readFile(resolve(root,'public/data.js'),'utf8')).replace(/^export /gm,'');
const modelConfig=(await readFile(resolve(root,'server-model-config.js'),'utf8')).replace(/^export /gm,'');
const api=(await readFile(resolve(root,'server-api.js'),'utf8')).replace(/^import .*?from .*?;\r?\n/gm,'').replace(/^export /gm,'');
const source = data+'\n'+modelConfig+'\n'+api+'\nconst ASSETS = '+JSON.stringify(assets)+';\n'+await readFile(resolve(root,'worker/index.js'),'utf8');
await writeFile(resolve(root,'dist/server/index.js'),source);
await writeFile(resolve(root,'dist/.openai/hosting.json'),await readFile(resolve(root,'.openai/hosting.json')));
console.log('Built self-contained Worker and nine browser assets.');
