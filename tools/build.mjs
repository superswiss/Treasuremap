import {mkdir,cp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
// Only the generated dist folder is replaced. Never copy the workspace wholesale.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Invalid build target');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of ['index.html','style.css','app.js','setup.html','setup.js','setup.css','lib','adventures','content/hunt-settings.json','content/steve-transmissions.json','audio/steve']){
  const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,file),target,{recursive:true});
}
await writeFile(path.join(output,'.nojekyll'),'');
console.log('Built dist/: only game code, settings, STEVE content, and audio.');
