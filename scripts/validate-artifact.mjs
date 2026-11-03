import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const source=await readFile(resolve(root,'dist/server/index.js'),'utf8');
const manifest=JSON.parse(await readFile(resolve(root,'dist/.openai/hosting.json'),'utf8'));
assert.ok(manifest.project_id,'Site identity missing');
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(typeof module.default?.fetch,'function');
for(const path of ['/','/app.js','/styles.css','/calendar.css','/data.js','/logic.js','/anatomy.js','/calendar.js','/calendar-view.js']){
 const response=await module.default.fetch(new Request('https://fitness.test'+path),{});
 assert.equal(response.status,200,path);assert.ok((await response.text()).length>50,path);
}
const status=await module.default.fetch(new Request('https://fitness.test/api/status'),{});
assert.equal(status.status,200);assert.equal((await status.json()).modelConfigured,false);
const missing=await module.default.fetch(new Request('https://fitness.test/private-secrets.json'),{});
assert.equal(missing.status,404);
assert.equal(/tvly-dev-|sk-[A-Za-z0-9]{20}/.test(source),false,'Unexpected credential pattern in published source');
console.log('Validated Worker, browser assets, API status, 404 and absence of embedded credentials.');
