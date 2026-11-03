import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
process.stdin.setRawMode?.(true);
process.stdin.setEncoding('utf8');
console.log('Ready for configuration JSON on stdin (input is hidden).');
let data='';
process.stdin.on('data',async chunk=>{
  data+=chunk;
  if(!/[\r\n]/.test(data))return;
  process.stdin.pause();
  try{
    const cfg=JSON.parse(data.trim());
    const allowed=['LLM_API_KEY','LLM_BASE_URL','LLM_MODEL'];
    if(Object.keys(cfg).some(k=>!allowed.includes(k)))throw Error();
    const dir=resolve(import.meta.dirname,'../../work');
    await mkdir(dir,{recursive:true});
    await writeFile(resolve(dir,'local-env.json'),JSON.stringify(cfg));
    console.log('Saved private local runtime configuration outside source.');
    process.exit(0);
  }catch{console.log('Configuration rejected.');process.exit(1)}
});
