// Exercise actual build/verifier commands. No assertions about source spelling.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {findPython} from '../../build/python.mjs';
import {repoRoot,distFile,dictionaryFile,cacheDir} from '../helpers/paths.mjs';

const run=(command,args)=>spawnSync(command,args,{cwd:repoRoot,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const node=args=>run(process.execPath,args);
if(!fs.existsSync(distFile))execFileSync(process.execPath,['build/build.mjs'],{cwd:repoRoot,stdio:'pipe'});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before=[distFile,dictionaryFile].map(hash);
const rebuilt=node(['build/build.mjs']);
assert.equal(rebuilt.status,0,rebuilt.stderr+rebuilt.stdout);
assert.deepEqual([distFile,dictionaryFile].map(hash),before,'Repeated builds must produce the same script and dictionary');

fs.mkdirSync(cacheDir,{recursive:true});
const directory=fs.mkdtempSync(path.join(cacheDir,'pipeline-'));
try{
  const copy=path.join(directory,'dictionary.js');
  const original=fs.readFileSync(dictionaryFile,'utf8');
  const entries=JSON.parse(fs.readFileSync(path.join(repoRoot,'dict/dict-fc.json'),'utf8')).entries;
  const [key,value]=Object.entries(entries).find(([key,value])=>!/[\\'\r\n]/.test(key+value));
  const needle=`'${key}': '${value}'`;
  const changed=original.replace(needle,`'${key}': '${value} incorrect translation'`);
  assert.notEqual(changed,original,'The generated entry to corrupt must be present');
  fs.writeFileSync(copy,changed);
  assert.notEqual(node(['build/verify_dicts.js',copy]).status,0,'A modified embedded dictionary must fail verification');
  const restored=run(findPython(),['build/inject_dicts.py',copy]);
  assert.equal(restored.status,0,restored.stderr+restored.stdout);
  assert.equal(node(['build/verify_dicts.js',copy]).status,0,'Regenerating from the dictionary source must repair the artifact');
}finally{
  assert.ok(path.resolve(directory).startsWith(path.resolve(cacheDir)+path.sep));
  fs.rmSync(directory,{recursive:true,force:true});
}
console.log('PASS build behavior: reproducible output, corruption rejected, regeneration repairs it');
